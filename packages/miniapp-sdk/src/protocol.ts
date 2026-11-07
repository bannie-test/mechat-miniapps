/**
 * Copy of the protocol in the chat repo (mechat/packages/miniapp-sdk/src/protocol.ts).
 * Keep both files identical; bump PROTOCOL_VERSION on breaking changes.
 */
/** Message protocol between the iemanchat host and a mini app (window.postMessage). */
export const NS = 'iemanchat' as const
export const PROTOCOL_VERSION = 1

export interface MiniAppUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface MiniAppTheme {
  mode: 'light' | 'dark'
  /** CSS colors the mini app can use to blend in. */
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; accentText: string }
}

export interface MiniAppSession {
  /** Supabase user access token (JWT). Short-lived; the host pushes fresh ones. */
  accessToken: string
  /** Unix seconds. */
  expiresAt: number
}

export interface MiniAppInit {
  version: number
  appId: string
  user: MiniAppUser
  locale: 'en' | 'vi'
  theme: MiniAppTheme
  /** Public Supabase connection details so the app can use the same database. */
  supabase: { url: string; anonKey: string }
  session: MiniAppSession
  /** Chat the app was opened from, if any. */
  chatId: string | null
}

export type HostMessage =
  | { ns: typeof NS; type: 'init'; payload: MiniAppInit }
  | { ns: typeof NS; type: 'session'; payload: MiniAppSession }
  | { ns: typeof NS; type: 'theme'; payload: MiniAppTheme }
  | { ns: typeof NS; type: 'locale'; payload: 'en' | 'vi' }

export type AppMessage =
  | { ns: typeof NS; type: 'ready' }
  | { ns: typeof NS; type: 'close' }
  | { ns: typeof NS; type: 'haptic'; payload: 'light' | 'medium' | 'success' | 'error' }

export function isNsMessage(data: unknown): data is { ns: typeof NS; type: string; payload?: unknown } {
  return typeof data === 'object' && data !== null && (data as { ns?: unknown }).ns === NS
}
