export const RANKS = ['Voyager', 'Explorer', 'Navigator', 'Architect', 'Master']

// Mesma curva do onboarding: o nível N termina em 100 * N * (N + 1) XP acumulados
export const xpStart = (level: number) => 100 * (level - 1) * level
export const xpEnd = (level: number) => 100 * level * (level + 1)

export function levelInfo(xp: number | null | undefined, level: number | null | undefined) {
  const lvl = Math.max(1, level ?? 1)
  const total = Math.max(0, xp ?? 0)
  const start = xpStart(lvl)
  const end = xpEnd(lvl)
  const span = end - start
  return {
    level: lvl,
    rank: RANKS[lvl - 1] ?? 'Master',
    xp: total,
    into: Math.max(0, total - start),
    span,
    pct: Math.min(100, Math.max(0, ((total - start) / span) * 100)),
    toNext: Math.max(0, end - total),
  }
}
