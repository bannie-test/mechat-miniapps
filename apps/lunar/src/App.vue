<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { applyThemeVars, connect, type MiniAppClient } from '@iemanchat/miniapp-sdk'
import { canChiYear, jdFromDate, jdToDate, solarToLunar } from './lib/amlich'
import { dayInfoJd, eventJdInYear, relDays, shareText, solarLabel, todayJd, type LunarEvent } from './lib/day'
import { dicts, type Lang } from './i18n'
import MonthGrid from './components/MonthGrid.vue'
import DayCard from './components/DayCard.vue'
import EventsPanel from './components/EventsPanel.vue'
import ConvertPanel from './components/ConvertPanel.vue'

const allowed = (window.__ENV__?.HOST_ORIGINS || window.__ENV__?.VITE_HOST_ORIGINS || import.meta.env.VITE_HOST_ORIGINS || '')
  .split(',').map((s: string) => s.trim()).filter(Boolean)

// The host passes ?lang=&theme= so the first paint already matches; the SDK keeps them in sync.
const params = new URLSearchParams(location.search)
const qLang = params.get('lang')
const lang = ref<Lang>(qLang === 'vi' || qLang === 'en' ? qLang : navigator.language.startsWith('vi') ? 'vi' : 'en')
const t = computed(() => dicts[lang.value])
document.documentElement.dataset.theme =
  params.get('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

const today = ref(todayJd())
const selected = ref(today.value)
const [, tm, ty] = jdToDate(today.value)
const view = reactive({ y: ty, m: tm })
const tab = ref<'calendar' | 'events' | 'convert'>('calendar')

const app = shallowRef<MiniAppClient | null>(null)
let db: SupabaseClient | null = null
const events = ref<LunarEvent[]>([])
const sharing = ref(false)
const toast = ref<string | null>(null)

const chatId = computed(() => app.value?.init.chatId ?? null)
const canShare = computed(() => !!chatId.value)

function say(msg: string) {
  toast.value = msg
  setTimeout(() => { if (toast.value === msg) toast.value = null }, 2200)
}

// ---------------------------------------------------------------------------
// Host connection (optional: the calendar also works when opened directly)
// ---------------------------------------------------------------------------
onMounted(async () => {
  try {
    app.value = await connect({ allowedOrigins: allowed })
  } catch {
    return // standalone: calendar + converter only
  }
  const client = app.value
  lang.value = client.locale
  applyThemeVars(client.theme)
  client.onThemeChange((th) => applyThemeVars(th))
  client.onLocaleChange((l) => (lang.value = l))
  db = createClient(client.init.supabase.url, client.init.supabase.anonKey, {
    accessToken: async () => client.accessToken,
  })
  await loadEvents()
})

async function loadEvents() {
  if (!db) return
  const { data, error } = await db.from('lunar_events')
    .select('id, title, lunar_day, lunar_month, kind, note').order('lunar_month').order('lunar_day')
  if (error) return say(t.value.error)
  events.value = data as LunarEvent[]
}

async function saveEvent(e: Omit<LunarEvent, 'id'> & { id?: string }) {
  if (!db) return
  const row = { title: e.title, lunar_day: e.lunar_day, lunar_month: e.lunar_month, kind: e.kind, note: e.note }
  const { error } = e.id
    ? await db.from('lunar_events').update(row).eq('id', e.id)
    : await db.from('lunar_events').insert(row)
  if (error) return say(t.value.error)
  app.value?.haptic('success')
  await loadEvents()
}

async function removeEvent(id: string) {
  if (!db) return
  const { error } = await db.from('lunar_events').delete().eq('id', id)
  if (error) return say(t.value.error)
  events.value = events.value.filter((e) => e.id !== id)
}

/** Posts a text message as the current user into the chat the app was opened from (RLS applies). */
async function share(content: string) {
  if (!db || !chatId.value || sharing.value) return
  sharing.value = true
  const { error } = await db.from('messages').insert({
    chat_id: chatId.value, sender_id: app.value!.init.user.id, kind: 'text', content,
  })
  sharing.value = false
  if (error) {
    app.value?.haptic('error')
    return say(t.value.error)
  }
  app.value?.haptic('success')
  say(t.value.shared)
}

// ---------------------------------------------------------------------------
// Calendar state
// ---------------------------------------------------------------------------
const selectedInfo = computed(() => dayInfoJd(selected.value))

const eventsOn = computed(() => {
  const l = selectedInfo.value.lunar
  if (l.leap) return []
  return events.value.filter((e) => eventJdInYear(e, l.year) === selected.value).map((e) => e.title)
})

/** Days in the visible month that have a personal event. */
const marked = computed(() => {
  const set = new Set<number>()
  const ly = solarToLunar(15, view.m, view.y).year
  for (const e of events.value) {
    for (const y of [ly - 1, ly, ly + 1]) {
      const jd = eventJdInYear(e, y)
      if (jd !== null) set.add(jd)
    }
  }
  return set
})

const monthTitle = computed(() => `${t.value.months[view.m - 1]}${lang.value === 'vi' ? ',' : ''} ${view.y}`)
const monthSub = computed(() => {
  const a = solarToLunar(1, view.m, view.y)
  const last = new Date(view.y, view.m, 0).getDate()
  const b = solarToLunar(last, view.m, view.y)
  const months = a.month === b.month ? `${a.month}` : `${a.month}–${b.month}`
  const years = a.year === b.year ? canChiYear(a.year) : `${canChiYear(a.year)} / ${canChiYear(b.year)}`
  return `${lang.value === 'vi' ? 'Tháng' : 'Lunar month'} ${months} · ${years}`
})
const viewingToday = computed(() => {
  const [, m, y] = jdToDate(today.value)
  return m === view.m && y === view.y && selected.value === today.value
})

const grid = ref<InstanceType<typeof MonthGrid> | null>(null)

function shift(delta: number) {
  let m = view.m + delta
  let y = view.y
  if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
  view.m = m
  view.y = y
  const [, tm2, ty2] = jdToDate(today.value)
  selected.value = tm2 === m && ty2 === y ? today.value : jdFromDate(1, m, y)
  app.value?.haptic('light')
}

function select(jd: number) {
  const [, m, y] = jdToDate(jd)
  if (m !== view.m || y !== view.y) {
    view.m = m
    view.y = y
  }
  selected.value = jd
}

function show(jd: number) {
  tab.value = 'calendar'
  select(jd)
}

function goToday() {
  show(today.value)
}

function shareDay() {
  void share(shareText(selectedInfo.value, t.value, lang.value, eventsOn.value.map((e) => `🕯️ ${e}`)))
}

function shareEvent(e: LunarEvent, jd: number) {
  const icon = e.kind === 'death' ? '🕯️' : e.kind === 'birthday' ? '🎂' : '📌'
  void share([
    `${icon} ${e.title}`,
    `🌙 ${e.lunar_day}/${e.lunar_month} ${t.value.lunarShort}`,
    `📅 ${solarLabel(dayInfoJd(jd), t.value, lang.value)} (${relDays(jd, today.value, t.value)})`,
    ...(e.note ? [e.note] : []),
  ].join('\n'))
}

// Roll over at midnight while the app stays open.
const tick = setInterval(() => {
  const now = todayJd()
  if (now !== today.value) {
    if (selected.value === today.value) selected.value = now
    today.value = now
  }
}, 60_000)
onBeforeUnmount(() => clearInterval(tick))

</script>

<template>
  <main class="lunar">
    <nav class="tabs" role="tablist">
      <button
        v-for="k in (['calendar', 'events', 'convert'] as const)" :key="k" role="tab"
        :class="{ on: tab === k }" :aria-selected="tab === k" @click="tab = k"
      >{{ t.tabs[k] }}</button>
      <i class="ink" :style="{ transform: `translateX(${['calendar', 'events', 'convert'].indexOf(tab) * 100}%)` }" />
    </nav>

    <Transition name="tab" mode="out-in">
      <div v-if="tab === 'calendar'" key="cal" class="page">
        <header class="month">
          <button class="nav" :aria-label="'prev'" @click="grid?.shift(-1)">‹</button>
          <div class="mt">
            <b>{{ monthTitle }}</b>
            <small>{{ monthSub }}</small>
          </div>
          <button class="nav" :aria-label="'next'" @click="grid?.shift(1)">›</button>
        </header>
        <Transition name="fade">
          <button v-if="!viewingToday" class="today-chip" @click="goToday">↺ {{ t.today }}</button>
        </Transition>

        <MonthGrid
          ref="grid" :year="view.y" :month="view.m" :selected="selected" :today="today" :marked="marked" :t="t"
          @select="select" @shift="shift"
        />

        <DayCard :info="selectedInfo" :t="t" :lang="lang" :events="eventsOn" :can-share="canShare" :sharing="sharing" @share="shareDay" />
      </div>

      <div v-else-if="tab === 'events'" key="ev" class="page">
        <EventsPanel
          :events="events" :today="today" :t="t" :lang="lang" :can-edit="!!app" :can-share="canShare"
          @save="saveEvent" @remove="removeEvent" @show="show" @share="shareEvent"
        />
      </div>

      <div v-else key="cv" class="page">
        <ConvertPanel :t="t" :lang="lang" :today="today" @show="show" />
      </div>
    </Transition>

    <Transition name="toast"><div v-if="toast" class="toast">{{ toast }}</div></Transition>
  </main>
</template>

<style scoped>
.lunar { min-height: 100%; max-width: 480px; margin: 0 auto; padding: 10px 12px calc(20px + env(safe-area-inset-bottom)); display: grid; gap: 12px; align-content: start; }
.tabs { position: sticky; top: 0; z-index: 5; display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border-radius: 12px; background: var(--app-surface); box-shadow: 0 1px 0 var(--border); }
.tabs button { position: relative; z-index: 1; height: 34px; border-radius: 9px; font-weight: 600; font-size: 14px; color: var(--app-muted); transition: color 0.2s; }
.tabs button.on { color: var(--app-accent-text); }
.ink { position: absolute; left: 3px; top: 3px; width: calc((100% - 6px) / 3); height: 34px; border-radius: 9px; background: var(--app-accent); transition: transform 0.3s cubic-bezier(.2,.9,.3,1); }
.page { display: grid; gap: 12px; position: relative; }
.month { display: flex; align-items: center; gap: 8px; }
.nav { width: 40px; height: 40px; border-radius: 50%; font-size: 26px; line-height: 1; color: var(--app-accent); }
.nav:active { background: var(--app-surface); }
.mt { flex: 1; display: grid; text-align: center; }
.mt b { font-size: 18px; }
.mt small { color: var(--app-muted); font-size: 12.5px; }
.today-chip { position: absolute; right: 0; top: 48px; z-index: 2; padding: 5px 12px; border-radius: 14px; background: var(--app-accent); color: var(--app-accent-text); font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.toast { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 10px 16px; border-radius: 12px; background: rgba(20, 24, 30, 0.92); color: #fff; max-width: calc(100% - 32px); text-align: center; z-index: 20; }
.tab-enter-active, .tab-leave-active { transition: opacity 0.18s, transform 0.18s; }
.tab-enter-from { opacity: 0; transform: translateY(6px); }
.tab-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: scale(0.9); }
.toast-enter-active, .toast-leave-active { transition: transform 0.3s cubic-bezier(.2,.9,.3,1.3), opacity 0.3s; }
.toast-enter-from, .toast-leave-to { transform: translate(-50%, 16px); opacity: 0; }
</style>
