// Gathers every apps/<name>/dist into one site: dist/<name>/..., plus a shared env.js and _headers.
// One Cloudflare Pages project (or one nginx container) then serves all mini apps:
//   https://<host>/garden/   https://<host>/lunar/
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const out = join(root, 'dist')
rmSync(out, { recursive: true, force: true })
mkdirSync(out)

const apps = readdirSync(join(root, 'apps')).filter((n) => existsSync(join(root, 'apps', n, 'dist', 'index.html')))
for (const name of apps) {
  cpSync(join(root, 'apps', name, 'dist'), join(out, name), { recursive: true })
  rmSync(join(out, name, 'env.js'), { force: true }) // apps load the shared ../env.js
}

// Build-time values become the defaults; Docker overwrites this file at container start.
const env = { HOST_ORIGINS: process.env.VITE_HOST_ORIGINS ?? process.env.HOST_ORIGINS ?? '' }
writeFileSync(join(out, 'env.js'), `window.__ENV__ = ${JSON.stringify(env)};\n`)

writeFileSync(join(out, '_headers'), [
  '/env.js', '  Cache-Control: no-store',
  '/*/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
  '',
].join('\n'))

writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>iemanchat mini apps</title>
<style>body{font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px;color:#222}a{display:block;padding:12px 0}</style>
<h1>iemanchat mini apps</h1><p>Open these from the app drawer in iemanchat.</p>
${apps.map((a) => `<a href="./${a}/">${a}</a>`).join('\n')}
`)
console.log(`collected: ${apps.join(', ')} → dist/`)
