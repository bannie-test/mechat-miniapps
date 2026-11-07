<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { dayInfoJd, nextOccurrence, relDays, solarLabel, type LunarEvent } from '../lib/day'
import { holidaysOn } from '../lib/holidays'
import type { Dict, Lang } from '../i18n'

const props = defineProps<{ events: LunarEvent[]; today: number; t: Dict; lang: Lang; canEdit: boolean; canShare: boolean }>()
const emit = defineEmits<{
  save: [e: Omit<LunarEvent, 'id'> & { id?: string }]
  remove: [id: string]
  show: [jd: number]
  share: [e: LunarEvent, jd: number]
}>()

const ICON = { death: '🕯️', birthday: '🎂', other: '📌' } as const

const upcoming = computed(() =>
  props.events
    .map((e) => ({ e, jd: nextOccurrence(e, props.today) }))
    .sort((a, b) => a.jd - b.jd),
)

/** Lunar holidays in the next ~60 days. */
const holidays = computed(() => {
  const out: { jd: number; name: string; off: boolean }[] = []
  for (let jd = props.today; jd < props.today + 60 && out.length < 6; jd++) {
    const i = dayInfoJd(jd)
    for (const h of holidaysOn(i.d, i.m, i.lunar)) out.push({ jd, name: h[props.lang], off: !!h.off })
  }
  return out
})

const editing = ref(false)
const form = reactive<{ id?: string; title: string; lunar_day: number; lunar_month: number; kind: LunarEvent['kind']; note: string }>({
  title: '', lunar_day: 1, lunar_month: 1, kind: 'death', note: '',
})

function open(e?: LunarEvent) {
  Object.assign(form, e
    ? { id: e.id, title: e.title, lunar_day: e.lunar_day, lunar_month: e.lunar_month, kind: e.kind, note: e.note ?? '' }
    : { id: undefined, title: '', lunar_day: dayInfoJd(props.today).lunar.day, lunar_month: dayInfoJd(props.today).lunar.month, kind: 'death', note: '' })
  editing.value = true
}

function submit() {
  if (!form.title.trim()) return
  emit('save', { ...form, title: form.title.trim(), note: form.note.trim() || null })
  editing.value = false
}

function remove() {
  if (form.id && confirm(props.t.confirmDelete)) {
    emit('remove', form.id)
    editing.value = false
  }
}
</script>

