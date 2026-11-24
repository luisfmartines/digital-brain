// Quebra o valor em partes para o layout "R$ 5.500,00" com centavos menores
export function brlParts(n: number) {
  const abs = Math.abs(n)
  const [int, cents] = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',')
  return { neg: n < 0, int, cents }
}

export const brl0 = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })

// 33,6% (uma casa) ou 44% (inteiro)
export const pct1 = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`
