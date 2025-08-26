#!/bin/bash

# Swarm Repository Setup Script
# This script sets up a new worktree with all the necessary dependencies and tools
# to work on the Swarm project. It handles Rust, Bun, Python/UV, git hooks, and more.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get OS information
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

# Install Rust if needed
install_rust() {
    if ! command_exists rustc || ! command_exists cargo; then
        log_info "Installing Rust toolchain..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

        # Source Rust environment
        source "$HOME/.cargo/env" 2>/dev/null || true
        export PATH="$HOME/.cargo/bin:$PATH"

        log_success "Rust installed"
    else
        log_success "Rust already installed"
    fi

    # Ensure we have the latest stable version (skip on macOS)
    local os=$(detect_os)
    if [[ "$os" != "macos" ]]; then
        log_info "Updating Rust to latest stable..."
        rustup update stable
        rustup default stable
    else
        log_info "Skipping rustup commands on macOS"
    fi
}

# Install Bun if needed
install_bun() {
    if ! command_exists bun; then
        log_info "Installing Bun..."
        curl -fsSL https://bun.sh/install | bash

        # Add to PATH for this session
        export PATH="$HOME/.bun/bin:$PATH"

        log_success "Bun installed"
    else
        log_success "Bun already installed"
    fi
}

# Install Python and UV if needed
install_python_and_uv() {
    local os=$(detect_os)
    local python_version="3.11"

    # Check Python version
    if command_exists python3; then
        local current_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
        local required_version="3.11"

        # Simple version comparison (assumes format X.Y)
        if [[ $(echo "$current_version >= $required_version" | bc -l 2>/dev/null || echo "0") == "1" ]] ||
           [[ "$current_version" == "3.11" ]] || [[ "$current_version" == "3.12" ]] || [[ "$current_version" == "3.13" ]]; then
            log_success "Python $current_version is compatible"
        else
            log_warning "Python $current_version found, but 3.11+ is required"

            if [[ "$os" == "macos" ]]; then
                if command_exists brew; then
                    log_info "Installing Python 3.11 via Homebrew..."
                    brew install python@3.11
                fi
            elif [[ "$os" == "linux" ]]; then
                log_info "Please install Python 3.11+ using your system package manager"
                log_info "Ubuntu/Debian: sudo apt install python3.11"
                log_info "RHEL/CentOS: sudo dnf install python3.11"
            fi
        fi
    else
        log_info "Python not found, installing..."
        if [[ "$os" == "macos" ]] && command_exists brew; then
            brew install python@3.11
        elif [[ "$os" == "linux" ]]; then
            log_info "Please install Python 3.11+ using your system package manager"
            log_info "Ubuntu/Debian: sudo apt install python3.11 python3.11-pip"
            log_info "RHEL/CentOS: sudo dnf install python3.11 python3.11-pip"
        fi
    fi

    # Install UV package manager
    if ! command_exists uv; then
        log_info "Installing UV package manager..."
        curl -LsSf https://astral.sh/uv/install.sh | sh

        # Add to PATH for this session
        export PATH="$HOME/.local/bin:$PATH"

        log_success "UV installed"
    else
        log_success "UV already installed"
    fi
}

# Install additional tools
install_additional_tools() {
    local os=$(detect_os)

    # Install prettier globally for the git hooks
    if command_exists bun; then
        log_info "Installing prettier globally via Bun..."
        bun add -g prettier
    fi

    # Ensure rustfmt is available (skip rustup on macOS)
    local os=$(detect_os)
    if command_exists rustup && [[ "$os" != "macos" ]]; then
        log_info "Installing rustfmt component..."
        rustup component add rustfmt
    elif [[ "$os" == "macos" ]]; then
        log_info "Skipping rustup component installation on macOS"
    fi

    # Install other development tools based on OS
    if [[ "$os" == "macos" ]] && command_exists brew; then
        # Install useful development tools
        if ! command_exists git; then
            brew install git
        fi
    elif [[ "$os" == "linux" ]]; then
        # Basic development tools for Linux
        if ! command_exists git; then
            log_info "Please install git using your system package manager"
        fi
    fi
}

# Setup git hooks
setup_git_hooks() {
    local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
    local hooks_dir="$(git rev-parse --git-common-dir 2>/dev/null || echo "$git_root/.git")/hooks"
    local scripts_dir="$git_root/scripts"

    if [[ ! -d "$hooks_dir" ]]; then
        log_error "Not in a git repository or .git/hooks directory not found"
        return 1
    fi

    log_info "Setting up git hooks..."

    # Copy pre-commit hook from scripts/ if it exists
    if [[ -f "$scripts_dir/pre-commit" ]]; then
        cp "$scripts_dir/pre-commit" "$hooks_dir/pre-commit"
        chmod +x "$hooks_dir/pre-commit"
        log_success "Pre-commit hook installed"
    else
        log_warning "Pre-commit hook not found in scripts/ directory"
    fi
}

