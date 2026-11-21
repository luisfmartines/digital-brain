const pad = (n: number) => String(n).padStart(2, '0')

// YYYY-MM-DD no fuso do aparelho (toISOString usaria UTC)
export const localDateStr = (d: Date = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function dayOfYear(d: Date = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}