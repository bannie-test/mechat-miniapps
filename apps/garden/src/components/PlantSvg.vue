<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ stage: number; growth: number; variant: number; withered: boolean; thirsty: boolean; bounce: boolean }>()

const PETALS = ['#ff8fb1', '#ffd34e', '#b48cff', '#ff6b6b']
const CENTERS = ['#ffd34e', '#ff9f43', '#ffd34e', '#ffd34e']
const petal = computed(() => PETALS[props.variant % 4])
const center = computed(() => CENTERS[props.variant % 4])

// Stem height grows smoothly with growth (days watered), capped.
const height = computed(() => (props.stage === 0 ? 0 : Math.min(130, 14 + props.growth * 8)))
const top = computed(() => 170 - height.value)

/** Leaves alternate sides up the stem; more appear as the plant grows. */
const leaves = computed(() => {
  const count = [0, 2, 4, 6, 8, 8][props.stage] ?? 0
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1)
    const y = 170 - height.value * t * 0.95
    const side = i % 2 === 0 ? -1 : 1
    const size = 10 + (1 - t) * 10 + props.stage * 1.5
    return { y, side, size, delay: i * 0.15 }
  })
})
</script>

<template>
  <svg viewBox="0 0 200 240" class="plant" :class="{ withered, thirsty, bounce }">
    <ellipse cx="100" cy="232" rx="58" ry="6" fill="rgba(0,0,0,0.12)" />

    <g class="sway">
      <!-- seed -->
      <g v-if="stage === 0" class="seed">
        <ellipse cx="100" cy="166" rx="9" ry="6" fill="#a0703f" />
        <path d="M95 164c3-2 7-2 10 0" stroke="#c9945e" stroke-width="2" fill="none" stroke-linecap="round" />
      </g>

      <!-- stem -->
      <path
        v-if="stage > 0"
        :d="`M100 172 C ${100 - 6} ${172 - height * 0.4}, ${100 + 6} ${172 - height * 0.7}, 100 ${top}`"
        stroke="var(--leaf-dark)" :stroke-width="3 + stage * 0.6" fill="none" stroke-linecap="round" class="stem"
      />

      <!-- leaves -->
      <g v-for="(l, i) in leaves" :key="i" class="leaf" :style="{ transformOrigin: `100px ${l.y}px`, animationDelay: l.delay + 's' }">
        <path
          :d="`M100 ${l.y} q ${l.side * l.size} ${-l.size * 0.9} ${l.side * l.size * 2} ${-l.size * 0.2} q ${-l.side * l.size} ${l.size * 0.9} ${-l.side * l.size * 2} ${l.size * 0.2}z`"
          fill="var(--leaf)"
        />
        <path :d="`M100 ${l.y} l ${l.side * l.size * 1.6} ${-l.size * 0.35}`" stroke="var(--leaf-dark)" stroke-width="1.2" opacity="0.6" />
      </g>

      <!-- sprout tip -->
      <g v-if="stage === 1">
        <path :d="`M100 ${top} q -10 -10 -16 -4 q 8 8 16 4z`" fill="var(--leaf)" />
        <path :d="`M100 ${top} q 10 -10 16 -4 q -8 8 -16 4z`" fill="var(--leaf)" />
      </g>

      <!-- bud -->
      <g v-if="stage === 4" class="bud">
        <ellipse cx="100" :cy="top - 6" rx="7" ry="10" :fill="petal" />
        <path :d="`M93 ${top} q 7 -8 14 0`" fill="var(--leaf)" />
      </g>

      <!-- flower -->
      <g v-if="stage >= 5" class="flower" :style="{ transformOrigin: `100px ${top - 8}px` }">
        <ellipse
          v-for="k in 6" :key="k" cx="100" :cy="top - 22" rx="8" ry="14" :fill="petal"
          :transform="`rotate(${k * 60} 100 ${top - 8})`"
        />
        <circle cx="100" :cy="top - 8" r="8" :fill="center" />
        <circle cx="97" :cy="top - 10" r="1.5" fill="#fff" opacity="0.7" />
      </g>
    </g>

    <!-- pot -->
    <path d="M52 172h96l-10 58H62z" fill="var(--pot)" />
    <rect x="46" y="164" width="108" height="16" rx="5" fill="var(--pot-dark)" />
    <ellipse cx="100" cy="168" rx="48" ry="5" fill="var(--soil)" />
    <path d="M62 196h76" stroke="rgba(255,255,255,0.15)" stroke-width="3" />
  </svg>
</template>

<style scoped>
.plant { width: 100%; height: 100%; overflow: visible; transition: filter 0.6s; }
.sway { transform-origin: 100px 172px; animation: sway 4.5s ease-in-out infinite; }
@keyframes sway { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }
.leaf { animation: leaf-in 0.6s cubic-bezier(.2,.9,.3,1.3) backwards; }
@keyframes leaf-in { from { transform: scale(0); } }
.flower { animation: bloom 0.9s cubic-bezier(.2,.9,.3,1.3) backwards, spin 18s linear infinite; }
@keyframes bloom { from { transform: scale(0) rotate(-90deg); } }
@keyframes spin { to { transform: rotate(360deg); } }
.bud { animation: leaf-in 0.6s ease backwards; }
.seed { animation: wiggle 2.5s ease-in-out infinite; transform-origin: 100px 166px; }
@keyframes wiggle { 0%, 80%, 100% { transform: rotate(0); } 85% { transform: rotate(-8deg); } 90% { transform: rotate(8deg); } }
.thirsty .sway { animation: droop 3s ease-in-out infinite; }
@keyframes droop { 0%, 100% { transform: rotate(-3deg) scaleY(0.97); } 50% { transform: rotate(3deg) scaleY(0.97); } }
.withered { filter: grayscale(0.9) sepia(0.4) brightness(0.85); }
.withered .sway { animation: none; transform: rotate(14deg) scaleY(0.9); }
.bounce .sway { animation: bounce 0.8s cubic-bezier(.2,.9,.3,1.4); }
@keyframes bounce { 0% { transform: scale(1, 1); } 30% { transform: scale(1.08, 0.9); } 60% { transform: scale(0.96, 1.08); } 100% { transform: scale(1, 1); } }
</style>
