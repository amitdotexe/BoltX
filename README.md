# ⚡ BoltX

AI-powered project scaffolding with diff review — paste an AI response, review each file change side-by-side, and apply only what you want. Works both inside VS Code and as a standalone terminal command.

## Features

- **Scaffold** — paste any AI-generated code response and BoltX extracts the files, shows a diff for each one against your existing code, and lets you accept or skip file-by-file.
- **Share** — package your current codebase into a copy-ready format for any AI chat.
- **Terminal-native** — once installed, run `boltx` from any directory, no VS Code window required.
- **Multi-provider** — supports Gemini, OpenAI, DeepSeek, and Groq.

## Getting Started

1. Install the extension from the Marketplace.
2. Reload VS Code once — this auto-installs the `boltx` command globally.
3. Run the setup:
```bash
   boltx init
```
   Select your provider with the arrow keys, then paste your API key into the bordered input box.
4. Use it from anywhere:
```bash
   boltx
```
   Or run **BoltX: Run** from the Command Palette inside VS Code.

## Commands

| Command | Description |
|---|---|
| `BoltX: Run` | Opens the BoltX terminal session |
| `BoltX: Set API Key` | Update the stored API key |
| `BoltX: Set AI Provider` | Switch between Gemini / OpenAI / DeepSeek / Groq |

## Requirements

- Node.js and npm on your system PATH
- An API key from your chosen provider

## Configuration

Config is stored locally at `~/.config/boltx/cli-config.json` (permissions `0600`). Re-run `boltx init` anytime to change provider or key.

## Privacy & Telemetry

BoltX sends lightweight, anonymous usage events — for example, whether a scaffold or share operation succeeded or failed, which provider was used, and basic OS info. **It never reads, uploads, or transmits your source code, file paths, or file contents.** The anonymous ID is a one-way hash derived from your machine, not tied to any personal identity.

## License

MIT
