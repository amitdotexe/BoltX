const https = require("https");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

const ANALYTICS_URL = "https://bolt-analytics.onrender.com/capture";
const CONFIG_DIR = path.join(os.homedir(), ".config", "boltx");
const CONFIG_FILE = path.join(CONFIG_DIR, "telemetry.json");
const QUEUE_FILE = path.join(CONFIG_DIR, "offline-queue.jsonl");

function getAnonymousId() {
  try {
    if (!fs.existsSync(CONFIG_DIR))
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      if (data.anonymousId) return data.anonymousId;
    }
    const rawSeed = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    const generatedId = crypto
      .createHash("sha256")
      .update(rawSeed)
      .digest("hex")
      .substring(0, 16);
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ anonymousId: generatedId }, null, 2),
    );
    return generatedId;
  } catch {
    return "fallback_user_" + crypto.randomBytes(4).toString("hex");
  }
}

function saveToQueue(payload) {
  try {
    if (!fs.existsSync(CONFIG_DIR))
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.appendFileSync(QUEUE_FILE, JSON.stringify(payload) + "\n");
  } catch {}
}

function sendRequest(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const url = new URL(ANALYTICS_URL);
    const lib = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = lib.request(options, (res) => {
      req.clearTimeout();
      resolve(res.statusCode === 200);
    });

    req.on("error", () => resolve(false));

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

async function flushQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return;
  const lines = fs
    .readFileSync(QUEUE_FILE, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  if (lines.length === 0) return;

  const remaining = [];
  for (const line of lines) {
    try {
      const payload = JSON.parse(line);
      const ok = await sendRequest(payload);
      if (!ok) remaining.push(line);
    } catch {
      remaining.push(line);
    }
  }

  if (remaining.length === 0) {
    fs.unlinkSync(QUEUE_FILE);
  } else {
    fs.writeFileSync(QUEUE_FILE, remaining.join("\n") + "\n");
  }
}

async function track(eventName, properties = {}) {
  const payload = {
    event: eventName,
    properties: {
      distinct_id: getAnonymousId(),
      os: os.platform(),
      os_version: os.release(),
      ...properties,
    },
    timestamp: new Date().toISOString(),
  };

  // Try flushing any queued events first (silent)
  await flushQueue();

  const ok = await sendRequest(payload);
  if (!ok) saveToQueue(payload);
}

module.exports = { track };
