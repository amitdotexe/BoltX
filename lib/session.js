const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(require("os").tmpdir(), "boltx-session.json");
const REVIEW_DIR = path.join(require("os").tmpdir(), "boltx-review");

function writeSession(data) {
  fs.writeFileSync(SESSION_PATH, JSON.stringify(data, null, 2), "utf8");
}

function readSession() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  return JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
}

function clearSession() {
  if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
  if (fs.existsSync(REVIEW_DIR)) fs.rmSync(REVIEW_DIR, { recursive: true });
}

function watchSession(callback) {
  const interval = setInterval(() => {
    const session = readSession();
    if (session) callback(session);
  }, 500);
  return interval;
}

module.exports = {
  writeSession,
  readSession,
  clearSession,
  watchSession,
  SESSION_PATH,
  REVIEW_DIR,
};
