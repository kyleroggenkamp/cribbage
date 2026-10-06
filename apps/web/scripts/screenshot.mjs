/**
 * Screenshot the /preview page from the static export at phone width, so the
 * themed screens can be reviewed without a running backend.
 *   node scripts/screenshot.mjs
 * Requires `npm run build` first (serves ./out). Chromium is the pre-installed
 * one (PLAYWRIGHT_BROWSERS_PATH).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const OUT = join(process.cwd(), 'out');
const PORT = 4321;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    let file = join(OUT, p);
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

const outDir = process.argv[2] ?? '/tmp';

await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/preview`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.screenshot({ path: join(outDir, 'preview-full.png'), fullPage: true });

const total = await page.evaluate(() => document.body.scrollHeight);
const sections = await page.locator('h3').all();
for (let i = 0; i < sections.length; i++) {
  try {
    const box = await sections[i].locator('xpath=..').boundingBox();
    if (!box) continue;
    const height = Math.max(1, Math.min(box.height, total - box.y));
    await page.screenshot({
      path: join(outDir, `preview-${i + 1}.png`),
      clip: { x: 0, y: box.y, width: 390, height },
    });
  } catch (e) {
    console.error(`section ${i + 1} skipped:`, e instanceof Error ? e.message : e);
  }
}

await browser.close();
server.close();
console.error('screenshots written to', outDir);
