const { callAI } = require("./ai");

async function extractFiles(pastedText) {
  const prompt = `Output JSON only. No markdown. No explanation.
Schema: { "files": [{ "path": string, "content": string }], "install": string|null }
Rules: extract only code files. install = npm/pip command if package.json or requirements.txt exists, else null.
Input:
${pastedText}`;

  const raw = await callAI(prompt);
  return JSON.parse(raw);
}

module.exports = { extractFiles };
