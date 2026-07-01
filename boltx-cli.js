#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");
const { extractFiles } = require("./lib/extract");
const { writeSession, watchSession, clearSession } = require("./lib/session");
const { drawTable } = require("./lib/table");
const { shareFlow } = require("./lib/share");
const { track } = require("./lib/telemetry");
const { loadConfig, saveConfig } = require("./lib/config");

const c = (color, text) => {
  const codes = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
  };
  return `${codes[color]}${text}${codes.reset}`;
};

const TAUNTS = [
  ">> boltx is working... you just sit there.          ",
  ">> still running. go drink some water, lazy dev.    ",
  ">> boltx does not complain. unlike you.              ",
  ">> files are being planned. relax.                  ",
  ">> boltx has read your response 3 times. have you?   ",
  ">> no errors yet. impressive for your code.          ",
  ">> boltx is faster than your last git push.          ",
  ">> processing... unlike your brain at 2am.           ",
];

function startTaunting() {
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(c("dim", `\r  ${TAUNTS[i % TAUNTS.length]}`));
    i++;
  }, 3000);
  return timer;
}

function printSep() {
  console.log(c("dim", "────────────────────────────────────────────"));
}

function printHeader(badge) {
  console.log("");
  process.stdout.write(c("yellow", c("bold", "⚡ boltx")));
  if (badge) process.stdout.write("  " + c("dim", `[${badge}]`));
  console.log("");
  printSep();
  console.log("");
}

function showArrowMenu(items, selectedIndex) {
  if (showArrowMenu._drawn) {
    process.stdout.write(`\x1b[${items.length}A`);
  }
  showArrowMenu._drawn = true;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isSelected = i === selectedIndex;
    const isDisabled = item.disabled;

    const cursor = isSelected ? c("yellow", " ❯ ") : "   ";

    let label;
    if (isDisabled) {
      label = c("dim", item.label.padEnd(24)) + c("dim", item.desc);
    } else if (isSelected) {
      label =
        c("bold", c("yellow", item.label.padEnd(24))) + c("dim", item.desc);
    } else {
      label = c("dim", item.label.padEnd(24)) + c("dim", item.desc);
    }

    process.stdout.write(`${cursor}${label}\n`);
  }
}

function arrowSelect(items) {
  return new Promise((resolve) => {
    let selected = 0;
    showArrowMenu._drawn = false;
    showArrowMenu(items, selected);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", function handler(key) {
      if (key === "\x1B[A") {
        do {
          selected = (selected - 1 + items.length) % items.length;
        } while (items[selected].disabled);
        showArrowMenu(items, selected);
      } else if (key === "\x1B[B") {
        do {
          selected = (selected + 1) % items.length;
        } while (items[selected].disabled);
        showArrowMenu(items, selected);
      } else if (key === "\r") {
        if (items[selected].disabled) return;
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        console.log("");
        resolve(items[selected].value);
      } else if (key === "\x03") {
        process.exit();
      }
    });
  });
}

// Bordered, masked input box with a blinking cursor — used for API key entry.
function boxedInput(label, { mask = false, width = 46 } = {}) {
  return new Promise((resolve) => {
    let value = "";
    let showCursor = true;
    const innerWidth = width - 2;

    const top = "  ┌" + "─".repeat(width) + "┐";
    const bottom = "  └" + "─".repeat(width) + "┘";

    function contentLine() {
      const shown = mask ? "*".repeat(value.length) : value;
      const cursorChar = showCursor ? "█" : " ";
      let display = shown + cursorChar;
      if (display.length > innerWidth - 1) {
        display = display.slice(-(innerWidth - 1));
      }
      const padded = display.padEnd(innerWidth - 1, " ");
      return "  │ " + padded + "│";
    }

    // Initial draw: label, top, content, bottom, margin-bottom.
    console.log(c("cyan", `  ${label}`));
    console.log(c("dim", top));
    console.log(c("dim", contentLine()));
    console.log(c("dim", bottom));
    console.log(""); // margin-bottom

    process.stdout.write("\x1b[?25l"); // hide the real terminal cursor

    function redraw() {
      process.stdout.write("\x1b[3A"); // up to content line
      process.stdout.write("\r\x1b[2K"); // clear it
      process.stdout.write(c("dim", contentLine()));
      process.stdout.write("\x1b[3B\r"); // back down to below the box
    }

    const blinkTimer = setInterval(() => {
      showCursor = !showCursor;
      redraw();
    }, 500);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function finish() {
      clearInterval(blinkTimer);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", handler);
      showCursor = false;
      redraw();
      process.stdout.write("\x1b[?25h"); // restore real cursor
      resolve(value.trim());
    }

    function handler(chunk) {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          finish();
          return;
        } else if (ch === "\x03") {
          process.stdout.write("\x1b[?25h");
          process.exit();
        } else if (ch === "\x7f" || ch === "\b") {
          value = value.slice(0, -1);
        } else if (ch >= " ") {
          value += ch;
        }
      }
      showCursor = true; // keep cursor solid while actively typing
      redraw();
    }

    process.stdin.on("data", handler);
  });
}

async function runInit() {
  console.log(c("bold", "\n⚡ boltx init\n"));

  const provider = await arrowSelect([
    { label: "gemini", desc: "  Google Gemini", value: "gemini" },
    { label: "openai", desc: "  OpenAI GPT", value: "openai" },
    { label: "deepseek", desc: "  DeepSeek", value: "deepseek" },
    { label: "groq", desc: "  Groq", value: "groq" },
  ]);

  console.log("");
  const apiKey = await boxedInput(`${provider} api key:`, { mask: true });

  if (!apiKey) {
    console.log(c("red", "\n  !! no api key entered. aborted.\n"));
    process.exit(1);
  }

  saveConfig(provider, apiKey);
  console.log(c("green", `\n✓ saved.`));
  console.log(c("dim", `  run "boltx" to start.`));
  console.log(
    c("dim", `  run "boltx init" again anytime to change provider or key.\n`),
  );
}

