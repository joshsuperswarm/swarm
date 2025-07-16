import modal

app = modal.App("sandbox-shim")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git",
        "curl",
        "sudo",
        "unzip",
        "build-essential",
        "pkg-config",
        "libssl-dev",
        "libsqlite3-dev",
        "jq",
        "postgresql",
        "postgresql-contrib",
        "libpq-dev",
        "procps",
    )
    .run_commands(
        "useradd -m -s /bin/bash swarm && "
        "echo 'swarm ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers"
    )
    .run_commands(
        "su - swarm -c \"curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs "
        "| sh -s -- -y --profile minimal --default-toolchain stable\"",
        "su - swarm -c \"curl -fsSL https://bun.sh/install | bash\""
    )
    .run_commands(
        "su - swarm -c \"curl -fsSL https://claude.ai/install.sh | bash\""
    )
    .env({
        "PATH": (
            "/home/swarm/.local/bin:"
            "/home/swarm/.cargo/bin:"
            "/home/swarm/.bun/bin:"
            "$PATH"
        )
    })
)

# Image is available as:  sandbox-shim/swarm_dev_image:latest
@app.function(image=image)
def swarm_dev_image() -> str:
    return "image built"
