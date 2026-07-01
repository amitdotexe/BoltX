const c = (color, text) => {
  const codes = { reset:"\x1b[0m", green:"\x1b[32m", cyan:"\x1b[36m", yellow:"\x1b[33m", red:"\x1b[31m", bold:"\x1b[1m", dim:"\x1b[2m" };
  return `${codes[color]}${text}${codes.reset}`;
};

const ITEMS = [
  { label: "scaffold", desc: "paste AI response → create files" },
  { label: "share",    desc: "copy your files → ready for AI"   },
];

function renderMenu(selected) {
  // move cursor up to overwrite previous render
  if (renderMenu._drawn) {
    process.stdout.write(`\x1b[${ITEMS.length}A`);
  }
  renderMenu._drawn = true;

  for (let i = 0; i < ITEMS.length; i++) {
    const item   = ITEMS[i];
    const cursor = i === selected ? c("cyan", " ❯ ") : "   ";
    const label  = i === selected
      ? c("bold", c("cyan", item.label.padEnd(10)))
      : c("dim",  item.label.padEnd(10));
    const desc   = c("dim", `— ${item.desc}`);
    process.stdout.write(`${cursor}${label} ${desc}\n`);
  }
}

function showMenu() {
  return new Promise((resolve) => {
    console.log(c("bold", ">> what do you want to do?\n"));

    let selected = 0;
    renderMenu(selected);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", function handler(key) {
      if (key === "\x1B[A") {
        // up arrow
        selected = (selected - 1 + ITEMS.length) % ITEMS.length;
        renderMenu(selected);
      } else if (key === "\x1B[B") {
        // down arrow
        selected = (selected + 1) % ITEMS.length;
        renderMenu(selected);
      } else if (key === "\r") {
        // enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        console.log("");
        resolve(ITEMS[selected].label);
      } else if (key === "\x03") {
        // ctrl+c
        process.exit();
      }
    });
  });
}

module.exports = { showMenu };
