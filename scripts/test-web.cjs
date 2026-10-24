/** Built web application, real browser/IndexedDB, simulated EEG only. */
const { chromium, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (file === root) file = path.join(root, 'index.html');
    let content;
    try {
      content = await fs.readFile(file);
    } catch {
      if (path.extname(pathname)) {
        res.writeHead(404);
        res.end();
        return;
      }
      file = path.join(root, 'index.html');
      content = await fs.readFile(file);
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end();
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        acceptDownloads: true,
      });
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(url);
        await expect(page.getByText('Buscar Muse', { exact: true })).toBeVisible();
        await page.getByText('Modo Simulador', { exact: true }).click();
        await expect(
          page.getByText('Simulación: estos datos no vienen de una diadema', { exact: true }),
        ).toBeVisible();
        await page.getByText('Grabaciones', { exact: true }).click();
        await page.getByRole('button', { name: 'Iniciar Grabación', exact: true }).click();
        await page.getByText('+M1', { exact: true }).click();
        await expect(page.getByRole('button', { name: /^REC / })).toBeVisible();
        await page.waitForTimeout(1200);
        await page.getByRole('button', { name: /^REC / }).click();
        await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(1);
        await page.reload(); // Actual IndexedDB persistence, not retained React memory.
        await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(1);
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Exportar CSV' }).click();
        const download = await downloaded,
          csv = await fs.readFile(await download.path(), 'utf8');
        assert(csv.startsWith('received_at_utc,received_monotonic_ms,'));
        assert(csv.includes(',simulation,eeg,'));
        assert(csv.includes(',M1'));
        assert(csv.trim().split('\n').length > 12);
        page.once('dialog', (dialog) => dialog.accept());
        await page.getByLabel('Eliminar grabación', { exact: true }).click();
        await expect(page.getByText('No hay grabaciones todavía', { exact: true })).toBeVisible();
        assert.deepEqual(errors, []);
        console.log(
          `Web ${width}px: simulador, grabación, marcador, persistencia, CSV y borrado OK.`,
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
