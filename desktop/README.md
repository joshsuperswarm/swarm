# Swarm - Desktop App

A Tauri-based desktop application for chatting with GPT-5 about your code files.

## Features

- Open any folder as a repository
- Press Cmd/Ctrl-P to fuzzy search and select multiple files
- Selected files display as removable pills with live token counts
- Full file contents sent to GPT-5 (no truncation)
- Streaming responses with cancel support
- Persists last opened folder and selected files

## Setup

### Prerequisites

- Rust (latest stable)
- Node.js or Bun
- Environment variables:
  - `OPENAI_API_KEY` - Your OpenAI API key
  - `OPENAI_MODEL` (optional) - Model to use (default: "gpt-4o")
  - `OPENAI_ENCODING` (optional) - Tokenizer encoding (default: "o200k_base")

### Install Dependencies

```bash
# Install frontend dependencies
cd frontend
bun install

# Build Rust dependencies
cd ../src-tauri
cargo build
```

### Development

```bash
# From the desktop directory
cd src-tauri
cargo tauri dev
```

### Build for Production

```bash
# From the desktop directory
cd src-tauri
cargo tauri build
```

## Usage

1. Launch the app
2. Click "Open Folder" or use File → Open to select a repository
3. Press Cmd/Ctrl-P to open the file picker
4. Select files by clicking or using arrow keys + Enter
5. View token counts in the header
6. Type your question and press Enter to chat
7. Press Escape to cancel streaming responses

## Technical Details

- **Frontend**: React + TypeScript + Tailwind + Zustand
- **Backend**: Rust with Tauri v2
- **Token Counting**: tiktoken-rs with caching
- **File Operations**: All done in Rust for security
- **Streaming**: Server-sent events with retry logic
