export const PASSWORD_RULES = [
  { id: 'len', label: '6+ characters', test: (p: string) => p.length >= 6 },
  { id: 'upper', label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'Number', test: (p: string) => /\d/.test(p) },
]

// Weak = não cumpre o mínimo | Medium = mínimo | Good = 8+ | Strong = 12+ com símbolo
export function passwordStrength(p: string) {
  const ok = PASSWORD_RULES.every((r) => r.test(p))
  let level = 1
  if (ok) level = 2
  if (ok && p.length >= 8) level = 3
  if (ok && p.length >= 12 && /[^A-Za-z0-9]/.test(p)) level = 4
  return { ok, level, label: ['Weak', 'Medium', 'Good', 'Strong'][level - 1] }
}