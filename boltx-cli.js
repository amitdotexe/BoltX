#!/usr/bin/env node
const readline = require("readline");
const { shareFlow } = require("./lib/share");
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

function printSep() {
  console.log(c("dim", "────────────────────────────────────────────"));
}

function showArrowMenu(items, selectedIndex) {
  if (showArrowMenu._drawn) {
    process.stdout.write(`\x1b[${items.length}A`);
  }
  showArrowMenu._drawn = true;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isSelected = i === selectedIndex;
    const cursor = isSelected ? c("yellow", " ❯ ") : "   ";
    const label = isSelected
      ? c("bold", c("yellow", item.label.padEnd(24))) + c("dim", item.desc)
      : c("dim", item.label.padEnd(24)) + c("dim", item.desc);
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
        selected = (selected - 1 + items.length) % items.length;
        showArrowMenu(items, selected);
      } else if (key === "\x1B[B") {
        selected = (selected + 1) % items.length;
        showArrowMenu(items, selected);
      } else if (key === "\r") {
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
      return "  │ " + display.padEnd(innerWidth - 1, " ") + "│";
    }

    console.log(c("cyan", `  ${label}`));
    console.log(c("dim", top));
    console.log(c("dim", contentLine()));
    console.log(c("dim", bottom));
    console.log("");

    process.stdout.write("\x1b[?25l");

    function redraw() {
      process.stdout.write("\x1b[3A");
      process.stdout.write("\r\x1b[2K");
      process.stdout.write(c("dim", contentLine()));
      process.stdout.write("\x1b[3B\r");
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
      process.stdout.write("\x1b[?25h");
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
      showCursor = true;
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
  const config = loadConfig();
  if (!config) {
    console.log("");
    console.log(c("red", "  !! no API key configured."));
    console.log(c("dim", "  run 'boltx init' to set up.\n"));
    process.exit(1);
  }

  console.log("");
  console.log(
    c("yellow", c("bold", "⚡ boltx")) +
      "  " +
      c("dim", `v${require("./package.json").version}`),
  );
  printSep();
  console.log("");
  console.log(c("bold", "what do you want to share?"));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

  const basePath = process.cwd();
  await shareFlow(basePath, ask);
  rl.close();
  process.exit(0);
}

if (process.argv[2] === "init") {
  runInit();
} else {
  main();
}
