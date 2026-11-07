import { lunarMonthLength, type LunarDate } from './amlich'

export interface Holiday {
  vi: string
  en: string
  /** Public day off in Vietnam → shown in red. */
  off?: boolean
}

type Table = Record<string, Holiday>

/** Key "d/m" (lunar, non-leap months only). */
const LUNAR: Table = {
  '1/1': { vi: 'Tết Nguyên Đán', en: 'Lunar New Year', off: true },
  '2/1': { vi: 'Mùng 2 Tết', en: 'Tết holiday', off: true },
  '3/1': { vi: 'Mùng 3 Tết', en: 'Tết holiday', off: true },
  '15/1': { vi: 'Rằm tháng Giêng', en: 'First Full Moon Festival' },
  '3/3': { vi: 'Tết Hàn thực', en: 'Cold Food Festival' },
  '10/3': { vi: 'Giỗ Tổ Hùng Vương', en: "Hung Kings' Commemoration", off: true },
  '15/4': { vi: 'Lễ Phật Đản', en: "Buddha's Birthday" },
  '5/5': { vi: 'Tết Đoan Ngọ', en: 'Mid-year Festival (Đoan Ngọ)' },
  '15/7': { vi: 'Lễ Vu Lan', en: 'Vu Lan (Ghost Festival)' },
  '15/8': { vi: 'Tết Trung Thu', en: 'Mid-Autumn Festival' },
  '9/9': { vi: 'Tết Trùng Cửu', en: 'Double Ninth Festival' },
  '10/10': { vi: 'Tết Thường Tân', en: 'New Rice Festival' },
  '23/12': { vi: 'Ông Công Ông Táo', en: "Kitchen Gods' Day" },
}

/** Key "d/m" (solar). */
const SOLAR: Table = {
  '1/1': { vi: 'Tết Dương lịch', en: "New Year's Day", off: true },
  '14/2': { vi: 'Lễ Tình nhân', en: "Valentine's Day" },
  '8/3': { vi: 'Quốc tế Phụ nữ', en: "International Women's Day" },
  '30/4': { vi: 'Ngày Giải phóng miền Nam', en: 'Reunification Day', off: true },
  '1/5': { vi: 'Quốc tế Lao động', en: 'Labour Day', off: true },
  '1/6': { vi: 'Quốc tế Thiếu nhi', en: "Children's Day" },
  '2/9': { vi: 'Quốc khánh', en: 'National Day', off: true },
  '20/10': { vi: 'Ngày Phụ nữ Việt Nam', en: "Vietnamese Women's Day" },
  '20/11': { vi: 'Ngày Nhà giáo Việt Nam', en: "Teachers' Day" },
  '24/12': { vi: 'Đêm Giáng sinh', en: 'Christmas Eve' },
  '25/12': { vi: 'Lễ Giáng sinh', en: 'Christmas Day' },
}

const NEW_YEARS_EVE: Holiday = { vi: 'Giao thừa', en: "Lunar New Year's Eve", off: true }

export function holidaysOn(d: number, m: number, l: LunarDate): Holiday[] {
  const out: Holiday[] = []
  if (!l.leap) {
    const h = LUNAR[`${l.day}/${l.month}`]
    if (h) out.push(h)
    if (l.month === 12 && l.day >= 29 && l.day === lunarMonthLength(l)) out.push(NEW_YEARS_EVE)
  }
  const s = SOLAR[`${d}/${m}`]
  if (s) out.push(s)
  return out
}
