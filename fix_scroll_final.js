const fs = require('fs');
let code = fs.readFileSync('components/home/SevaReceipt.tsx', 'utf8');
code = code.replace(
  '      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">',
  '      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">'
);
fs.writeFileSync('components/home/SevaReceipt.tsx', code);