# Install project dependencies
install_project_dependencies() {
    local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

    log_info "Installing project dependencies..."

    # Backend (Rust)
    if [[ -f "$git_root/backend/Cargo.toml" ]]; then
        log_info "Installing Rust backend dependencies..."
        cd "$git_root/backend"
        cargo fetch
        log_success "Backend dependencies installed"
        cd "$git_root"
    fi

    # Frontend (Web)
    if [[ -f "$git_root/frontend/package.json" ]]; then
        log_info "Installing web frontend dependencies..."
        cd "$git_root/frontend"
        bun install
        log_success "Web frontend dependencies installed"
        cd "$git_root"
    fi

    # Desktop Frontend
    if [[ -f "$git_root/desktop/frontend/package.json" ]]; then
        log_info "Installing desktop frontend dependencies..."
        cd "$git_root/desktop/frontend"
        bun install
        log_success "Desktop frontend dependencies installed"
        cd "$git_root"
    fi

    # CLI (Python)
    if [[ -f "$git_root/cli/pyproject.toml" ]]; then
        log_info "Installing CLI dependencies..."
        cd "$git_root/cli"
        uv sync
        log_success "CLI dependencies installed"
        cd "$git_root"
    fi

    # Sandbox (Python)
    if [[ -f "$git_root/sandbox/pyproject.toml" ]]; then
        log_info "Installing sandbox dependencies..."
        cd "$git_root/sandbox"
        uv sync
        log_success "Sandbox dependencies installed"
        cd "$git_root"
    fi
}

# Setup environment files
setup_environment_files() {
    local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

    log_info "Setting up environment files..."

    # Backend .env
    if [[ -f "$git_root/backend/.env.example" ]] && [[ ! -f "$git_root/backend/.env" ]]; then
        cp "$git_root/backend/.env.example" "$git_root/backend/.env"
        log_success "Backend .env created from example"
        log_warning "Please edit backend/.env with your actual configuration"
    fi

    # Main .env
    if [[ -f "$git_root/.env.example" ]] && [[ ! -f "$git_root/.env" ]]; then
        cp "$git_root/.env.example" "$git_root/.env"
        log_success "Main .env created from example"
        log_warning "Please edit .env with your actual configuration"
    fi

    # Frontend .env files (if they have examples)
    if [[ -f "$git_root/frontend/.env.example" ]] && [[ ! -f "$git_root/frontend/.env" ]]; then
        cp "$git_root/frontend/.env.example" "$git_root/frontend/.env"
        log_success "Frontend .env created from example"
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."

    local errors=0

    # Check Rust
    if command_exists rustc && command_exists cargo; then
        local rust_version=$(rustc --version)
        log_success "Rust: $rust_version"
    else
        log_error "Rust not properly installed"
        errors=$((errors + 1))
    fi

    # Check Bun
    if command_exists bun; then
        local bun_version=$(bun --version)
        log_success "Bun: $bun_version"
    else
        log_error "Bun not installed"
        errors=$((errors + 1))
    fi

    # Check Python
    if command_exists python3; then
        local python_version=$(python3 --version)
        log_success "Python: $python_version"
    else
        log_error "Python not properly installed"
        errors=$((errors + 1))
    fi

    # Check UV
    if command_exists uv; then
        local uv_version=$(uv --version)
        log_success "UV: $uv_version"
    else
        log_error "UV not installed"
        errors=$((errors + 1))
    fi

    # Check additional tools
    if command_exists rustfmt; then
        log_success "rustfmt available"
    else
        log_warning "rustfmt not available (install with: rustup component add rustfmt)"
    fi

    if command_exists git; then
        log_success "Git available"
    else
        log_error "Git not available"
        errors=$((errors + 1))
    fi

    return $errors
}


# Main setup function
main() {
    echo "🔧 Swarm Repository Setup"
    echo "=========================="
    echo ""

    local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

    log_info "Setting up Swarm development environment..."
    log_info "Detected OS: $(detect_os)"
    log_info "Repository root: $git_root"
    echo ""

    # Install system dependencies
    install_rust
    install_bun
    install_python_and_uv
    install_additional_tools

    echo ""

    # Setup project
    setup_git_hooks
    setup_environment_files
    install_project_dependencies

    echo ""

    # Verify and test
    if verify_installation; then
        log_success "All required tools are installed!"
    else
        log_warning "Some tools may need manual installation"
    fi

    echo ""
    echo "🎉 Setup complete!"
    echo ""
    log_info "Next steps:"
    echo "  1. Edit .env files with your configuration"
    echo "  2. Run the backend: cd backend && cargo run"
    echo "  3. Run the frontend: cd frontend && bun run dev"
    echo ""
    log_info "For more information, see the README.md file"
}

# Run main function
main "$@"
