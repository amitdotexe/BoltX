# ⚡ BoltX

Share your codebase in an AI-ready format, instantly — from any terminal or inside VS Code.

## Features

- **Share** — package your current codebase into a copy-ready format for any AI chat.
- **Terminal-native** — once installed, run `boltx` from any directory, no VS Code window required.
- **Multi-provider** — supports Gemini, OpenAI, DeepSeek, and Groq.

## Getting Started

1. Install the extension from the Marketplace.
2. Reload VS Code once — this auto-installs the `boltx` command globally.
3. Run setup:

```bash
boltx init
```

4. Use it from anywhere:

```bash
boltx
```

Or run **BoltX: Run** from the Command Palette.

## Commands

| Command                  | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `BoltX: Run`             | Opens the BoltX terminal session                 |
| `BoltX: Set API Key`     | Update the stored API key                        |
| `BoltX: Set AI Provider` | Switch between Gemini / OpenAI / DeepSeek / Groq |

## Requirements

- Node.js and npm on PATH
- API key from your chosen provider

## Configuration

Stored at `~/.config/boltx/cli-config.json` (`0600`). Re-run `boltx init` to change.

## Privacy & Telemetry

Sends anonymous usage events (success/failure, provider, OS). Never reads or transmits source code.

## License

MIT
