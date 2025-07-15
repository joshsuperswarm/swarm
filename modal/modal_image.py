import modal

app = modal.App("sandbox-shim")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git", "curl", "sudo", "unzip", "build-essential",
        "pkg-config", "libssl-dev", "libsqlite3-dev", "jq"
    )
    .run_commands(
        "useradd -m -s /bin/bash swarm && "
        "echo 'swarm ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers"
    )
    .run_commands(
        # Rust + Bun under swarm
        "su - swarm -c \"curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs "
        "| sh -s -- -y --profile minimal --default-toolchain stable\"",
        "su - swarm -c \"curl -fsSL https://bun.sh/install | bash\""
    )
    .run_commands(
        # Node 20 for npm (handy even if Claude Code uses native install)
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && "
        "apt-get install -y nodejs"
    )
    .run_commands(
        # Claude Code native installer (needs jq, already installed)
        "su - swarm -c \"curl -fsSL https://claude.ai/install.sh | bash\""
    )
    # Global PATH so root *and* swarm see cargo / bun / claude-code
    .env({
        "PATH": (
            "/home/swarm/.local/bin:"      # claude-code
            "/home/swarm/.cargo/bin:"      # cargo / rustc
            "/home/swarm/.bun/bin:"        # bun, bunx
            "$PATH"
        )
    })
)

# Image is available as:  sandbox-shim/swarm_dev_image:latest
@app.function(image=image)
def swarm_dev_image() -> str:
    return "image built"
