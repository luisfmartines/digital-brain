export function parseSetCount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const count = Number(value)
  return Number.isInteger(count) && count >= 1 && count <= 10 ? count : null
}
