export const EMERGENCY_QUOTES = [
  "Small, steady contributions beat perfect plans you never start.",
  "An emergency fund turns a crisis into an inconvenience.",
  "Pay your future self first — even ₹500 counts.",
  "Peace of mind is part of the return.",
  "Liquidity is the superpower they never put in brochures.",
];

export function quoteForDay(d: Date = new Date()): string {
  const i = (d.getFullYear() * 31 + d.getMonth() * 12 + d.getDate()) % EMERGENCY_QUOTES.length;
  return EMERGENCY_QUOTES[i]!;
}
