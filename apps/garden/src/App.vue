<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { applyThemeVars, connect, type MiniAppClient } from '@iemanchat/miniapp-sdk'
import { dicts, fmt, type Dict } from './i18n'
import PlantSvg from './components/PlantSvg.vue'

interface Plant {
  id: string
  name: string
  variant: number
  growth: number
  stage: number
  health: number
  waterings: number
  last_watered_on: string | null
  watered_today: boolean
  withered: boolean
  next_seed_in: number | null
}
interface Garden { seeds: number; today: string; max_pots: number; plants: Plant[] }

const allowed = (window.__ENV__?.HOST_ORIGINS || window.__ENV__?.VITE_HOST_ORIGINS || import.meta.env.VITE_HOST_ORIGINS || '')
  .split(',').map((s: string) => s.trim()).filter(Boolean)

const lang = new URLSearchParams(location.search).get('lang') === 'vi' ? 'vi' : 'en'
const t = ref<Dict>(dicts[lang])
document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') ?? 'light'

const status = ref<'loading' | 'ready' | 'not-embedded' | 'error'>('loading')
const errorDetail = ref('')
const garden = ref<Garden | null>(null)
const index = ref(0)
const busy = ref(false)
const pouring = ref(false)
const bounce = ref(false)
const toast = ref<string | null>(null)
const floater = ref<string | null>(null)
const chatId = ref<string | null>(null)
const sharing = ref(false)

let app: MiniAppClient | null = null
let db: SupabaseClient | null = null

const plant = computed(() => garden.value?.plants[index.value] ?? null)

function say(msg: string, ms = 2200) {
  toast.value = msg
  setTimeout(() => { if (toast.value === msg) toast.value = null }, ms)
}
function float(msg: string) {
  floater.value = msg
  setTimeout(() => (floater.value = null), 1600)
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db!.rpc(fn, args)
  if (error) throw error
  return data as T
}

