use anyhow::Result;
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64URL;
use base64::Engine;
use rand::rngs::OsRng;
use rand::RngCore;

pub struct NewApiToken {
    pub token_string: String, // return once
    pub token_id: String,     // store publicly
    pub token_hash: String,   // store hash
    pub last_four: String,
}

pub fn generate_api_token(is_live: bool) -> Result<NewApiToken> {
    let mut id_bytes = [0u8; 10];
    OsRng.fill_bytes(&mut id_bytes);
    let token_id = B64URL.encode(id_bytes);

    let mut sec_bytes = [0u8; 24];
    OsRng.fill_bytes(&mut sec_bytes);
    let secret = B64URL.encode(sec_bytes);

    let prefix = if is_live { "sk_live" } else { "sk_test" };
    let token_string = format!("{}.{}.{}", prefix, token_id, secret);

    let last_four = secret
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let token_hash = argon2
        .hash_password(token_string.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("Failed to hash password: {}", e))?
        .to_string();

    Ok(NewApiToken {
        token_string,
        token_id,
        token_hash,
        last_four,
    })
}
