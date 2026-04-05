/**
 * INR parsing + sanity checks. Rejects absurd values (merged IDs, wrong columns).
 * Typical personal txn cap: ₹5 crore per row (adjust if needed).
 */
export const MAX_TXN_AMOUNT_INR = 50_000_000;
export const MIN_TXN_AMOUNT_INR = 0.01;

export function isPlausibleTxnAmount(n: number): boolean {
  return (
    Number.isFinite(n) &&
    n >= MIN_TXN_AMOUNT_INR &&
    n <= MAX_TXN_AMOUNT_INR
  );
}

/** Parse a single token (one cell), not a whole sentence */
function parseINRAmountToken(token: string): number | null {
  let s = token.trim();
  if (!s) return null;

  s = s.replace(/^\(|\)$/g, "");
  s = s.replace(/^[−–-]/, "");
  s = s.replace(/₹|inr|rs\.?/gi, "");
  s = s.replace(/\s+/g, "");
  s = s.replace(/\s*(dr|cr|debit|credit)\s*$/gi, "");

  let dec = "";
  const lastDot = s.lastIndexOf(".");
  if (lastDot !== -1 && s.length - lastDot <= 3) {
    const after = s.slice(lastDot + 1).replace(/,/g, "");
    if (/^\d{1,2}$/.test(after)) {
      dec = after;
      s = s.slice(0, lastDot);
    }
  }

  s = s.replace(/,/g, "");
  const combined = dec ? `${s}.${dec}` : s;
  if (!/^\d*\.?\d+$/.test(combined)) return null;

  const num = parseFloat(combined);
  if (!Number.isFinite(num) || num === 0) return null;

  const intPart = combined.split(".")[0] ?? "";
  const intNorm = intPart.replace(/^0+/, "") || "0";
  if (intNorm.length > 10) return null;

  return Math.abs(num);
}

/**
 * Parse amounts from bank CSV/PDF cells: ₹, Rs., Indian grouping (1,23,456.78).
 * If the cell has junk + amount, tries the last plausible token.
 */
export function parseINRAmountString(raw: string): number | null {
  const s0 = raw.trim();
  if (!s0 || s0.length > 80) return null;

  const compact = s0.replace(/\s+/g, " ").trim();
  const tokens = compact.split(" ");

  for (let i = tokens.length - 1; i >= 0; i--) {
    const n = parseINRAmountToken(tokens[i]!);
    if (n !== null && isPlausibleTxnAmount(n)) return n;
  }

  const merged = compact.replace(/\s/g, "");
  const n2 = parseINRAmountToken(merged);
  if (n2 !== null && isPlausibleTxnAmount(n2)) return n2;

  return null;
}

export function parseINRAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.abs(value);
    return isPlausibleTxnAmount(n) ? n : null;
  }
  return parseINRAmountString(String(value));
}
