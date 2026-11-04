/* global document, innerWidth -- Used only inside Playwright browser evaluations. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { log } from 'node:console';
import { chromium } from '@playwright/test';

const directory = new URL('./', import.meta.url);
const workspace = new URL('../../../', import.meta.url);
const files = new Map([['/', new URL('reference.html', directory)]]);
for (const family of ['be-vietnam-pro', 'lora']) {
  for (const weight of [400, 600]) {
    for (const subset of ['latin', 'vietnamese']) {
      const filename = family + '-' + subset + '-' + weight + '-normal.woff2';
      files.set(
        '/fonts/' + filename,
        new URL('node_modules/@fontsource/' + family + '/files/' + filename, workspace),
      );
    }
  }
}
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = files.get(pathname);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(file);
    response.setHeader(
      'Content-Type',
      pathname.startsWith('/fonts/') ? 'font/woff2' : 'text/html; charset=utf-8',
    );
    response.end(data);
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const port = server.address().port;
  for (const [view, width, height, filename] of [
    ['desktop', 1600, 1100, 'desktop_target.png'],
    ['mobile', 430, 1280, 'mobile_target.png'],
    ['states', 1440, 1100, 'relationship_states.png'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:' + port + '/?view=' + view);
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewport: innerWidth,
    }));
    if (layout.width > width)
      throw new Error(view + ' overflows horizontally: ' + JSON.stringify(layout));
    const missingFonts = await page.evaluate(
      () => [...document.fonts].filter((font) => font.status === 'error').length,
    );
    if (missingFonts) throw new Error('Local font failed to load');
    const path = fileURLToPath(new URL(filename, directory));
    await page.screenshot({ path, fullPage: true });
    log(filename + ': ' + JSON.stringify(layout));
  }
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
