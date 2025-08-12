use crate::config::Config;
use crate::error::{AppError, AppResult};
use crate::models::{OnboardingStatus, UserApiKeys};
use base64::engine::{general_purpose::STANDARD as BASE64_ENGINE, Engine};
use ring::aead::{
    Aad, BoundKey, Nonce, NonceSequence, OpeningKey, SealingKey, UnboundKey, AES_256_GCM,
};
use ring::rand::{SecureRandom, SystemRandom};
use sqlx::PgPool;

pub struct OneTimeNonce(Option<Nonce>);

impl NonceSequence for OneTimeNonce {
    fn advance(&mut self) -> Result<Nonce, ring::error::Unspecified> {
        self.0.take().ok_or(ring::error::Unspecified)
    }
}

pub fn encrypt_secret(config: &Config, plaintext: &str) -> AppResult<(String, String)> {
    let rng = SystemRandom::new();

    // Generate a random 96-bit nonce
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes)
        .map_err(|_| AppError::Crypto("Failed to generate nonce".to_string()))?;
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);

    // Create sealing key
    let unbound_key = UnboundKey::new(&AES_256_GCM, &config.api_keys_kek)
        .map_err(|_| AppError::Crypto("Failed to create encryption key".to_string()))?;
    let nonce_sequence = OneTimeNonce(Some(nonce));
    let mut sealing_key = SealingKey::new(unbound_key, nonce_sequence);

    // Encrypt the plaintext
    let mut ciphertext = plaintext.as_bytes().to_vec();
    sealing_key
        .seal_in_place_append_tag(Aad::empty(), &mut ciphertext)
        .map_err(|_| AppError::Crypto("Failed to encrypt data".to_string()))?;

    Ok((
        BASE64_ENGINE.encode(ciphertext),
        BASE64_ENGINE.encode(nonce_bytes),
    ))
}

pub fn decrypt_secret(config: &Config, ciphertext_b64: &str, nonce_b64: &str) -> AppResult<String> {
    let ciphertext = BASE64_ENGINE
        .decode(ciphertext_b64)
        .map_err(|_| AppError::Crypto("Invalid base64 ciphertext".to_string()))?;
    let nonce_bytes = BASE64_ENGINE
        .decode(nonce_b64)
        .map_err(|_| AppError::Crypto("Invalid base64 nonce".to_string()))?;

    if nonce_bytes.len() != 12 {
        return Err(AppError::Crypto("Invalid nonce length".to_string()));
    }

    let mut nonce_array = [0u8; 12];
    nonce_array.copy_from_slice(&nonce_bytes);
    let nonce = Nonce::assume_unique_for_key(nonce_array);

    // Create opening key
    let unbound_key = UnboundKey::new(&AES_256_GCM, &config.api_keys_kek)
        .map_err(|_| AppError::Crypto("Failed to create decryption key".to_string()))?;
    let nonce_sequence = OneTimeNonce(Some(nonce));
    let mut opening_key = OpeningKey::new(unbound_key, nonce_sequence);

    // Decrypt the ciphertext
    let mut plaintext = ciphertext;
    let decrypted = opening_key
        .open_in_place(Aad::empty(), &mut plaintext)
        .map_err(|_| AppError::Crypto("Failed to decrypt data".to_string()))?;

    String::from_utf8(decrypted.to_vec())
        .map_err(|_| AppError::Crypto("Decrypted data is not valid UTF-8".to_string()))
}

pub async fn get_decrypted_api_keys_for_user(
    db: &crate::database::Database,
    config: &Config,
    user_id: i32,
) -> AppResult<(Option<String>, Option<String>)> {
    if let Some(keys) = db.get_user_api_keys(user_id).await? {
        let anthropic = match (&keys.anthropic_ciphertext, &keys.anthropic_nonce) {
            (Some(ct), Some(nonce)) => Some(decrypt_secret(config, ct, nonce)?),
            _ => None,
        };
        let openai = match (&keys.openai_ciphertext, &keys.openai_nonce) {
            (Some(ct), Some(nonce)) => Some(decrypt_secret(config, ct, nonce)?),
            _ => None,
        };
        Ok((anthropic, openai))
    } else {
        Ok((None, None))
    }
}

pub async fn ensure_onboarding_complete(db: &PgPool, user_id: i32) -> AppResult<()> {
    let user = sqlx::query_as!(
        crate::models::User,
        "SELECT * FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(db)
    .await?;

    let user = user.ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    if !user.onboarding_completed.unwrap_or(false) {
        return Err(AppError::Forbidden("Onboarding incomplete".to_string()));
    }

    Ok(())
}

pub async fn get_onboarding_status(db: &PgPool, user_id: i32) -> AppResult<OnboardingStatus> {
    // Get user info
    let user = sqlx::query_as!(
        crate::models::User,
        "SELECT * FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(db)
    .await?;

    let user = user.ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Get API keys status
    let api_keys = sqlx::query_as!(
        UserApiKeys,
        "SELECT * FROM user_api_keys WHERE user_id = $1",
        user_id
    )
    .fetch_optional(db)
    .await?;

    let has_anthropic = api_keys
        .as_ref()
        .and_then(|k| k.anthropic_ciphertext.as_ref())
        .is_some();
    let has_openai = api_keys
        .as_ref()
        .and_then(|k| k.openai_ciphertext.as_ref())
        .is_some();
    let has_default_repo = user.default_repo_id.is_some();
    let onboarding_completed = user.onboarding_completed.unwrap_or(false);

    // Determine step
    let step = if onboarding_completed {
        None
    } else if !has_anthropic {
        Some("api-keys".to_string())
    } else if !has_default_repo {
        Some("default-repo".to_string())
    } else {
        None
    };

    Ok(OnboardingStatus {
        onboarding_completed,
        step,
        has_anthropic,
        has_openai,
        has_default_repo,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> Config {
        Config {
            database_url: "test".to_string(),
            clerk_secret_key: "test".to_string(),
            github_token: None,
            port: 3000,
            modal_url: None,
            modal_region: None,
            api_keys_kek: [0u8; 32], // Test key
        }
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let config = create_test_config();
        let plaintext = "test-secret-key-12345";

        let (ciphertext, nonce) = encrypt_secret(&config, plaintext).unwrap();
        let decrypted = decrypt_secret(&config, &ciphertext, &nonce).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_different_nonces() {
        let config = create_test_config();
        let plaintext = "test-secret-key";

        let (ciphertext1, nonce1) = encrypt_secret(&config, plaintext).unwrap();
        let (ciphertext2, nonce2) = encrypt_secret(&config, plaintext).unwrap();

        // Different encryptions should have different nonces and ciphertexts
        assert_ne!(nonce1, nonce2);
        assert_ne!(ciphertext1, ciphertext2);

        // But both should decrypt to the same plaintext
        let decrypted1 = decrypt_secret(&config, &ciphertext1, &nonce1).unwrap();
        let decrypted2 = decrypt_secret(&config, &ciphertext2, &nonce2).unwrap();
        assert_eq!(decrypted1, decrypted2);
        assert_eq!(decrypted1, plaintext);
    }
}
