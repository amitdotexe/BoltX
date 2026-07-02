const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const SESSION_PATH = path.join(os.tmpdir(), "boltx-session.json");
const REVIEW_DIR = path.join(os.tmpdir(), "boltx-review");

const PROVIDERS = ["gemini", "openai", "groq", "deepseek"];

let boltxTerminal = null;
let sessionWatcher = null;
let extensionContext = null;

function readSession() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
  } catch (e) {
    console.error("[BoltX] session parse failed:", e.message);
  }
}

function writeSession(data) {
  fs.writeFileSync(SESSION_PATH, JSON.stringify(data, null, 2), "utf8");
}

function writeTempFile(filePath, content) {
  const fullPath = path.join(REVIEW_DIR, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

// Auto-installs the global `boltx` terminal command the first time the
// extension activates, so the user never has to run `npm link` manually.
function ensureGlobalCli(context) {
  const checkCmd =
    process.platform === "win32" ? "where boltx" : "command -v boltx";
  try {
    execSync(checkCmd, { stdio: "ignore" });
    return; // already installed
  } catch {
    console.log("[BoltX] boltx not found, reinstalling from extension bundle");
  }

  try {
    execSync(`npm install -g "${context.extensionPath}"`, { stdio: "ignore" });
    vscode.window.showInformationMessage(
      "BoltX: 'boltx' is now available in any terminal. Run 'boltx init' to set it up.",
    );
  } catch (err) {
    vscode.window.showWarningMessage(
      "BoltX: couldn't auto-install the 'boltx' terminal command. " +
        `Run "npm install -g ." from ${context.extensionPath} manually.`,
    );
  }
}

// Returns { provider, apiKey } or null if user cancels setup.
async function ensureConfigured() {
  let provider = extensionContext.globalState.get("boltx.provider");
  let apiKey = extensionContext.globalState.get("boltx.apiKey");

  if (provider && apiKey) return { provider, apiKey };

  provider = await vscode.window.showQuickPick(PROVIDERS, {
    title: "BoltX ⚡ — Select AI Provider",
    placeHolder: "Choose which provider powers BoltX",
    ignoreFocusOut: true,
  });
  if (!provider) {
    vscode.window.showErrorMessage(
      "BoltX: setup cancelled. Run BoltX again to configure.",
    );
    return null;
  }

  apiKey = await vscode.window.showInputBox({
    title: "BoltX ⚡ — API Key Setup",
    prompt: `Enter your ${provider} API key`,
    placeHolder: "paste key here",
    password: true,
    ignoreFocusOut: true,
  });
  if (!apiKey) {
    vscode.window.showErrorMessage(
      "BoltX: no API key provided. Run BoltX again to configure.",
    );
    return null;
  }

  await extensionContext.globalState.update("boltx.provider", provider);
  await extensionContext.globalState.update("boltx.apiKey", apiKey);

  return { provider, apiKey };
}

async function reviewFiles(session) {
  const { files, basePath } = session;
  const results = [];

  if (!fs.existsSync(REVIEW_DIR)) fs.mkdirSync(REVIEW_DIR, { recursive: true });

  for (const file of files) {
    const realPath = path.join(basePath, file.path);
    const exists = fs.existsSync(realPath);

    if (!exists) {
      const dir = path.dirname(realPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(realPath, file.content, "utf8");
      results.push({ path: file.path, status: "created" });
      continue;
    }

    const existingContent = fs.readFileSync(realPath, "utf8");
    if (existingContent === file.content) {
      results.push({ path: file.path, status: "no-change" });
      continue;
    }

    const tempPath = writeTempFile(file.path, file.content);
    const originalUri = vscode.Uri.file(realPath);
    const newUri = vscode.Uri.file(tempPath);

    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUri,
      newUri,
      `BoltX: ${file.path} (left = current, right = incoming)`,
    );

    const choice = await vscode.window.showQuickPick(
      [
        {
          label: "$(check) Accept",
          description: `apply changes to ${file.path}`,
          value: "Accept",
        },
        {
          label: "$(close) Skip",
          description: `keep current ${file.path}`,
          value: "Skip",
        },
      ],
      {
        placeHolder: `BoltX ⚡  reviewing: ${file.path}`,
        ignoreFocusOut: true,
      },
    );

    if (choice && choice.value === "Accept") {
      fs.writeFileSync(realPath, file.content, "utf8");
      results.push({ path: file.path, status: "accepted" });
    } else {
      results.push({ path: file.path, status: "skipped" });
    }

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

  writeSession({ status: "done", basePath, install: session.install, results });
}

function startWatching() {
  if (sessionWatcher) clearInterval(sessionWatcher);
  sessionWatcher = setInterval(() => {
    const session = readSession();
    if (session && session.status === "ready") {
      clearInterval(sessionWatcher);
      sessionWatcher = null;
      reviewFiles(session);
    }
  }, 500);
}

async function runBoltx(context) {
  const creds = await ensureConfigured();
  if (!creds) return;

  const { provider, apiKey } = creds;
  const cliPath = path.join(context.extensionPath, "boltx-cli.js");
  const isAlive =
    boltxTerminal && vscode.window.terminals.find((t) => t.name === "⚡ BoltX");

  const workspacePath = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : process.env.HOME || process.env.USERPROFILE;

  const env = {
    GEMINI_API_KEY: provider === "gemini" ? apiKey : "",
    OPENAI_API_KEY: provider === "openai" ? apiKey : "",
    DEEPSEEK_API_KEY: provider === "deepseek" ? apiKey : "",
    GROQ_API_KEY: provider === "groq" ? apiKey : "",
    BOLTX_PROVIDER: provider,
  };

  if (isAlive) {
    boltxTerminal.show();
    boltxTerminal.sendText(`node "${cliPath}"`);
  } else {
    boltxTerminal = vscode.window.createTerminal({
      name: "⚡ BoltX",
      cwd: workspacePath,
      env,
    });
    boltxTerminal.show();
    boltxTerminal.sendText(`node "${cliPath}"`);
  }

  startWatching();
}

function activate(context) {
  extensionContext = context;

  ensureGlobalCli(context);

  const runCmd = vscode.commands.registerCommand("boltx.run", () => {
    runBoltx(context);
  });

  const setKeyCmd = vscode.commands.registerCommand(
    "boltx.setApiKey",
    async () => {
      const provider = context.globalState.get("boltx.provider") || "gemini";
      const key = await vscode.window.showInputBox({
        title: "BoltX ⚡ — Update API Key",
        prompt: `Enter your ${provider} API key`,
        password: true,
        ignoreFocusOut: true,
      });
      if (key) {
        await context.globalState.update("boltx.apiKey", key);
        vscode.window.showInformationMessage("BoltX: API key updated.");
      }
    },
  );

  const setProviderCmd = vscode.commands.registerCommand(
    "boltx.setProvider",
    async () => {
      const provider = await vscode.window.showQuickPick(PROVIDERS, {
        placeHolder: "Select AI provider",
        ignoreFocusOut: true,
      });
      if (provider) {
        await context.globalState.update("boltx.provider", provider);
        await context.globalState.update("boltx.apiKey", null);
        vscode.window.showInformationMessage(
          `BoltX: Provider set to ${provider}. Run BoltX to enter your API key.`,
        );
      }
    },
  );

  vscode.window.onDidCloseTerminal((terminal) => {
    if (terminal.name === "⚡ BoltX") boltxTerminal = null;
  });

  context.subscriptions.push(runCmd, setKeyCmd, setProviderCmd);
}

function deactivate() {
  if (sessionWatcher) clearInterval(sessionWatcher);
}

module.exports = { activate, deactivate };
