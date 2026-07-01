const c = (color, text) => {
  const codes = { reset:'\x1b[0m', green:'\x1b[32m', cyan:'\x1b[36m', yellow:'\x1b[33m', red:'\x1b[31m', bold:'\x1b[1m', dim:'\x1b[2m' };
  return `${codes[color]}${text}${codes.reset}`;
};

function drawTable(results) {
  const colFile   = 45;
  const colStatus = 12;

  const line = '─'.repeat(colFile + colStatus + 5);

  console.log('');
  console.log(c('dim', `┌${'─'.repeat(colFile + 2)}┬${'─'.repeat(colStatus + 2)}┐`));
  console.log(c('dim', `│ ${'file'.padEnd(colFile)} │ ${'status'.padEnd(colStatus)} │`));
  console.log(c('dim', `├${'─'.repeat(colFile + 2)}┼${'─'.repeat(colStatus + 2)}┤`));

  for (const r of results) {
    const fileTrunc = r.path.length > colFile
      ? '...' + r.path.slice(-colFile + 3)
      : r.path.padEnd(colFile);

    let statusColored;
    if (r.status === 'created')  statusColored = c('green',  '+ created   ');
    if (r.status === 'accepted') statusColored = c('yellow', '~ updated   ');
    if (r.status === 'skipped')  statusColored = c('dim',    '- skipped   ');
    if (r.status === 'no-change') statusColored = c('dim',   '= no change ');

    console.log(`│ ${fileTrunc} │ ${statusColored} │`);
  }

  console.log(c('dim', `└${'─'.repeat(colFile + 2)}┴${'─'.repeat(colStatus + 2)}┘`));
  console.log('');
}

module.exports = { drawTable };