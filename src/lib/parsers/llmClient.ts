import type { Transaction, TxSource } from "../../types";
import { createId } from "../id";
import { inferCategory } from "../categories";
import { isPlausibleTxnAmount } from "../inrParse";

export interface LlmTransactionRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export interface LlmExtractResult {
  transactions: Transaction[];
  usedLlm: boolean;
  /** Set when API responded with an error (not 503 no key) */
  apiError?: string;
}

export function mapLlmRowsToTransactions(
  rows: LlmTransactionRow[],
  userId: string,
  source: TxSource,
): Transaction[] {
  const out: Transaction[] = [];
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || !isPlausibleTxnAmount(amt)) continue;
    const type = r.type === "income" ? "income" : "expense";
    const desc = (r.description || "Transaction").slice(0, 500);
    out.push({
      id: createId(),
      userId,
      date: r.date,
      amount: Math.abs(amt),
      description: desc,
      type,
      category: type === "income" ? "Income" : inferCategory(desc),
      source,
    });
  }
  return out;
}

/** Calls dev-server /api/extract-statement (OpenAI on server). */
export async function extractWithLlmApi(
  text: string,
  fileHint: string,
  userId: string,
  source: TxSource,
): Promise<LlmExtractResult> {
  const trimmed = text.slice(0, 120_000);
  if (!trimmed.trim()) {
    return { transactions: [], usedLlm: false };
  }

  try {
    const r = await fetch("/api/extract-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, fileHint }),
    });

    const j = (await r.json()) as {
      transactions?: LlmTransactionRow[];
      error?: string;
      message?: string;
    };

    if (r.status === 503 && j.error === "no_api_key") {
      return { transactions: [], usedLlm: false };
    }

    if (!r.ok) {
      return {
        transactions: [],
        usedLlm: false,
        apiError:
          (typeof j.message === "string" && j.message) ||
          (typeof j.error === "string" && j.error) ||
          `HTTP ${r.status}`,
      };
    }

    const rows = Array.isArray(j.transactions) ? j.transactions : [];
    const transactions = mapLlmRowsToTransactions(rows, userId, source);
    return { transactions, usedLlm: true };
  } catch {
    return {
      transactions: [],
      usedLlm: false,
      apiError: "Could not reach /api/extract-statement (is the dev server running?)",
    };
  }
}
