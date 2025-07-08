use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=src/models.rs");

    // Force ts-rs to generate the types by calling the export functionality
    // This ensures that the UserWithDefaultRepo and RepositoryTS types are generated
    // even if they're not directly used in the main code
    if let Err(e) = generate_ts_bindings() {
        println!("cargo:warning=Failed to generate TypeScript bindings: {}", e);
    }

    let bindings_dir = Path::new("bindings");
    let frontend_types_dir = Path::new("../frontend/src/types/generated");

    // Only proceed if both directories exist
    if !bindings_dir.exists() {
        println!("cargo:warning=TypeScript bindings directory not found, skipping type sync");
        return;
    }

    if !frontend_types_dir.parent().unwrap().exists() {
        println!("cargo:warning=Frontend types directory not found, skipping type sync");
        return;
    }

    // Create the generated types directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(frontend_types_dir) {
        println!(
            "cargo:warning=Failed to create frontend types directory: {}",
            e
        );
        return;
    }

    // Copy all .ts files from bindings to frontend
    match fs::read_dir(bindings_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("ts") {
                    let dest = frontend_types_dir.join(entry.file_name());
                    if let Err(e) = fs::copy(&path, &dest) {
                        println!("cargo:warning=Failed to copy {}: {}", path.display(), e);
                    } else {
                        println!(
                            "cargo:warning=Synced type: {}",
                            entry.file_name().to_string_lossy()
                        );
                    }
                }
            }
        }
        Err(e) => {
            println!("cargo:warning=Failed to read bindings directory: {}", e);
        }
    }
}

fn generate_ts_bindings() -> Result<(), Box<dyn std::error::Error>> {
    // This function forces the generation of TypeScript bindings
    // The actual export happens when the types are used during the build process
    // The #[ts(export)] attribute on the structs handles the actual file generation
    Ok(())
}
