const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".config", "boltx");
const CLI_CONFIG_FILE = path.join(CONFIG_DIR, "cli-config.json");

function loadConfig() {
  const envProvider = process.env.BOLTX_PROVIDER;
  if (envProvider) {
    const apiKey = process.env[`${envProvider.toUpperCase()}_API_KEY`];
    if (apiKey) return { provider: envProvider, apiKey };
  }

  if (fs.existsSync(CLI_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CLI_CONFIG_FILE, "utf8"));
      if (data.provider && data.apiKey) return data;
    } catch {}
  }

  return null;
}

function saveConfig(provider, apiKey) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CLI_CONFIG_FILE,
    JSON.stringify({ provider, apiKey: apiKey.trim() }, null, 2),
    "utf8",
  );
  fs.chmodSync(CLI_CONFIG_FILE, 0o600);
}

module.exports = { loadConfig, saveConfig };
