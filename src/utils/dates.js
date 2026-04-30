export function formatDateMD(dateValue) {
  if (!dateValue) return '—'
  return new Date(dateValue).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function ymdFromUtcDate(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

export function todayUtcYMD() {
  return ymdFromUtcDate(new Date())
}

export function addDaysUtc(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map((x) => Number.parseInt(x, 10))
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() + days)
  return ymdFromUtcDate(dt)
}

export function startOfThisMonthUtcYMD() {
  const now = new Date()
  const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return ymdFromUtcDate(dt)
}

