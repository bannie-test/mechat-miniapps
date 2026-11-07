/**
 * Vietnamese lunar calendar (âm lịch), computed for UTC+7.
 * Astronomical algorithm by Hồ Ngọc Đức (https://www.informatik.uni-leipzig.de/~duc/amlich/),
 * ported to TypeScript. Valid roughly 1800–2199.
 */

export const TZ = 7
const PI = Math.PI
const INT = Math.floor

export interface LunarDate {
  day: number
  month: number
  year: number
  leap: boolean
  /** Julian day number of the solar date. */
  jd: number
}

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083
  return jd
}

/** → [day, month, year] */
export function jdToDate(jd: number): [number, number, number] {
  let b: number, c: number
  if (jd > 2299160) {
    const a = jd + 32044
    b = INT((4 * a + 3) / 146097)
    c = a - INT((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = INT((4 * c + 3) / 1461)
  const e = c - INT((1461 * d) / 4)
  const m = INT((5 * e + 2) / 153)
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)]
}

/** Julian day (fractional, UT) of the k-th new moon after 1900-01-01. */
function newMoon(k: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = PI / 180
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) - 0.0004 * Math.sin(dr * (2 * F + M))
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) + 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 += 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2
  return jd1 + C1 - deltat
}

/** Sun's ecliptic longitude in radians [0, 2π) at fractional Julian day jdn (UT). */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525
  const T2 = T * T
  const dr = PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = (L0 + DL) * dr
  L -= PI * 2 * INT(L / (PI * 2))
  return L
}

/** Sun longitude sector (0..11, 30° each) at local midnight starting dayNumber. */
function sunSector(dayNumber: number, tz = TZ): number {
  return INT((sunLongitude(dayNumber - 0.5 - tz / 24) / PI) * 6)
}

function newMoonDay(k: number, tz = TZ): number {
  return INT(newMoon(k) + 0.5 + tz / 24)
}

/** Day number of the start of lunar month 11 (the one containing the winter solstice) of year yy. */
function lunarMonth11(yy: number, tz = TZ): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = INT(off / 29.530588853)
  let nm = newMoonDay(k, tz)
  if (sunSector(nm, tz) >= 9) nm = newMoonDay(k - 1, tz)
  return nm
}

function leapMonthOffset(a11: number, tz = TZ): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last: number
  let i = 1
  let arc = sunSector(newMoonDay(k + i, tz), tz)
  do {
    last = arc
    i++
    arc = sunSector(newMoonDay(k + i, tz), tz)
  } while (arc !== last && i < 14)
  return i - 1
}

export function solarToLunar(dd: number, mm: number, yy: number, tz = TZ): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = newMoonDay(k + 1, tz)
  if (monthStart > dayNumber) monthStart = newMoonDay(k, tz)
  let a11 = lunarMonth11(yy, tz)
  let b11 = a11
  let year: number
  if (a11 >= monthStart) {
    year = yy
    a11 = lunarMonth11(yy - 1, tz)
  } else {
    year = yy + 1
    b11 = lunarMonth11(yy + 1, tz)
  }
  const day = dayNumber - monthStart + 1
  const diff = INT((monthStart - a11) / 29)
  let leap = false
  let month = diff + 11
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, tz)
    if (diff >= leapDiff) {
      month = diff + 10
      if (diff === leapDiff) leap = true
    }
  }
  if (month > 12) month -= 12
  if (month >= 11 && diff < 4) year -= 1
  return { day, month, year, leap, jd: dayNumber }
}

/** → [day, month, year] of the solar date, or null if that leap month doesn't exist. */
export function lunarToSolar(day: number, month: number, year: number, leap = false, tz = TZ): [number, number, number] | null {
  let a11: number, b11: number
  if (month < 11) {
    a11 = lunarMonth11(year - 1, tz)
    b11 = lunarMonth11(year, tz)
  } else {
    a11 = lunarMonth11(year, tz)
    b11 = lunarMonth11(year + 1, tz)
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = month - 11
  if (off < 0) off += 12
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11, tz)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (leap && month !== leapMonth) return null
    if (leap || off >= leapOff) off += 1
  } else if (leap) return null
  return jdToDate(newMoonDay(k + off, tz) + day - 1)
}

/** 29 or 30. */
export function lunarMonthLength(l: LunarDate): number {
  const start = l.jd - l.day + 1
  const [d, m, y] = jdToDate(start + 29)
  return solarToLunar(d, m, y).day === 30 ? 30 : 29
}

/** The leap month (1..12) of a lunar year, or 0. */
export function leapMonthOf(year: number): number {
  for (let m = 1; m <= 12; m++) if (lunarToSolar(1, m, year, true)) return m
  return 0
}

// ---------------------------------------------------------------------------
// Can chi, tiết khí, giờ hoàng đạo
// ---------------------------------------------------------------------------
export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']
export const ZODIAC_EMOJI = ['🐀', '🐃', '🐅', '🐈', '🐉', '🐍', '🐎', '🐐', '🐒', '🐓', '🐕', '🐖']

export const yearChiIndex = (lunarYear: number) => (lunarYear + 8) % 12
export const canChiYear = (y: number) => `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`
export const canChiMonth = (m: number, y: number) => `${CAN[(y * 12 + m + 3) % 10]} ${CHI[(m + 1) % 12]}`
export const canChiDay = (jd: number) => `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`

/** 24 solar terms, index 0 = sun longitude 0° (Xuân phân), 15° apart. */
export const TIET_KHI = [
  'Xuân phân', 'Thanh minh', 'Cốc vũ', 'Lập hạ', 'Tiểu mãn', 'Mang chủng',
  'Hạ chí', 'Tiểu thử', 'Đại thử', 'Lập thu', 'Xử thử', 'Bạch lộ',
  'Thu phân', 'Hàn lộ', 'Sương giáng', 'Lập đông', 'Tiểu tuyết', 'Đại tuyết',
  'Đông chí', 'Tiểu hàn', 'Đại hàn', 'Lập xuân', 'Vũ thủy', 'Kinh trập',
]

/** Index into TIET_KHI for the given day, and whether the term begins that day. */
export function tietKhi(jd: number): { index: number; starts: boolean } {
  const at = (n: number) => INT((sunLongitude(n + 1 - 0.5 - TZ / 24) / PI) * 12)
  const index = at(jd)
  return { index, starts: at(jd - 1) !== index }
}

const GIO_HD = ['110100101100', '001101001011', '110011010010', '101100110100', '001011001101', '010010110011']

/** Auspicious hours of the day: chi name + clock range. */
export function gioHoangDao(jd: number): { chi: string; from: number; to: number }[] {
  const pattern = GIO_HD[((jd + 1) % 12) % 6]
  const out: { chi: string; from: number; to: number }[] = []
  for (let i = 0; i < 12; i++) {
    if (pattern[i] === '1') out.push({ chi: CHI[i], from: (i * 2 + 23) % 24, to: (i * 2 + 1) % 24 })
  }
  return out
}
