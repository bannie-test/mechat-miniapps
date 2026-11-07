/**
 * Mini app side of the SDK.
 *
 *   const app = await connect()
 *   const supabase = createClient(app.init.supabase.url, app.init.supabase.anonKey, {
 *     accessToken: async () => app.accessToken,
 *   })
 */
import { NS, isNsMessage, type AppMessage, type HostMessage, type MiniAppInit, type MiniAppTheme } from './protocol'

export * from './protocol'

export interface ConnectOptions {
  /** Parent origins allowed to talk to this app. Empty = accept any parent. */
  allowedOrigins?: string[]
  timeoutMs?: number
}

export interface MiniAppClient {
  readonly init: MiniAppInit
  readonly accessToken: string
  readonly theme: MiniAppTheme
  readonly locale: 'en' | 'vi'
  onThemeChange(cb: (t: MiniAppTheme) => void): () => void
  onLocaleChange(cb: (l: 'en' | 'vi') => void): () => void
  close(): void
  haptic(kind: 'light' | 'medium' | 'success' | 'error'): void
}

export function isEmbedded(): boolean {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

export function connect(opts: ConnectOptions = {}): Promise<MiniAppClient> {
  const allowed = (opts.allowedOrigins ?? []).filter(Boolean)
  const timeoutMs = opts.timeoutMs ?? 8000

  return new Promise((resolve, reject) => {
    if (!isEmbedded()) {
      reject(new Error('NOT_EMBEDDED'))
      return
    }
    let parentOrigin = '*'
    let state: { init: MiniAppInit; token: string; theme: MiniAppTheme; locale: 'en' | 'vi' } | null = null
    const themeCbs = new Set<(t: MiniAppTheme) => void>()
    const localeCbs = new Set<(l: 'en' | 'vi') => void>()

    const post = (msg: AppMessage) => window.parent.postMessage(msg, parentOrigin)

    const timer = window.setTimeout(() => reject(new Error('HOST_TIMEOUT')), timeoutMs)

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.source !== window.parent || !isNsMessage(e.data)) return
      if (allowed.length && !allowed.includes(e.origin)) return
      const msg = e.data as HostMessage
      switch (msg.type) {
        case 'init': {
          parentOrigin = e.origin
          state = { init: msg.payload, token: msg.payload.session.accessToken, theme: msg.payload.theme, locale: msg.payload.locale }
          window.clearTimeout(timer)
          const s = state
          resolve({
            get init() { return s.init },
            get accessToken() { return s.token },
            get theme() { return s.theme },
            get locale() { return s.locale },
            onThemeChange(cb) { themeCbs.add(cb); return () => themeCbs.delete(cb) },
            onLocaleChange(cb) { localeCbs.add(cb); return () => localeCbs.delete(cb) },
            close: () => post({ ns: NS, type: 'close' }),
            haptic: (kind) => post({ ns: NS, type: 'haptic', payload: kind }),
          })
          break
        }
        case 'session':
          if (state) state.token = msg.payload.accessToken
          break
        case 'theme':
          if (state) { state.theme = msg.payload; themeCbs.forEach((cb) => cb(msg.payload)) }
          break
        case 'locale':
          if (state) { state.locale = msg.payload; localeCbs.forEach((cb) => cb(msg.payload)) }
          break
      }
    })

    post({ ns: NS, type: 'ready' })
  })
}

/** Apply host theme colors as CSS variables (--app-bg, --app-text, ...). */
export function applyThemeVars(theme: MiniAppTheme, el: HTMLElement = document.documentElement) {
  el.dataset.theme = theme.mode
  for (const [k, v] of Object.entries(theme.colors)) {
    el.style.setProperty(`--app-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, v)
  }
}
