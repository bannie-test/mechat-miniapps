# iemanchat mini apps

Mini apps that open inside [iemanchat](https://github.com/bannie-test/mechat) (app drawer → sandboxed iframe).
They use the chat's Supabase database with the signed-in user's own session, so RLS applies exactly as in the chat.

```
apps/garden/           Little Garden — water a plant daily, it grows and gives seeds
apps/lunar/            Lịch âm — Vietnamese lunar calendar, holidays, personal lunar dates
apps/*/sql/            Each app's tables/RPCs (run once in Supabase → SQL Editor)
packages/miniapp-sdk/  connect() + protocol (protocol.ts is a copy of the chat repo's — keep identical)
scripts/collect.mjs    Combines every apps/*/dist into dist/<app>/ → one site for all apps
```

## How a mini app talks to the chat

```ts
const app = await connect({ allowedOrigins: ['https://iemanchat.pages.dev'] })
const db = createClient(app.init.supabase.url, app.init.supabase.anonKey, {
  accessToken: async () => app.accessToken,           // host refreshes it automatically
})
app.init.user        // who is using it
app.init.chatId      // chat it was opened from (null from the home screen)
app.locale / app.theme + onLocaleChange / onThemeChange
app.haptic('success'); app.close()
// Post into that chat as the user (same RLS as the chat app):
await db.from('messages').insert({ chat_id: app.init.chatId, sender_id: app.init.user.id, kind: 'text', content: 'hi' })
```

## Local development

```sh
pnpm install
pnpm dev:garden   # http://localhost:5174
pnpm dev:lunar    # http://localhost:5175 (calendar also works standalone, outside the chat)
pnpm typecheck && pnpm build   # → dist/garden/, dist/lunar/, dist/env.js
```
To try one inside the local chat app, temporarily point its row at the dev server:
`update public.mini_apps set url = 'http://localhost:5175/' where id = 'lunar';`

## Database

| File | Status |
|---|---|
| `apps/garden/sql/001_garden.sql` | applied (originally run from the chat repo) |
| `apps/lunar/sql/001_lunar.sql` | run once |

## Deploy

**Cloudflare Pages** — one project serves every app:

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Output directory | `dist` |
| Root directory | *(empty)* |
| Env vars | `NODE_VERSION=22`, `PNPM_VERSION=9.15.4`, `VITE_HOST_ORIGINS=https://iemanchat.pages.dev` |

Apps are then at `https://<project>.pages.dev/garden/` and `/lunar/`; set those URLs in `public.mini_apps`.

**Docker (VPS)**: `docker compose up -d --build` → `:8081/garden/`, `:8081/lunar/`.
`HOST_ORIGINS` (or `VITE_HOST_ORIGINS`) in `.env` is written to `env.js` at container start.

## Adding a mini app

1. `apps/<name>/` with `base: './'` in its Vite config and `<script src="../env.js">` in `index.html`.
2. Add its `package.json` line to the `Dockerfile`.
3. Tables/RPCs in `apps/<name>/sql/001_<name>.sql` (enable RLS; prefer RPCs for game rules), ending with an
   `insert into public.mini_apps (...)` row.
4. Push → Cloudflare rebuilds → run the SQL.
