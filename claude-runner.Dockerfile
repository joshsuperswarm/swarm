# Claude Runner Image for Daytona Workspaces
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV USER=dev
ENV HOME=/home/dev

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    openssh-server \
    sudo \
    python3 \
    python3-pip \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (required for Claude Code)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Create dev user
RUN useradd -m -s /bin/bash -G sudo $USER && \
    echo "$USER ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Configure SSH
RUN mkdir -p /var/run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh

# Install Claude Code CLI via npm
RUN npm install -g @anthropic-ai/claude-code

# Create runner directory and script
RUN mkdir -p /runner
COPY entrypoint.sh /runner/entrypoint.sh
RUN chmod +x /runner/entrypoint.sh

# Switch to dev user
USER $USER
WORKDIR $HOME

# Set up git configuration
RUN git config --global user.name "Claude AI" && \
    git config --global user.email "noreply@anthropic.com" && \
    git config --global init.defaultBranch main

# Expose SSH port
EXPOSE 22

# Start SSH daemon and wait for commands
CMD ["/runner/entrypoint.sh"]