onMounted(async () => {
  try {
    app = await connect({ allowedOrigins: allowed })
  } catch (e) {
    const m = (e as Error).message
    if (m === 'NOT_EMBEDDED') status.value = 'not-embedded'
    else if (m.startsWith('HOST_TIMEOUT')) {
      // Referrer is normally the embedding chat's origin; location is where this app really loaded.
      const parent = document.referrer ? new URL(document.referrer).origin : 'unknown'
      fail(`${m} · allowed: ${allowed.join(', ') || 'any'} · chat: ${parent} · app: ${location.origin}`, e)
    } else fail(m, e)
    return
  }
  t.value = dicts[app.locale]
  chatId.value = app.init.chatId
  applyThemeVars(app.theme)
  app.onThemeChange((th) => applyThemeVars(th))
  app.onLocaleChange((l) => (t.value = dicts[l]))

  // Same database, same user: RLS applies exactly like in the chat app.
  const client = app
  db = createClient(client.init.supabase.url, client.init.supabase.anonKey, {
    accessToken: async () => client.accessToken,
  })
  try {
    garden.value = await rpc<Garden>('plant_get_state', { p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
    status.value = 'ready'
  } catch (e) {
    const err = e as { code?: string; message?: string }
    fail(`plant_get_state: ${[err.code, err.message].filter(Boolean).join(' ')}`, e)
  }
})

function fail(detail: string, e: unknown) {
  console.error('[garden]', detail, e)
  errorDetail.value = detail
  status.value = 'error'
}

async function water() {
  const p = plant.value
  if (!p || busy.value || p.watered_today || p.withered) return
  busy.value = true
  pouring.value = true
  app?.haptic('light')
  try {
    const [res] = await Promise.all([
      rpc<{ gained_seeds: number; stage_up: boolean; state: Garden }>('plant_water', { p_plant: p.id }),
      new Promise((r) => setTimeout(r, 1300)),
    ])
    garden.value = res.state
    bounce.value = true
    setTimeout(() => (bounce.value = false), 900)
    if (res.gained_seeds) {
      float(`🌰 ${t.value.gotSeed}`)
      app?.haptic('success')
    } else if (res.stage_up) float(`✨ ${t.value.grewUp}`)
  } catch (e) {
    const m = String((e as { message?: string }).message)
    say(m.includes('ALREADY_WATERED') ? t.value.comeBack : m.includes('WITHERED') ? t.value.withered : t.value.error)
    app?.haptic('error')
  } finally {
    pouring.value = false
    busy.value = false
  }
}

async function sow() {
  const g = garden.value
  if (!g) return
  if (g.plants.length >= g.max_pots) return say(t.value.full)
  if (g.seeds < 1) return say(t.value.noSeeds)
  const name = prompt(t.value.sowName, '🌱')
  if (name === null) return
  try {
    garden.value = await rpc<Garden>('plant_sow', { p_name: name })
    index.value = garden.value.plants.length - 1
  } catch {
    say(t.value.error)
  }
}

async function rename() {
  const p = plant.value
  if (!p) return
  const name = prompt(t.value.rename, p.name)
  if (!name?.trim()) return
  garden.value = await rpc<Garden>('plant_rename', { p_plant: p.id, p_name: name })
}

async function remove() {
  const p = plant.value
  if (!p || !confirm(t.value.confirmRemove)) return
  garden.value = await rpc<Garden>('plant_remove', { p_plant: p.id })
  index.value = Math.max(0, Math.min(index.value, (garden.value.plants.length || 1) - 1))
}

/** Show off the current plant in the chat the garden was opened from (a normal message, RLS applies). */
async function share() {
  const p = plant.value
  if (!p || !app || !chatId.value || sharing.value) return
  sharing.value = true
  const content = fmt(t.value.brag, { name: p.name, stage: t.value.stages[p.stage], n: p.growth, seeds: garden.value?.seeds ?? 0 })
  const { error } = await db!.from('messages').insert({ chat_id: chatId.value, sender_id: app.init.user.id, kind: 'text', content })
  sharing.value = false
  if (error) {
    app.haptic('error')
    return say(t.value.error)
  }
  app.haptic('success')
  say(t.value.shared)
}

// Swipe between pots
let sx = 0
function down(e: PointerEvent) { sx = e.clientX }
function up(e: PointerEvent) {
  const dx = e.clientX - sx
  const n = garden.value?.plants.length ?? 0
  if (Math.abs(dx) < 50 || n < 2) return
  index.value = (index.value + (dx < 0 ? 1 : -1) + n) % n
}

const thirsty = computed(() => !!plant.value && !plant.value.watered_today && !plant.value.withered && plant.value.health < 80)
</script>

<template>
  <main class="garden">
    <div v-if="status === 'loading'" class="center"><div class="sprout-loader">🌱</div><p>{{ t.loading }}</p></div>
    <div v-else-if="status === 'not-embedded'" class="center"><div class="big">🪴</div><p>{{ t.notEmbedded }}</p></div>
    <div v-else-if="status === 'error'" class="center"><div class="big">🥀</div><p>{{ t.error }}</p><p v-if="errorDetail" class="error-detail">{{ errorDetail }}</p></div>

    <template v-else-if="garden">
      <header class="top">
        <span class="seeds" :title="t.seeds">🌰 <b>{{ garden.seeds }}</b></span>
        <button class="sow" :disabled="garden.seeds < 1 || garden.plants.length >= garden.max_pots" @click="sow">＋ {{ t.sow }}</button>
      </header>

      <section class="stage" @pointerdown="down" @pointerup="up">
        <div class="sky" />
        <Transition name="slide" mode="out-in">
          <div v-if="plant" :key="plant.id" class="pot-wrap">
            <PlantSvg
              :stage="plant.stage" :growth="plant.growth" :variant="plant.variant"
              :withered="plant.withered" :thirsty="thirsty" :bounce="bounce"
            />
            <div class="can" :class="{ pouring }">
              <svg viewBox="0 0 80 60"><path d="M10 20h40v30H10z" fill="#6aa9e9"/><path d="M50 26l24-14 3 5-22 16z" fill="#6aa9e9"/><path d="M14 20c0-12 32-12 32 0" stroke="#4d8fd3" stroke-width="5" fill="none"/></svg>
            </div>
            <div v-if="pouring" class="drops"><i v-for="k in 9" :key="k" :style="{ left: 52 + (k % 3) * 6 + '%', animationDelay: k * 0.09 + 's' }" /></div>
            <Transition name="float"><div v-if="floater" class="floater">{{ floater }}</div></Transition>
          </div>
        </Transition>
        <div v-if="garden.plants.length > 1" class="dots">
          <button v-for="(p, i) in garden.plants" :key="p.id" :class="{ on: i === index }" @click="index = i" />
        </div>
      </section>

      <section v-if="plant" class="card">
        <div class="row">
          <button class="name" @click="rename">{{ plant.name }} ✎</button>
          <span class="stage-name">{{ t.stages[plant.stage] }}</span>
          <button v-if="chatId" class="share" :disabled="sharing" :title="t.share" @click="share">💬</button>
        </div>
        <div class="row small muted">
          <span>{{ fmt(t.day, { n: plant.growth }) }}</span>
          <span v-if="plant.next_seed_in">{{ fmt(t.nextSeed, { n: plant.next_seed_in }) }}</span>
        </div>
        <div class="health">
          <span class="small muted">{{ t.health }}</span>
          <div class="bar"><i :style="{ width: plant.health + '%', background: plant.health > 60 ? '#5cbf60' : plant.health > 30 ? '#f5b041' : '#e74c3c' }" /></div>
        </div>

        <p v-if="plant.withered" class="note">{{ t.withered }}</p>
        <p v-else-if="thirsty" class="note">{{ t.thirsty }}</p>

        <button v-if="plant.withered" class="btn ghost" @click="remove">{{ t.remove }}</button>
        <button v-else class="btn" :disabled="busy || plant.watered_today" @click="water">
          {{ plant.watered_today ? '✓ ' + t.watered : '💧 ' + t.water }}
        </button>
        <p v-if="plant.watered_today && !plant.withered" class="small muted center-text">{{ t.comeBack }}</p>
      </section>
    </template>

    <Transition name="float"><div v-if="toast" class="toast">{{ toast }}</div></Transition>
  </main>
</template>

<style scoped>
.garden { height: 100%; display: flex; flex-direction: column; padding: 12px 16px calc(16px + env(safe-area-inset-bottom)); gap: 12px; max-width: 480px; margin: 0 auto; }
.center { flex: 1; display: grid; place-content: center; justify-items: center; text-align: center; color: var(--app-muted); padding: 24px; }
.big { font-size: 64px; }
.sprout-loader { font-size: 56px; animation: grow 1.2s ease-in-out infinite alternate; }
@keyframes grow { from { transform: scale(0.8); } to { transform: scale(1.1); } }
.top { display: flex; align-items: center; justify-content: space-between; }
.seeds { font-size: 18px; padding: 6px 12px; border-radius: 20px; background: var(--app-surface); }
.sow { padding: 8px 14px; border-radius: 20px; background: var(--app-surface); color: var(--app-accent); font-weight: 600; }
.sow:disabled { opacity: 0.45; }
.stage { position: relative; flex: 1; min-height: 260px; border-radius: 20px; overflow: hidden; touch-action: pan-y; }
.sky { position: absolute; inset: 0; background: linear-gradient(180deg, #bfe3ff, #eaf6e6); }
:root[data-theme='dark'] .sky { background: linear-gradient(180deg, #1c2c44, #22342a); }
.pot-wrap { position: absolute; inset: 16px 10% 8px; }
.can { position: absolute; width: 34%; top: 4%; right: -6%; opacity: 0; transform: translate(30%, -20%) rotate(0); transition: 0.4s cubic-bezier(.2,.9,.3,1); }
.can.pouring { opacity: 1; transform: translate(0, 0) rotate(-28deg); }
.drops i { position: absolute; top: 26%; width: 6px; height: 10px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: #5aa7f2; animation: drop 0.7s ease-in infinite; }
@keyframes drop { from { transform: translateY(0); opacity: 1; } to { transform: translateY(140px); opacity: 0; } }
.floater { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); font-size: 22px; font-weight: 700; color: #2d7a35; background: rgba(255,255,255,0.85); padding: 6px 14px; border-radius: 20px; white-space: nowrap; }
.dots { position: absolute; bottom: 8px; left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
.dots button { width: 8px; height: 8px; border-radius: 50%; background: rgba(0,0,0,0.2); transition: 0.2s; }
.dots button.on { width: 20px; border-radius: 4px; background: var(--app-accent); }
.card { display: grid; gap: 10px; padding: 16px; border-radius: 18px; background: var(--app-surface); }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.name { font-size: 18px; font-weight: 700; }
.share { font-size: 18px; padding: 2px 6px; }
.share:disabled { opacity: 0.5; }
.stage-name { margin-left: auto;  padding: 3px 10px; border-radius: 12px; background: color-mix(in srgb, var(--leaf) 20%, transparent); color: var(--leaf-dark); font-weight: 600; font-size: 13px; }
.small { font-size: 13px; }
.muted { color: var(--app-muted); }
.health { display: grid; gap: 4px; }
.bar { height: 8px; border-radius: 4px; background: rgba(127,127,127,0.2); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 4px; transition: width 0.6s ease, background 0.6s; }
.note { margin: 0; font-size: 14px; }
.btn { height: 48px; border-radius: 14px; background: var(--app-accent); color: var(--app-accent-text); font-weight: 700; font-size: 16px; transition: transform 0.1s, opacity 0.2s; }
.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.55; }
.btn.ghost { background: transparent; color: #e74c3c; border: 1px solid currentColor; }
.center-text { text-align: center; margin: 0; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 10px 16px; border-radius: 12px; background: rgba(20, 30, 25, 0.9); color: #fff; max-width: calc(100% - 32px); text-align: center; }
.slide-enter-active, .slide-leave-active { transition: transform 0.3s ease, opacity 0.3s; }
.slide-enter-from { transform: translateX(40px); opacity: 0; }
.slide-leave-to { transform: translateX(-40px); opacity: 0; }
.float-enter-active, .float-leave-active { transition: transform 0.4s cubic-bezier(.2,.9,.3,1.3), opacity 0.4s; }
.float-enter-from { transform: translate(-50%, 16px) scale(0.8); opacity: 0; }
.float-leave-to { transform: translate(-50%, -24px); opacity: 0; }
</style>
