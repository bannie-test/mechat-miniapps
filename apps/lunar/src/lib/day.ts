import {
  canChiDay, canChiMonth, canChiYear, gioHoangDao, jdFromDate, jdToDate, lunarMonthLength, lunarToSolar,
  solarToLunar, tietKhi, TIET_KHI, yearChiIndex, ZODIAC_EMOJI, type LunarDate,
} from './amlich'
import { holidaysOn, type Holiday } from './holidays'
import { fmt, type Dict, type Lang } from '../i18n'

export interface DayInfo {
  d: number
  m: number
  y: number
  jd: number
  /** 0 = Sunday */
  weekday: number
  lunar: LunarDate
  holidays: Holiday[]
}

export interface LunarEvent {
  id: string
  title: string
  lunar_day: number
  lunar_month: number
  kind: 'death' | 'birthday' | 'other'
  note: string | null
}

export function dayInfo(d: number, m: number, y: number): DayInfo {
  const lunar = solarToLunar(d, m, y)
  return { d, m, y, jd: lunar.jd, weekday: (lunar.jd + 1) % 7, lunar, holidays: holidaysOn(d, m, lunar) }
}

export function dayInfoJd(jd: number): DayInfo {
  const [d, m, y] = jdToDate(jd)
  return dayInfo(d, m, y)
}

export function todayJd(): number {
  const n = new Date()
  return jdFromDate(n.getDate(), n.getMonth() + 1, n.getFullYear())
}

const LUNAR_MONTH_VI = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười Một', 'Chạp']
const pad = (n: number) => String(n).padStart(2, '0')

export function solarLabel(i: DayInfo, t: Dict, lang: Lang): string {
  return lang === 'vi'
    ? `${t.weekdaysLong[i.weekday]}, ${pad(i.d)}/${pad(i.m)}/${i.y}`
    : `${t.weekdaysLong[i.weekday]}, ${t.months[i.m - 1]} ${i.d}, ${i.y}`
}

export function lunarMonthName(l: LunarDate, t: Dict, lang: Lang): string {
  if (lang === 'vi') return `Tháng ${LUNAR_MONTH_VI[l.month - 1]}${l.leap ? ' (nhuận)' : ''}`
  return fmt(l.leap ? t.lunarMonthLeap : t.lunarMonth, { m: l.month })
}

export function yearLabel(lunarYear: number, t: Dict): string {
  const z = yearChiIndex(lunarYear)
  return `${canChiYear(lunarYear)} ${ZODIAC_EMOJI[z]} ${t.zodiac[z]}`
}

export function details(i: DayInfo) {
  const term = tietKhi(i.jd)
  return {
    ccDay: canChiDay(i.jd),
    ccMonth: canChiMonth(i.lunar.month, i.lunar.year),
    ccYear: canChiYear(i.lunar.year),
    monthLen: lunarMonthLength(i.lunar),
    term: TIET_KHI[term.index],
    termStarts: term.starts,
    hours: gioHoangDao(i.jd),
  }
}

/** Plain-text summary posted to the chat. */
export function shareText(i: DayInfo, t: Dict, lang: Lang, extra: string[] = []): string {
  const x = details(i)
  const lines = [
    `📅 ${solarLabel(i, t, lang)}`,
    `🌙 ${i.lunar.day}/${i.lunar.month}${i.lunar.leap ? (lang === 'vi' ? ' nhuận' : ' (leap)') : ''} ${t.lunarShort} · ${t.yearCc} ${yearLabel(i.lunar.year, t)}`,
    `${t.dayCc} ${x.ccDay} · ${t.monthCc} ${x.ccMonth}`,
    ...i.holidays.map((h) => `🎉 ${h[lang]}`),
    ...extra,
  ]
  return lines.join('\n')
}

/** Solar JD of an event in the given lunar year (day 30 → last day if the month is short). */
export function eventJdInYear(e: Pick<LunarEvent, 'lunar_day' | 'lunar_month'>, lunarYear: number): number | null {
  const start = lunarToSolar(1, e.lunar_month, lunarYear)
  if (!start) return null
  const startJd = jdFromDate(start[0], start[1], start[2])
  const len = lunarMonthLength(solarToLunar(start[0], start[1], start[2]))
  return startJd + Math.min(e.lunar_day, len) - 1
}

/** Next occurrence on or after fromJd. */
export function nextOccurrence(e: LunarEvent, fromJd: number): number {
  const ly = dayInfoJd(fromJd).lunar.year
  for (const y of [ly - 1, ly, ly + 1, ly + 2]) {
    const jd = eventJdInYear(e, y)
    if (jd !== null && jd >= fromJd) return jd
  }
  return fromJd
}

export function relDays(jd: number, from: number, t: Dict): string {
  const n = jd - from
  return n === 0 ? t.isToday : n === 1 ? t.tomorrow : fmt(t.inDays, { n })
}
