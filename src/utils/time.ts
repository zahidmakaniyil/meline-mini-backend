export function parseHHmm(value: string): { h: number; m: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) throw new Error(`Invalid time format (expected HH:mm): ${value}`)
  return { h: Number(match[1]), m: Number(match[2]) }
}

export function dateAtLocalTime(date: Date, time: string): Date {
  const { h, m } = parseHHmm(time)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}
