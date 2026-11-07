<script setup lang="ts">
import { computed } from 'vue'
import { details, lunarMonthName, solarLabel, yearLabel, type DayInfo } from '../lib/day'
import type { Dict, Lang } from '../i18n'

const props = defineProps<{ info: DayInfo; t: Dict; lang: Lang; events: string[]; canShare: boolean; sharing: boolean }>()
defineEmits<{ share: [] }>()

const x = computed(() => details(props.info))
const special = computed(() =>
  props.info.lunar.day === 1 ? props.t.mung1 : props.info.lunar.day === 15 ? props.t.ram : '',
)
</script>

<template>
  <Transition name="card" mode="out-in">
    <article :key="info.jd" class="card">
      <div class="head">
        <div class="big" :class="{ red: info.holidays.some((h) => h.off) || info.weekday === 0 }">
          <span class="num">{{ info.lunar.day }}</span>
          <span class="moon">🌙</span>
        </div>
        <div class="titles">
          <p class="solar">{{ solarLabel(info, t, lang) }}</p>
          <p class="lunar">{{ lunarMonthName(info.lunar, t, lang) }} · <span class="muted">{{ x.monthLen === 30 ? t.monthFull : t.monthShort }}</span></p>
          <p class="year">{{ t.yearCc }} {{ yearLabel(info.lunar.year, t) }}</p>
        </div>
      </div>

      <div v-if="info.holidays.length || events.length || special" class="tags">
        <span v-for="h in info.holidays" :key="h.vi" class="tag" :class="{ off: h.off }">🎉 {{ h[lang] }}</span>
        <span v-for="e in events" :key="e" class="tag gold">🕯️ {{ e }}</span>
        <span v-if="special" class="tag gold">{{ special }}</span>
      </div>

      <dl>
        <div><dt>{{ t.dayCc }}</dt><dd>{{ x.ccDay }}</dd></div>
        <div><dt>{{ t.monthCc }}</dt><dd>{{ x.ccMonth }}</dd></div>
        <div><dt>{{ t.solarTerm }}</dt><dd>{{ x.term }}<small v-if="x.termStarts"> · {{ t.termStarts }}</small></dd></div>
      </dl>

      <div class="hours">
        <span class="muted small">{{ t.goodHours }}</span>
        <div class="chips">
          <span v-for="h in x.hours" :key="h.chi" class="chip">{{ h.chi }} <small>{{ h.from }}–{{ h.to }}h</small></span>
        </div>
      </div>

      <button v-if="canShare" class="btn" :disabled="sharing" @click="$emit('share')">💬 {{ t.share }}</button>
    </article>
  </Transition>
</template>

<style scoped>
.card { display: grid; gap: 12px; padding: 16px; border-radius: 18px; background: var(--app-surface); }
.head { display: flex; gap: 14px; align-items: center; }
.big {
  position: relative; flex: none; width: 76px; height: 76px; border-radius: 20px; display: grid; place-items: center;
  background: linear-gradient(145deg, color-mix(in srgb, var(--gold) 30%, transparent), color-mix(in srgb, var(--gold) 8%, transparent));
}
.big .num { font-size: 38px; font-weight: 800; color: var(--gold-dark); line-height: 1; }
.big.red .num { color: var(--red); }
.big .moon { position: absolute; top: -6px; right: -6px; font-size: 20px; animation: bob 3s ease-in-out infinite; }
@keyframes bob { 50% { transform: translateY(-3px) rotate(-8deg); } }
.titles { min-width: 0; display: grid; gap: 2px; }
.titles p { margin: 0; }
.solar { font-weight: 700; font-size: 16px; }
.lunar { font-size: 14px; }
.year { font-size: 14px; color: var(--app-muted); }
.muted { color: var(--app-muted); }
.small { font-size: 12.5px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; background: color-mix(in srgb, var(--app-accent) 12%, transparent); color: var(--app-accent); }
.tag.off { background: color-mix(in srgb, var(--red) 14%, transparent); color: var(--red); }
.tag.gold { background: color-mix(in srgb, var(--gold) 18%, transparent); color: var(--gold-dark); }
dl { margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
dl div { padding: 8px; border-radius: 12px; background: var(--app-bg); min-width: 0; }
dt { font-size: 11.5px; color: var(--app-muted); }
dd { margin: 0; font-weight: 600; font-size: 14px; }
dd small { font-weight: 400; color: var(--app-muted); }
.hours { display: grid; gap: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 4px 9px; border-radius: 10px; background: var(--app-bg); font-size: 13px; font-weight: 600; }
.chip small { font-weight: 400; color: var(--app-muted); }
.card-enter-active, .card-leave-active { transition: opacity 0.18s, transform 0.18s; }
.card-enter-from { opacity: 0; transform: translateY(8px); }
.card-leave-to { opacity: 0; }
</style>
