const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { callAI } = require("./ai");
const { track } = require("./telemetry");
const { loadConfig } = require("./config");

const IGNORE = [
  ".env",
  ".env.local",
  ".env.production",
  ".gitignore",
  ".git",
  "node_modules",
  "package-lock.json",
  "yarn.lock",
  ".DS_Store",
  "dist",
  "build",
  ".next",
  ".bolt-dev",
  ".vscode",
];

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

function walkDir(dir, base = dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath, base));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

async function selectFiles(fileTree, description) {
  const prompt = `Output JSON array only. No markdown. No explanation.
Return file paths that match: "${description}"
From this list:
${fileTree.join("\n")}
Rules: never include .env, node_modules, lock files.`;

  const raw = await callAI(prompt);
  return JSON.parse(raw);
}

function formatFiles(files, basePath) {
  let output = "";
  for (const filePath of files) {
    const fullPath = path.join(basePath, filePath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    const ext = path.extname(filePath).replace(".", "") || "txt";
    output += `### ${filePath}\n`;
    output += `\`\`\`${ext}\n`;
    output += content;
    output += `\n\`\`\`\n\n`;
  }
  return output.trim();
}

function copyToClipboard(text) {
  const platform = process.platform;
  const tmpFile = require("os").tmpdir() + "/bolt-share.txt";
  fs.writeFileSync(tmpFile, text, "utf8");

  let result;

  if (platform === "darwin") {
    result = spawnSync("pbcopy", [], {
      input: text,
      encoding: "utf8",
    });
  } else if (platform === "win32") {
    result = spawnSync("clip", [], {
      input: text,
      encoding: "utf8",
      shell: true,
    });
  } else {
    const fd = fs.openSync(tmpFile, "r");

    result = spawnSync("wl-copy", [], {
      stdio: [fd, "ignore", "ignore"],
      env: { ...process.env },
    });

    if (result.error) {
      result = spawnSync("xclip", ["-selection", "clipboard"], {
        stdio: [fd, "ignore", "ignore"],
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" },
      });
    }

    if (result.error) {
      result = spawnSync("xsel", ["--clipboard", "--input"], {
        stdio: [fd, "ignore", "ignore"],
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" },
      });
    }

    fs.closeSync(fd);
  }

  try {
    fs.unlinkSync(tmpFile);
  } catch (_) {}

  if (result && result.error) {
    throw new Error(`clipboard failed on ${platform}: ${result.error.message}`);
  }
}

async function shareFlow(basePath, ask) {
  const config = loadConfig();
  let fileTree;
  try {
    fileTree = walkDir(basePath);
  } catch (e) {
    console.log(c("red", `  !! could not read directory: ${e.message}`));
    return;
  }

  if (fileTree.length === 0) {
    console.log(c("red", "  !! no files found in this directory."));
    return;
  }

  console.log(c("dim", `\n>> found ${fileTree.length} file(s) in project.\n`));

  const shareAll = await ask(c("bold", ">> share all files? (y/n): "));
  console.log("");

  let selectedFiles;
  const isShareAll = shareAll.toLowerCase() === "y";

  if (isShareAll) {
    selectedFiles = fileTree;
  } else {
    console.log(c("bold", ">> describe which files you need:"));
    console.log(
      c("dim", '>> (e.g. "only route files" or "app.js and controllers")'),
    );
    const description = await ask(c("cyan", "> "));
    console.log("");

    let thinkIndex = 0;
    const thinkTaunts = [
      ">> bolt is reading your project...          ",
      ">> bolt is matching files...                ",
      ">> almost there, lazy dev...                ",
      ">> bolt works harder than you do...         ",
    ];

    const thinkTimer = setInterval(() => {
      process.stdout.write(
        c("dim", `\r  ${thinkTaunts[thinkIndex % thinkTaunts.length]}`),
      );
      thinkIndex++;
    }, 3000);
    process.stdout.write(c("dim", `\r  ${thinkTaunts[0]}`));

    try {
      selectedFiles = await selectFiles(fileTree, description);
      clearInterval(thinkTimer);
      process.stdout.write("\r" + " ".repeat(55) + "\r");
    } catch (err) {
      clearInterval(thinkTimer);
      process.stdout.write("\r" + " ".repeat(55) + "\r");
      console.log(c("red", `  !! ${err.message}`));
      await track("share_failed", {
        provider: config.provider,
        error: err.message,
      });
      return;
    }
  }

  if (!selectedFiles || selectedFiles.length === 0) {
    console.log(
      c(
        "red",
        "  !! bolt could not find matching files. try a different description.",
      ),
    );
    await track("share_failed", {
      provider: config.provider,
      error: "no_matching_files",
    });
    return;
  }

  console.log(c("green", `>> selected ${selectedFiles.length} file(s):`));
  selectedFiles.forEach((f) => console.log(c("dim", `   - ${f}`)));
  console.log("");

  const formatted = formatFiles(selectedFiles, basePath);

  try {
    copyToClipboard(formatted);
    console.log(c("bold", c("green", ">> done. copied to clipboard.")));
    console.log("");

    await track("share_complete", {
      provider: config.provider,
      totalProjectFiles: fileTree.length,
      sharedFilesCount: selectedFiles.length,
      allFilesShared: isShareAll,
    });
  } catch (e) {
    console.log(c("red", `  !! clipboard failed: ${e.message}`));
    console.log("");
    await track("share_failed", {
      provider: config.provider,
      error: `clipboard_error: ${e.message}`,
    });
  }
}

module.exports = { shareFlow };
