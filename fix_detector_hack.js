const fs = require('fs');
const path = 'lib/ai/intent/detector.ts';
let code = fs.readFileSync(path, 'utf8');

// The hacky hardcoded strings lines are 214 to 228
const lines = code.split('\n');
const start = 213; // line 214 is index 213
const end = 227;

const cleanLines = [
  ...lines.slice(0, start),
  ...lines.slice(end + 1)
];

// But wait, the previous code block might have been using these to pass tests. We already improved `matchPattern` previously! Let's just remove them.
fs.writeFileSync(path, cleanLines.join('\n'), 'utf8');
