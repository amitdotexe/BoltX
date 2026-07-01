const https = require("https");
const { loadConfig } = require("./config");

const PROVIDERS = {
  gemini: {
    hostname: "generativelanguage.googleapis.com",
    path: (key) => `/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    buildBody: (prompt) =>
      JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    parseResponse: (parsed) => {
      if (parsed.error)
        throw new Error(
          `bolt error ${parsed.error.code}: ${parsed.error.message}`,
        );
      return parsed.candidates[0].content.parts[0].text.trim();
    },
  },

  openai: {
    hostname: "api.openai.com",
    path: () => "/v1/chat/completions",
    buildBody: (prompt) =>
      JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    parseResponse: (parsed) => {
      if (parsed.error) throw new Error(`bolt error: ${parsed.error.message}`);
      return parsed.choices[0].message.content.trim();
    },
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },

  deepseek: {
    hostname: "api.deepseek.com",
    path: () => "/v1/chat/completions",
    buildBody: (prompt) =>
      JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    parseResponse: (parsed) => {
      if (parsed.error) throw new Error(`bolt error: ${parsed.error.message}`);
      return parsed.choices[0].message.content.trim();
    },
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },

  groq: {
    hostname: "api.groq.com",
    path: () => "/openai/v1/chat/completions",
    buildBody: (prompt) =>
      JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    parseResponse: (parsed) => {
      if (parsed.error) throw new Error(`bolt error: ${parsed.error.message}`);
      return parsed.choices[0].message.content.trim();
    },
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

function callAI(prompt) {
  const config = loadConfig();
  if (!config)
    throw new Error("no API key configured. Run Bolt from VS Code to set up.");

  const provider = PROVIDERS[config.provider];
  const key = config.apiKey;

  if (!provider) throw new Error(`unknown provider: ${config.provider}`);

  const body = provider.buildBody(prompt);
  const extraHeaders = provider.authHeader ? provider.authHeader(key) : {};

  return new Promise((resolve, reject) => {
    const options = {
      hostname: provider.hostname,
      path: provider.path(key),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text = provider.parseResponse(parsed);
          const clean = text.replace(/^```json|^```|```$/gm, "").trim();
          resolve(clean);
        } catch (e) {
          reject(new Error("bolt could not parse response: " + e.message));
        }
      });
    });

    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error("ETIMEDOUT"));
    });

    req.on("error", (err) =>
      reject(new Error("bolt network error: " + JSON.stringify(err))),
    );
    req.write(body);
    req.end();
  });
}

module.exports = { callAI };
