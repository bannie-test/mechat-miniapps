<script setup lang="ts">
import { computed, ref } from 'vue'
import { jdFromDate } from '../lib/amlich'
import { dayInfoJd, type DayInfo } from '../lib/day'
import type { Dict } from '../i18n'

const props = defineProps<{
  year: number
  month: number
  selected: number
  today: number
  marked: Set<number>
  t: Dict
}>()
const emit = defineEmits<{ select: [jd: number]; shift: [delta: number] }>()

const dir = ref(1)

/** 6 weeks × 7 days, Monday first (Vietnamese convention). */
const cells = computed(() => {
  const first = jdFromDate(1, props.month, props.year)
  const mondayOffset = first % 7 // jd % 7: 0 = Monday
  const start = first - mondayOffset
  const out: (DayInfo & { other: boolean })[] = []
  for (let i = 0; i < 42; i++) {
    const info = dayInfoJd(start + i)
    out.push({ ...info, other: info.m !== props.month })
  }
  return out
})

function shift(delta: number) {
  dir.value = delta
  emit('shift', delta)
}

let sx = 0
let sy = 0
function down(e: PointerEvent) { sx = e.clientX; sy = e.clientY }
function up(e: PointerEvent) {
  const dx = e.clientX - sx
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) shift(dx < 0 ? 1 : -1)
}

defineExpose({ shift })
</script>

<template>
  <section class="grid-wrap" @pointerdown="down" @pointerup="up">
    <div class="weekdays">
      <span v-for="(w, i) in t.weekdays" :key="w" :class="{ sun: i === 6 }">{{ w }}</span>
    </div>
    <Transition :name="dir > 0 ? 'next' : 'prev'" mode="out-in">
      <div :key="`${year}-${month}`" class="grid">
        <button
          v-for="c in cells" :key="c.jd" class="cell"
          :class="{
            other: c.other, today: c.jd === today, sel: c.jd === selected,
            sun: c.weekday === 0, off: c.holidays.some((h) => h.off), fest: c.holidays.length > 0,
            ram: c.lunar.day === 15, mung1: c.lunar.day === 1,
          }"
          @click="emit('select', c.jd)"
        >
          <b>{{ c.d }}</b>
          <small>{{ c.lunar.day === 1 ? `${c.lunar.day}/${c.lunar.month}${c.lunar.leap ? '*' : ''}` : c.lunar.day }}</small>
          <i v-if="marked.has(c.jd)" class="dot" />
        </button>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.grid-wrap { touch-action: pan-y; user-select: none; }
.weekdays, .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.weekdays span { text-align: center; font-size: 12px; font-weight: 600; color: var(--app-muted); padding: 4px 0; }
.weekdays .sun { color: var(--red); }
.cell {
  position: relative; aspect-ratio: 1 / 1.05; min-height: 44px; display: grid; place-content: center; gap: 1px;
  border-radius: 12px; transition: background 0.2s, transform 0.15s;
}
.cell:active { transform: scale(0.92); }
.cell b { font-size: 17px; font-weight: 600; line-height: 1; }
.cell small { font-size: 10.5px; color: var(--app-muted); line-height: 1.1; }
.cell.other { opacity: 0.35; }
.cell.sun b, .cell.off b { color: var(--red); }
.cell.fest small { color: var(--red); font-weight: 600; }
.cell.mung1 small, .cell.ram small { color: var(--gold); font-weight: 700; }
.cell.today { background: color-mix(in srgb, var(--app-accent) 14%, transparent); }
.cell.today b { color: var(--app-accent); }
.cell.sel { background: var(--app-accent); animation: pop 0.25s cubic-bezier(.2,.9,.3,1.4); }
.cell.sel b, .cell.sel small { color: var(--app-accent-text) !important; }
.dot { position: absolute; bottom: 5px; left: 50%; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--gold); }
.cell.sel .dot { background: var(--app-accent-text); }
@keyframes pop { from { transform: scale(0.8); } }
.next-enter-active, .next-leave-active, .prev-enter-active, .prev-leave-active { transition: transform 0.22s ease, opacity 0.22s; }
.next-enter-from, .prev-leave-to { transform: translateX(30px); opacity: 0; }
.next-leave-to, .prev-enter-from { transform: translateX(-30px); opacity: 0; }
</style>