<template>
  <div class="panel">
    <p class="hint">{{ t.eventsHint }}</p>

    <section>
      <header class="sec">
        <h3>{{ t.upcoming }}</h3>
        <button v-if="canEdit" class="add" @click="open()">＋ {{ t.add }}</button>
      </header>
      <p v-if="!canEdit" class="empty">{{ t.needsApp }}</p>
      <p v-else-if="!events.length" class="empty">{{ t.noEvents }}</p>
      <TransitionGroup v-else name="list" tag="ul" class="list">
        <li v-for="{ e, jd } in upcoming" :key="e.id">
          <button class="item" @click="open(e)">
            <span class="ico">{{ ICON[e.kind] }}</span>
            <span class="txt">
              <b>{{ e.title }}</b>
              <small>{{ e.lunar_day }}/{{ e.lunar_month }} {{ t.lunarShort }} · {{ solarLabel(dayInfoJd(jd), t, lang) }}</small>
            </span>
            <span class="when" :class="{ soon: jd - today <= 7 }">{{ relDays(jd, today, t) }}</span>
          </button>
          <div class="actions">
            <button class="mini" @click="emit('show', jd)">📅</button>
            <button v-if="canShare" class="mini" @click="emit('share', e, jd)">💬</button>
          </div>
        </li>
      </TransitionGroup>
    </section>

    <section>
      <header class="sec"><h3>{{ t.holidays }}</h3></header>
      <ul class="list">
        <li v-for="h in holidays" :key="h.jd + h.name">
          <button class="item" @click="emit('show', h.jd)">
            <span class="ico">🎉</span>
            <span class="txt"><b :class="{ red: h.off }">{{ h.name }}</b><small>{{ solarLabel(dayInfoJd(h.jd), t, lang) }}</small></span>
            <span class="when">{{ relDays(h.jd, today, t) }}</span>
          </button>
        </li>
      </ul>
    </section>

    <Transition name="sheet">
      <div v-if="editing" class="backdrop" @click.self="editing = false">
        <form class="sheet" @submit.prevent="submit">
          <h3>{{ form.id ? t.edit : t.add }}</h3>
          <label>{{ t.name }}<input v-model="form.title" maxlength="80" :placeholder="t.namePh" required /></label>
          <div class="kinds">
            <button v-for="k in (['death', 'birthday', 'other'] as const)" :key="k" type="button" :class="{ on: form.kind === k }" @click="form.kind = k">
              {{ ICON[k] }} {{ t.kinds[k] }}
            </button>
          </div>
          <div class="two">
            <label>{{ t.lunarDay }}
              <select v-model.number="form.lunar_day"><option v-for="d in 30" :key="d" :value="d">{{ d }}</option></select>
            </label>
            <label>{{ t.lunarMonthLabel }}
              <select v-model.number="form.lunar_month"><option v-for="m in 12" :key="m" :value="m">{{ m }}</option></select>
            </label>
          </div>
          <label>{{ t.note }}<input v-model="form.note" maxlength="300" /></label>
          <div class="row">
            <button v-if="form.id" type="button" class="btn ghost danger" @click="remove">{{ t.delete }}</button>
            <span class="flex" />
            <button type="button" class="btn ghost" @click="editing = false">{{ t.cancel }}</button>
            <button class="btn">{{ t.save }}</button>
          </div>
        </form>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: 16px; }
.hint { margin: 0; color: var(--app-muted); font-size: 13.5px; }
.sec { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
h3 { margin: 0; font-size: 15px; }
.add { color: var(--app-accent); font-weight: 600; }
.empty { margin: 0; padding: 16px; border-radius: 14px; background: var(--app-surface); color: var(--app-muted); text-align: center; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.list li { display: flex; align-items: stretch; gap: 4px; border-radius: 14px; background: var(--app-surface); overflow: hidden; }
.item { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px; text-align: left; }
.ico { font-size: 22px; }
.txt { flex: 1; min-width: 0; display: grid; }
.txt b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.txt small { color: var(--app-muted); font-size: 12.5px; }
.red { color: var(--red); }
.when { flex: none; font-size: 12.5px; color: var(--app-muted); }
.when.soon { color: var(--gold-dark); font-weight: 700; }
.actions { display: flex; }
.mini { width: 40px; font-size: 17px; }
.mini:active, .item:active { background: var(--app-bg); }
.backdrop { position: fixed; inset: 0; z-index: 10; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; justify-content: center; }
.sheet {
  width: 100%; max-width: 480px; display: grid; gap: 12px; padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0; background: var(--app-surface);
}
label { display: grid; gap: 4px; font-size: 13px; color: var(--app-muted); }
input, select { font: inherit; font-size: 16px; color: var(--app-text); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--app-bg); outline: none; }
input:focus, select:focus { border-color: var(--app-accent); }
.kinds { display: flex; gap: 6px; flex-wrap: wrap; }
.kinds button { padding: 7px 11px; border-radius: 12px; background: var(--app-bg); font-size: 13.5px; transition: 0.15s; }
.kinds button.on { background: var(--app-accent); color: var(--app-accent-text); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.row { display: flex; gap: 8px; align-items: center; }
.flex { flex: 1; }
.danger { color: var(--red) !important; }
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.25s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.3s cubic-bezier(.2,.9,.3,1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
.list-enter-active, .list-leave-active, .list-move { transition: 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-16px); }
</style>