async function main() {
  clearSession();

  const config = loadConfig();
  if (!config) {
    console.log("");
    console.log(c("red", "  !! no API key configured."));
    console.log(c("dim", "  run 'boltx init' to set up.\n"));
    process.exit(1);
  }

  console.log("");
  console.log(c("yellow", c("bold", "⚡ boltx")) + "  " + c("dim", "v1.0.0"));
  printSep();
  console.log("");
  console.log(c("bold", "what do you want to do?"));
  console.log("");

  const choice = await arrowSelect([
    {
      label: "scaffold",
      desc: "  paste AI response → write files to disk",
      value: "scaffold",
    },
    {
      label: "share",
      desc: "  copy your codebase → ready for any AI",
      value: "share",
    },
  ]);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

  if (choice === "share") {
    const basePath = process.cwd();
    await shareFlow(basePath, ask);
    rl.close();
    process.exit(0);
  }

  console.log("");
  printSep();
  console.log("");
  console.log(c("bold", "paste your AI response below."));
  console.log(c("dim", "type END on a new line when done."));
  console.log("");

  let pastedText = "";
  process.stdout.write(c("cyan", "  › "));

  await new Promise((resolve) => {
    rl.on("line", (line) => {
      if (line.trim() === "END") {
        rl.pause();
        resolve();
      } else {
        pastedText += line + "\n";
        process.stdout.write(c("cyan", "  › "));
      }
    });
  });

  console.log("");
  printSep();
  console.log("");
  console.log(c("yellow", "⟳ extracting files..."));
  console.log("");

  const tauntTimer = startTaunting();
  let result;
  let attempts = 0;

  await track("scaffold_started", { provider: config.provider });

  while (attempts < 3) {
    try {
      result = await extractFiles(pastedText);
      break;
    } catch (err) {
      attempts++;
      if (err.message.includes("ETIMEDOUT") && attempts < 3) {
        await track("api_timeout", {
          provider: config.provider,
          attempt: attempts,
        });
        process.stdout.write(
          c("yellow", `\r  >> timeout. retrying... (${attempts}/3)    `),
        );
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      clearInterval(tauntTimer);
      process.stdout.write("\r");
      console.log(c("red", `\n  !! ${err.message}`));
      await track("scaffold_failed", {
        provider: config.provider,
        error: err.message,
      });
      rl.close();
      process.exit(0);
    }
  }

  clearInterval(tauntTimer);
  process.stdout.write("\r" + " ".repeat(55) + "\r");

  if (!result.files || result.files.length === 0) {
    console.log(
      c("red", "  !! boltx found no files. was that even a code response?"),
    );
    await track("scaffold_failed", {
      provider: config.provider,
      error: "empty_file_payload",
    });
    rl.close();
    process.exit(0);
  }

  console.log(c("green", `✓ found ${result.files.length} file(s):`));
  console.log("");
  result.files.forEach((f) => console.log(c("dim", `    ${f.path}`)));
  console.log("");
  printSep();
  console.log("");

  rl.resume();

  const mode = await arrowSelect([
    { label: "new project", desc: "  create a folder", value: "n" },
    { label: "current dir", desc: "  write files here", value: "c" },
  ]);

  console.log("");

  let basePath;
  if (mode === "n") {
    const projectName = await ask(c("cyan", "  › project name: "));
    basePath = path.join(process.cwd(), projectName);
    fs.mkdirSync(basePath, { recursive: true });
    console.log("");
  } else {
    basePath = process.cwd();
    console.log(c("dim", `  target: ${basePath}\n`));
  }

  writeSession({
    status: "ready",
    basePath,
    install: result.install || null,
    files: result.files,
  });

  console.log(c("yellow", "⟳ review changes in VS Code..."));
  console.log(c("dim", "  accept or skip each file in the editor."));
  console.log("");

  const session = await new Promise((resolve) => {
    const watcher = watchSession((s) => {
      if (s.status === "done") {
        clearInterval(watcher);
        resolve(s);
      }
    });
  });

  drawTable(session.results);

  const acceptedCount = session.results.filter(
    (r) => r.status === "accepted" || r.status === "created",
  ).length;
  const skippedCount = session.results.filter(
    (r) => r.status === "skipped",
  ).length;

  await track("scaffold_complete", {
    provider: config.provider,
    fileCount: session.results.length,
    acceptedCount,
    skippedCount,
    isNewProject: mode === "n",
  });

  if (session.install) {
    rl.resume();
    const run = await arrowSelect([
      { label: "yes", desc: `  run "${session.install}"`, value: "y" },
      { label: "no", desc: "  i'll do it myself", value: "n" },
    ]);
    if (run === "y") {
      console.log(c("yellow", "\n⟳ installing...\n"));
      try {
        execSync(session.install, { cwd: basePath, stdio: "inherit" });
        console.log(c("green", "\n✓ installed."));
        await track("install_command_success", { command: session.install });
      } catch (execErr) {
        console.log(c("red", "  !! install failed."));
        await track("install_command_failed", {
          command: session.install,
          error: execErr.message,
        });
      }
    }
  }

  console.log("");
  printSep();
  console.log("");
  console.log(c("green", c("bold", "✓ boltx done.")));
  console.log(c("dim", `  files at  ${basePath}`));
  console.log("");

  rl.close();
  process.exit(0);
}

if (process.argv[2] === "init") {
  runInit();
} else {
  main();
}
