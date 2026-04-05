import type { TxSource, TxType, Transaction } from "../../types";
import { createId } from "../id";
import { guessTypeFromAmounts, inferCategory } from "../categories";
import { parseINRAmount } from "../inrParse";

function normKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumn(
  row: Record<string, unknown>,
  candidates: string[],
): string | undefined {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const hit = keys.find((k) => normKey(k) === normKey(c));
    if (hit) return hit;
  }
  for (const c of candidates) {
    const hit = keys.find((k) => normKey(k).includes(normKey(c)));
    if (hit) return hit;
  }
  return undefined;
}

/** Excel serial date → yyyy-mm-dd (1900 leap bug ignored for typical bank exports) */
function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null;
  const utc = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const iso = excelSerialToISO(v);
    if (iso) return iso;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    const dd = parseInt(dmy[1]!, 10);
    const mm = parseInt(dmy[2]!, 10);
    let yy = parseInt(dmy[3]!, 10);
    if (yy < 100) yy += 2000;
    const dt = new Date(yy, mm - 1, dd);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const dmy2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (dmy2) {
    const yy = parseInt(dmy2[1]!, 10);
    const mm = parseInt(dmy2[2]!, 10);
    const dd = parseInt(dmy2[3]!, 10);
    const dt = new Date(yy, mm - 1, dd);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function inferTypeFromDescription(desc: string): TxType | null {
  const d = desc.toLowerCase();
  if (
    /\b(salary|interest\s*credited|dividend|cashback\s*credited|credit\s*received|nef?t\s*received|imps\s*received)\b/.test(
      d,
    )
  ) {
    return "income";
  }
  if (
    /\b(upi[-/]|imps[-/]|purchase|paid\s+to|debited|withdrawal|pos|merchant|swiggy|zomato)\b/.test(
      d,
    )
  ) {
    return "expense";
  }
  return null;
}

function detectTypeFromRow(
  row: Record<string, unknown>,
  typeKey: string | undefined,
  debit: number,
  credit: number,
): TxType | null {
  if (typeKey) {
    const t = String(row[typeKey] ?? "").toLowerCase();
    if (
      /\b(dr|debit|withdrawal|paid|purchase|payment|sent|out)\b/.test(t) ||
      t === "d"
    ) {
      return "expense";
    }
    if (
      /\b(cr|credit|deposit|received|salary|refund)\b/.test(t) ||
      t === "c"
    ) {
      return "income";
    }
  }
  if (debit > 0 && credit <= 0) return "expense";
  if (credit > 0 && debit <= 0) return "income";
  return null;
}

export function rowsToTransactions(
  rows: Record<string, unknown>[],
  userId: string,
  source: TxSource,
): Transaction[] {
  if (rows.length === 0) return [];
  const sample = rows[0]!;

  const dateKey =
    findColumn(sample, [
      "date",
      "txn date",
      "transaction date",
      "value date",
      "posting date",
      "trans date",
      "trxn date",
    ]) ?? findColumn(sample, ["posted", "book date"]);

  const descKey =
    findColumn(sample, [
      "description",
      "narration",
      "particulars",
      "remarks",
      "details",
      "transaction details",
      "transaction remarks",
      "payee",
      "merchant",
    ]) ?? Object.keys(sample).find((k) => /desc|narr|particular|remarks/i.test(k));

  const debitKey =
    findColumn(sample, [
      "debit",
      "withdrawal",
      "dr",
      "debit amount",
      "withdrawals",
      "money out",
      "paid out",
    ]) ?? findColumn(sample, ["debits"]);

  const creditKey =
    findColumn(sample, [
      "credit",
      "deposit",
      "cr",
      "credit amount",
      "deposits",
      "money in",
      "received",
    ]) ?? findColumn(sample, ["credits"]);

  const isBlockedAmountHeader = (key: string) => {
    const n = normKey(key);
    return /\b(balance|closing|opening|available|limit|date|time|ref\s*no|ifsc|account\s*no|card\s*no)\b/i.test(
      n,
    );
  };

  let amtKey: string | undefined;
  for (const label of [
    "withdrawal amount",
    "deposit amount",
    "debit amount",
    "credit amount",
    "transaction amount",
    "txn amount",
    "net amount",
    "amount",
    "amt",
  ]) {
    const k = findColumn(sample, [label]);
    if (k && !isBlockedAmountHeader(k)) {
      amtKey = k;
      break;
    }
  }

  const typeKey =
    findColumn(sample, [
      "type",
      "txn type",
      "transaction type",
      "dr / cr",
      "dr/cr",
      "d/c",
    ]) ?? findColumn(sample, ["debit/credit"]);

  const out: Transaction[] = [];
  for (const row of rows) {
    const dateRaw = dateKey ? row[dateKey] : undefined;
    const date = parseDate(dateRaw);
    if (!date) continue;

    let debit = 0;
    let credit = 0;
    if (debitKey) debit = parseINRAmount(row[debitKey]) ?? 0;
    if (creditKey) credit = parseINRAmount(row[creditKey]) ?? 0;

    if (amtKey && debit === 0 && credit === 0) {
      const a = parseINRAmount(row[amtKey]);
      if (a !== null && a > 0) {
        const hinted = detectTypeFromRow(row, typeKey, 0, 0);
        const cell = String(row[amtKey] ?? "").toLowerCase();
        const typeFromCell =
          cell.includes("cr") || cell.includes("credit")
            ? ("income" as const)
            : cell.includes("dr") || cell.includes("debit")
              ? ("expense" as const)
              : null;

        let type: TxType =
          typeFromCell ?? hinted ?? "expense";

        if (typeKey && !typeFromCell) {
          const t2 = detectTypeFromRow(row, typeKey, debit, credit);
          if (t2) type = t2;
        }

        const amount = a;
        const desc = descKey
          ? String(row[descKey] ?? "").trim()
          : "Transaction";

        if (!typeFromCell && !hinted) {
          const fromDesc = inferTypeFromDescription(desc);
          if (fromDesc) type = fromDesc;
        }

        if (amount <= 0) continue;

        out.push({
          id: createId(),
          userId,
          date,
          amount,
          description: desc || "Transaction",
          type,
          category: type === "income" ? "Income" : inferCategory(desc),
          source,
        });
        continue;
      }
    }

    const desc = descKey ? String(row[descKey] ?? "").trim() : "Transaction";

    let type: TxType | null = detectTypeFromRow(row, typeKey, debit, credit);
    if (!type) type = guessTypeFromAmounts(debit, credit);

    let amount = type === "income" ? credit : debit;

    if (amount <= 0 && amtKey) {
      const a = parseINRAmount(row[amtKey]);
      if (a !== null && a > 0) {
        amount = a;
        const hinted = detectTypeFromRow(row, typeKey, debit, credit);
        const fromDesc = inferTypeFromDescription(desc);
        type =
          hinted ?? fromDesc ?? guessTypeFromAmounts(amount, 0);
      }
    }

    if (amount <= 0 || !type) continue;

    out.push({
      id: createId(),
      userId,
      date,
      amount,
      description: desc || "Transaction",
      type,
      category: type === "income" ? "Income" : inferCategory(desc),
      source,
    });
  }
  return out;
}
