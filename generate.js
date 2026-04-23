import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI args:  --output logo.png  --width 1920  --height 1080  --timeout 10000
const args = process.argv.slice(2);
const get = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };

const output  = get('--output',  'logo.png');
const width   = parseInt(get('--width',  '1920'));
const height  = parseInt(get('--height', '1080'));
const timeout = parseInt(get('--timeout', '10000'));

// Minimal static file server
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
    const file = path.join(dir, req.url === '/' ? 'index.html' : req.url);
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
        res.end(data);
    });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browser = await puppeteer.launch({
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-gl=swiftshader',        // software WebGL — no GPU needed
        '--ignore-gpu-blocklist',
        '--enable-webgl',
    ],
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction('window.sceneReady === true', { timeout });

await page.screenshot({ path: output, omitBackground: true });
console.log(`Saved ${output} (${width}x${height})`);

await browser.close();
server.close();
