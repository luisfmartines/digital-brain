export const MUSCLES: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core',
}
export const muscleLabel = (m: string) => MUSCLES[m] ?? m

export interface SetLike { weight_kg: number | null; reps: number | null; completed: boolean; is_warmup: boolean }
export interface Timing { started_at: string; ended_at: string | null; paused_seconds: number; paused_at: string | null }

export const volumeOf = (sets: SetLike[]) =>
  sets.reduce((a, s) => a + (s.completed && !s.is_warmup ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 0), 0)
export const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')
// Mesma fórmula do servidor
export const xpFor = (volume: number) => Math.min(500, 50 + Math.round(volume / 100))

export function workoutSeconds(w: Timing, now: number) {
  const end = w.ended_at ? new Date(w.ended_at).getTime() : w.paused_at ? new Date(w.paused_at).getTime() : now
  return Math.max(0, Math.floor((end - new Date(w.started_at).getTime()) / 1000) - w.paused_seconds)
}

export function fmtClock(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return [h, m, total % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
export const mins = (secs: number) => Math.max(1, Math.round(secs / 60))

export function relDays(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  const w = Math.floor(d / 7)
  return `${w} week${w > 1 ? 's' : ''} ago`
}

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    return `${h} hour${h > 1 ? 's' : ''} ago`
  }
  return relDays(iso)
}

export const repsText = (min: number | null, max: number | null) =>
  min && max && min !== max ? `${min}-${max}` : String(max ?? min ?? '—')

export const estimateMinutes = (rows: { target_sets: number; rest_seconds: number }[]) =>
  Math.max(5, Math.round(rows.reduce((a, r) => a + r.target_sets * (45 + r.rest_seconds), 0) / 300) * 5)

// Reduz a foto antes de enviar (economiza armazenamento)
export async function resizeImage(file: File, max: number): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), 'image/jpeg', 0.82)
  )
}