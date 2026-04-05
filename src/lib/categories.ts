import type { TxType } from "../types";

const KEYWORD_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(rent|housing|pg|flat|lease|landlord)\b/i, category: "Rent / Housing" },
  { pattern: /\b(netflix|spotify|prime|hotstar|subscription|zee5|sony\s*liv)\b/i, category: "Subscriptions" },
  { pattern: /\b(atm|cash\s*withdraw|w\/d|withdrawal)\b/i, category: "Cash Withdrawal" },
  { pattern: /\b(swiggy|zomato|uber\s*eats|food|restaurant|dining)\b/i, category: "Food & Dining" },
  { pattern: /\b(fuel|petrol|diesel|uber|ola|rapido|metro|bus|irctc|railway)\b/i, category: "Transport" },
  { pattern: /\b(amazon|flipkart|myntra|shopping|mart)\b/i, category: "Shopping" },
  { pattern: /\b(electricity|water|gas|broadband|jio|airtel|bill)\b/i, category: "Bills & Utilities" },
  { pattern: /\b(hospital|pharmacy|medical|doctor|health)\b/i, category: "Health" },
  { pattern: /\b(transfer|neft|imps|rtgs|upi|gpay|googlepay|phonepe|paytm|bhim)\b/i, category: "Transfers & UPI" },
  { pattern: /\b(salary|payroll|interest\s*credited|dividend|cashback\s*credited)\b/i, category: "Income" },
  { pattern: /\b(refund|reversal|cashback)\b/i, category: "Income" },
];

export const DEFAULT_CATEGORY = "Other";

export function inferCategory(description: string): string {
  const d = description.trim();
  for (const { pattern, category } of KEYWORD_RULES) {
    if (pattern.test(d)) return category;
  }
  return DEFAULT_CATEGORY;
}

export function refineCategoryIfOther(description: string, current: string): string {
  if (current !== DEFAULT_CATEGORY && current !== "Uncategorized") return current;
  return inferCategory(description);
}

export const CATEGORY_OPTIONS = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Health",
  "Rent / Housing",
  "Subscriptions",
  "Cash Withdrawal",
  "Transfers & UPI",
  "Income",
  "Other",
] as const;

export function guessTypeFromAmounts(debit: number, credit: number): TxType {
  if (credit > 0 && debit <= 0) return "income";
  if (debit > 0 && credit <= 0) return "expense";
  if (debit > 0 && credit > 0) return debit >= credit ? "expense" : "income";
  return "expense";
}
