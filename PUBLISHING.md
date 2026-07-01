# Publishing BoltX to the VS Code Marketplace

A step-by-step guide for taking BoltX from a locally-linked extension to a publicly published one, plus an optional npm release.

---

## 0. Prerequisites Checklist

| Requirement | Why | Check |
|---|---|---|
| Microsoft (Azure DevOps) account | Publisher identity lives here | — |
| `@vscode/vsce` installed globally | Packages and publishes `.vsix` | `npm install -g @vscode/vsce` |
| `package.json` finalized | Marketplace reads metadata from here | version, publisher, icon, repo set |
| `README.md` in the extension root | Becomes the Marketplace listing page | — |
| `LICENSE` file | Marketplace flags extensions without one | e.g. MIT |
| Icon (128×128 PNG minimum) | Shown in Marketplace + Extensions panel | `images/icon.png` |

---

## 1. Create a Publisher (One-Time Setup)

A **publisher** is your namespace on the Marketplace — it's the `amit-mallick` part of `amit-mallick.boltx`.

1. Go to **https://marketplace.visualstudio.com/manage** and sign in with a Microsoft account.
2. Click **Create publisher**.
3. Set the **Publisher ID** to `amit-mallick` — this must exactly match the `"publisher"` field in `package.json`. It's permanent and cannot be renamed later, only re-created under a new ID.
4. Fill in a display name and (optionally) a logo for the publisher profile itself — separate from the extension's own icon.

---

## 2. Generate a Personal Access Token (PAT)

`vsce` needs a token to authenticate as you when publishing.

1. Go to **https://dev.azure.com/** → sign in with the same Microsoft account.
2. Click your profile icon (top right) → **Personal access tokens**.
3. Click **New Token**:
   - **Name:** `vsce-boltx` (or anything memorable)
   - **Organization:** *All accessible organizations*
   - **Expiration:** up to 1 year (set a calendar reminder — tokens can't be un-expired)
   - **Scopes:** click **Show all scopes** → find **Marketplace** → check **Manage**
4. Click **Create**, then **copy the token immediately** — Azure DevOps only shows it once.

> Treat this token like a password. Don't commit it, don't paste it in chat logs, don't hardcode it in scripts.

---

## 3. Log In via `vsce`

```bash
vsce login amit-mallick
```

Paste the PAT when prompted. This caches the token locally so future `vsce publish` calls don't ask again.

To verify it worked:

```bash
vsce ls-publishers
```

---

## 4. Final Pre-Publish Review

Run through this before packaging — Marketplace rejections are usually caused by one of these:

- [ ] `package.json` → `"version"` is `1.0.0` and follows [semver](https://semver.org/)
- [ ] `package.json` → `"publisher"` is exactly `amit-mallick`
- [ ] `package.json` → `"icon"` points to a valid PNG (not SVG — Marketplace requires PNG)
- [ ] `package.json` → `"repository"` URL is correct and public
- [ ] `package.json` → `"engines.vscode"` matches a version you've actually tested against
- [ ] `.vscodeignore` exists so `node_modules`, `.git`, and dev files aren't bundled into the `.vsix`
- [ ] `README.md` renders cleanly — this becomes your Marketplace page, so check it in VS Code's Markdown preview first

**Example `.vscodeignore`:**
```
.vscode/**
.git/**
node_modules/**
*.vsix
.gitignore
```

---

## 5. Package Locally (Sanity Check Before Publishing)

Always test the packaged `.vsix` before it goes live — a bad package is far easier to fix pre-publish than post-publish.

```bash
cd /home/amit/bolt-dev/bolt_vscode_cli
vsce package
```

This outputs `boltx-1.0.0.vsix`. Install it fresh to confirm nothing broke:

```bash
code --uninstall-extension amit-mallick.boltx
code --install-extension boltx-1.0.0.vsix --force
```

Reload VS Code, confirm:
- `BoltX: Run` appears in the Command Palette
- The `boltx` command auto-installs globally and works in a fresh terminal
- `boltx init` shows the arrow-select menu and bordered API key box correctly

---

## 6. Publish

Once the local `.vsix` checks out:

```bash
vsce publish
```

This builds and uploads in one step. To publish a *specific* version bump directly (skips manually editing `package.json`):

```bash
vsce publish patch   # 1.0.0 → 1.0.1
vsce publish minor   # 1.0.0 → 1.1.0
vsce publish major   # 1.0.0 → 2.0.0
```

The extension typically appears on the Marketplace within a few minutes, searchable at:
```
https://marketplace.visualstudio.com/items?itemName=amit-mallick.boltx
```

---

## 7. (Optional) Publish the CLI to npm

This is a **separate distribution channel** from the Marketplace — it lets anyone run `npm i -g boltx` without installing the VS Code extension at all.

```bash
npm login
npm publish
```

Notes:
- `"name"` in `package.json` must be an available npm package name — check first at `https://www.npmjs.com/package/boltx`. If taken, use a scoped name like `@amit-mallick/boltx`.
- The `bin` field you already have (`{ "boltx": "./boltx-cli.js" }`) is exactly what npm uses to wire up the global command — no extra config needed.
- Since the extension already auto-installs the CLI globally on activation, npm publishing is only necessary if you want the CLI usable **independent of VS Code**.

---

## 8. Post-Publish Maintenance

| Task | Command |
|---|---|
| Push an update | bump version in `package.json` → `vsce publish` |
| Unpublish a version | `vsce unpublish amit-mallick.boltx@1.0.0` |
| Unpublish entirely | `vsce unpublish amit-mallick.boltx` |
| View install stats | Marketplace → your publisher page → extension → **Statistics** tab |

---

## Quick Reference — Full Command Sequence

```bash
# one-time
npm install -g @vscode/vsce
vsce login amit-mallick

# every release
cd /home/amit/bolt-dev/bolt_vscode_cli
vsce package
code --install-extension boltx-1.0.0.vsix --force   # local sanity check
vsce publish

# optional, separate channel
npm publish
```
