// npm run build: checks the content, bundles src/ with esbuild and copies public/ and content/ into dist/.
// npm run serve: same, then serves dist/ on http://localhost:8080.
import { build } from 'esbuild';
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { checkContent } from './tools/check-content.mjs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const dist = 'dist';
const BUDGET_MB = 15;

const problems = checkContent();
if (problems.length) process.exit(1);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'content'), { recursive: true });
cpSync('public', dist, { recursive: true });
for (const f of readdirSync('content')) if (/^grade\d\.json$/.test(f)) cpSync(join('content', f), join(dist, 'content', f));

await build({
  entryPoints: { game: 'src/game/brawl.js', preview: 'src/preview.js', charlab: 'src/charlab.js' }, bundle: true, format: 'esm', minify: true, splitting: true, outdir: dist,
  entryNames: '[name]', chunkNames: 'chunks/[name]-[hash]', target: ['es2020', 'safari15'], legalComments: 'none', charset: 'utf8',
  banner: { js: `/* SnowPax by Mr. Saymaz v${version}. three.js (MIT) by the three.js authors. */` },
});
for (const file of ['index.html', 'preview.html']) {
  const path = join(dist, file);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('{{VERSION}}', version));
}

const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dist);
const total = files.reduce((n, f) => n + statSync(f).size, 0);
const mb = (total / 1048576).toFixed(2);
console.log(`Built v${version}: ${files.length} files, ${mb} MB in dist/ (budget ${BUDGET_MB} MB).`);
if (total > BUDGET_MB * 1048576) { console.error('Download budget exceeded.'); process.exit(1); }

if (process.argv.includes('--serve')) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
  const port = Number(process.env.PORT) || 8080;
  createServer((req, res) => {
    const path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    try { const body = readFileSync(path); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end('Not found'); }
  }).listen(port, () => console.log(`Serving http://localhost:${port}`));
}
