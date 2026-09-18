import * as fs from 'fs';

const filePath = 'tests/ai-uat/ai-uat.test.ts';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import WebSocket from "ws"')) {
    content = 'import WebSocket from "ws";\n(global as any).WebSocket = WebSocket;\n' + content;
    fs.writeFileSync(filePath, content, 'utf8');
}
