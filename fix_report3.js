const fs = require('fs');

const path = 'COMPLETION_REPORT.md';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'Safe `.split().join()` logic and strict structural URL verification for markdown links now secure the HTML renderer against cross-site scripting (XSS).',
  'Removed `dangerouslySetInnerHTML` entirely from `MarkdownRenderer.tsx`. Safely parses strings into an array of React elements, processing bold, italics, headers, lists, and safe URL links natively within the component, fully remediating the XSS and ReDoS CodeQL findings.'
);

fs.writeFileSync(path, code, 'utf8');
