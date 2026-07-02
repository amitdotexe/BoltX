const vscode = require("vscode");
const path = require("path");
const { execSync } = require("child_process");

const PROVIDERS = ["gemini", "openai", "groq", "deepseek"];

let boltxTerminal = null;
let extensionContext = null;

function ensureGlobalCli(context) {
  const checkCmd =
    process.platform === "win32" ? "where boltx" : "command -v boltx";
  try {
    execSync(checkCmd, { stdio: "ignore" });
    return;
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

function deactivate() {}

module.exports = { activate, deactivate };
