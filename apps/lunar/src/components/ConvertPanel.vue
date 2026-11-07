<script setup lang="ts">
import { computed, ref } from 'vue'
import { leapMonthOf, lunarToSolar } from '../lib/amlich'
import { dayInfo, dayInfoJd, lunarMonthName, solarLabel, yearLabel } from '../lib/day'
import { fmt, type Dict, type Lang } from '../i18n'

const props = defineProps<{ t: Dict; lang: Lang; today: number }>()
const emit = defineEmits<{ show: [jd: number] }>()

const pad = (n: number) => String(n).padStart(2, '0')
const t0 = dayInfoJd(props.today)

// Solar → lunar
const solar = ref(`${t0.y}-${pad(t0.m)}-${pad(t0.d)}`)
const fromSolar = computed(() => {
  const [y, m, d] = solar.value.split('-').map(Number)
  return y && m && d ? dayInfo(d, m, y) : null
})

// Lunar → solar
const ld = ref(t0.lunar.day)
const lm = ref(t0.lunar.month)
const ly = ref(t0.lunar.year)
const leap = ref(false)
const yearLeap = computed(() => leapMonthOf(ly.value))
const fromLunar = computed(() => {
  const r = lunarToSolar(ld.value, lm.value, ly.value, leap.value)
  if (!r) return null
  const i = dayInfo(r[0], r[1], r[2])
  // Day 30 in a 29-day month rolls into the next month → invalid.
  return i.lunar.month === lm.value && i.lunar.leap === leap.value ? i : null
})
</script>

<template>
  <div class="panel">
    <section class="card">
      <h3>☀️ {{ t.solarToLunar }}</h3>
      <label>{{ t.solarDate }}<input v-model="solar" type="date" min="1900-01-01" max="2199-12-31" /></label>
      <Transition name="fade" mode="out-in">
        <div v-if="fromSolar" :key="fromSolar.jd" class="result">
          <b>{{ fromSolar.lunar.day }} · {{ lunarMonthName(fromSolar.lunar, t, lang) }}</b>
          <span>{{ t.yearCc }} {{ yearLabel(fromSolar.lunar.year, t) }}</span>
          <button class="link" @click="emit('show', fromSolar.jd)">{{ t.showInCalendar }} →</button>
        </div>
      </Transition>
    </section>

    <section class="card">
      <h3>🌙 {{ t.lunarToSolar }}</h3>
      <div class="three">
        <label>{{ t.lunarDay }}<select v-model.number="ld"><option v-for="d in 30" :key="d" :value="d">{{ d }}</option></select></label>
        <label>{{ t.lunarMonthLabel }}<select v-model.number="lm"><option v-for="m in 12" :key="m" :value="m">{{ m }}</option></select></label>
        <label>{{ t.year }}<input v-model.number="ly" type="number" min="1900" max="2199" inputmode="numeric" /></label>
      </div>
      <label class="check"><input v-model="leap" type="checkbox" /> {{ t.leapMonth }}
        <small>({{ yearLeap ? fmt(t.leapOfYear, { m: yearLeap }) : t.noLeapYear }})</small>
      </label>
      <Transition name="fade" mode="out-in">
        <div v-if="fromLunar" :key="fromLunar.jd" class="result">
          <b>{{ solarLabel(fromLunar, t, lang) }}</b>
          <button class="link" @click="emit('show', fromLunar.jd)">{{ t.showInCalendar }} →</button>
        </div>
        <p v-else class="result muted">{{ leap ? fmt(t.noLeap, { y: ly, m: lm }) : '—' }}</p>
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: 12px; }
.card { display: grid; gap: 10px; padding: 16px; border-radius: 18px; background: var(--app-surface); }
h3 { margin: 0; font-size: 15px; }
label { display: grid; gap: 4px; font-size: 13px; color: var(--app-muted); }
input, select { font: inherit; font-size: 16px; color: var(--app-text); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--app-bg); outline: none; min-width: 0; }
input:focus, select:focus { border-color: var(--app-accent); }
.three { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 8px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--app-text); }
.check input { width: 18px; height: 18px; accent-color: var(--app-accent); }
.check small { color: var(--app-muted); }
.result { display: grid; gap: 2px; padding: 12px; border-radius: 12px; background: var(--app-bg); margin: 0; }
.result b { font-size: 16px; }
.muted { color: var(--app-muted); }
.link { justify-self: start; color: var(--app-accent); font-weight: 600; font-size: 14px; margin-top: 4px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
