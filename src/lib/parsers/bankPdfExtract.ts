import type { Transaction, TxSource } from "../../types";
import { createId } from "../id";
import { inferCategory } from "../categories";
import { parseINRAmountString } from "../inrParse";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function toISO(y: number, m: number, d: number): string | null {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export type BankProfile = "canara" | "idfc" | "slice" | null;

export function detectBankPdfProfile(text: string): BankProfile {
  const t = text.slice(0, 25_000).toLowerCase();
  if (
    (t.includes("canara") || t.includes("cnrb")) &&
    t.includes("deposits") &&
    t.includes("withdrawals")
  ) {
    return "canara";
  }
  if (
    t.includes("idfc first") ||
    (t.includes("payment type") && t.includes("transaction name") && t.includes("category"))
  ) {
    return "idfc";
  }
  if (t.includes("slice small finance") || t.includes("sliceit.com")) {
    return "slice";
  }
  return null;
}

/** Canara: Date | ... | txnAmount |   | balance — direction from UPI/CR vs UPI/DR */
export function extractCanaraFromText(
  text: string,
  userId: string,
  source: TxSource,
): Transaction[] {
  const segments = text.split(/(?=\d{2}-\d{2}-\d{4}\|)/);
  const out: Transaction[] = [];

  for (const seg of segments) {
    const m = seg.match(/^(\d{2})-(\d{2})-(\d{4})\|([\s\S]+)/);
    if (!m) continue;
    const dd = parseInt(m[1]!, 10);
    const mm = parseInt(m[2]!, 10);
    const yyyy = parseInt(m[3]!, 10);
    const rest = m[4]!;
    const date = toISO(yyyy, mm - 1, dd);
    if (!date) continue;

    if (!/\bUPI\//i.test(rest)) continue;

    let type: "income" | "expense" | null = null;
    if (/\bUPI\/CR\b|\/CR\//i.test(rest)) type = "income";
    else if (/\bUPI\/DR\b|\/DR\//i.test(rest)) type = "expense";
    if (!type) continue;

    const pair = rest.match(/\|([\d,]+\.\d{2})\s*\|\s*\|\s*([\d,]+\.\d{2})/);
    if (!pair) continue;

    const amount = parseINRAmountString(pair[1]!);
    if (amount === null) continue;

    const descPart = rest.slice(0, rest.indexOf(pair[0]!)).replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    const description = (descPart || "UPI").slice(0, 280);

    out.push({
      id: createId(),
      userId,
      date,
      amount,
      description,
      type,
      category: type === "income" ? "Income" : inferCategory(description),
      source,
    });
  }
  return out;
}

/** IDFC: + ₹ always credit; otherwise last ₹ on row is debit (payment / ATM / etc.) */
export function extractIdfcFromText(
  text: string,
  userId: string,
  source: TxSource,
): Transaction[] {
  const segments = text.split(/(?=\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}\s*\|)/);
  const out: Transaction[] = [];

  for (const seg of segments) {
    const m = seg.match(/^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})\s*\|([\s\S]+)/);
    if (!m) continue;
    const d = parseInt(m[1]!, 10);
    const mon = MONTHS[m[2]!.toLowerCase().slice(0, 3)] ?? -1;
    const y = parseInt(m[3]!, 10);
    if (mon < 0) continue;
    const body = m[4]!;
    const date = toISO(y, mon, d);
    if (!date) continue;

    if (!body.includes("₹")) continue;

    const plusM = body.match(/\+\s*₹\s*([\d,.]+)/);
    let type: "income" | "expense";
    let amountStr: string;

    if (plusM) {
      type = "income";
      amountStr = plusM[1]!;
    } else {
      const all = [...body.matchAll(/₹\s*([\d,.]+)/g)];
      if (all.length === 0) continue;
      type = "expense";
      amountStr = all[all.length - 1]![1]!;
    }

    const amount = parseINRAmountString(amountStr.replace(/,/g, ""));
    if (amount === null) continue;

    const parts = body.split("|").map((s) => s.trim());
    let description = "Transaction";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      if (
        p &&
        p.length > 2 &&
        !/^(UPI payment|UPI receipt|Cash withdrawal|Bulk Transfer|Others|Digital Payments)$/i.test(
          p,
        ) &&
        !/^[\d,.]+$/.test(p) &&
        !/^\+?\s*₹/.test(p)
      ) {
        description = p.slice(0, 280);
        break;
      }
    }

    out.push({
      id: createId(),
      userId,
      date,
      amount,
      description,
      type,
      category: type === "income" ? "Income" : inferCategory(description),
      source,
    });
  }
  return out;
}

/** Slice: -₹ = debit; UPI Credit / Interest Cr / Payout credits without minus */
export function extractSliceFromText(
  text: string,
  userId: string,
  source: TxSource,
): Transaction[] {
  const segments = text.split(/(?=\d{1,2}\s+[A-Za-z]{3}\s+'\d{2}\s*\|)/);
  const out: Transaction[] = [];

  for (const seg of segments) {
    const m = seg.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})\s*\|([\s\S]+)/);
    if (!m) continue;
    const d = parseInt(m[1]!, 10);
    const mon = MONTHS[m[2]!.toLowerCase().slice(0, 3)] ?? -1;
    const yy = parseInt(m[3]!, 10);
    if (mon < 0) continue;
    const y = 2000 + yy;
    const body = m[4]!;
    const date = toISO(y, mon, d);
    if (!date) continue;

    const neg = body.match(/-₹\s*([\d,]+(?:\.\d+)?)/);
    if (neg) {
      const amount = parseINRAmountString(neg[1]!);
      if (amount === null) continue;
      const desc =
        body
          .split("|")
          .map((s) => s.trim())
          .find((s) =>
            /UPI\s+Debit|UPI\s+Credit|Debit|Interest|Payout|monies|transfer/i.test(s),
          ) ?? "Debit";
      out.push({
        id: createId(),
        userId,
        date,
        amount,
        description: desc,
        type: "expense",
        category: inferCategory(desc),
        source,
      });
      continue;
    }

    const isCredit =
      /\bUPI\s+Credit\b/i.test(body) ||
      /\bInterest\s+Cr\b/i.test(body) ||
      /\bPayout\b/i.test(body) ||
      /\bmonies transfer\b/i.test(body);

    if (!isCredit) continue;

    const amounts = [...body.matchAll(/₹\s*([\d,]+(?:\.\d+)?)/g)].map((x) => x[1]!);
    if (amounts.length === 0) continue;

    let amountStr: string;
    if (amounts.length >= 2) {
      amountStr = amounts[amounts.length - 2]!;
    } else {
      amountStr = amounts[0]!;
    }

    const amount = parseINRAmountString(amountStr);
    if (amount === null) continue;

    const desc =
      body
        .split("|")
        .map((s) => s.trim())
        .find((s) => s.length > 3 && !/^\d{10,}$/.test(s) && !s.startsWith("₹")) ?? "Credit";

    out.push({
      id: createId(),
      userId,
      date,
      amount,
      description: desc.slice(0, 280),
      type: "income",
      category: "Income",
      source,
    });
  }
  return out;
}

export function extractByBankProfile(
  text: string,
  userId: string,
  source: TxSource,
): { profile: BankProfile; transactions: Transaction[] } {
  const profile = detectBankPdfProfile(text);
  if (!profile) return { profile: null, transactions: [] };

  if (profile === "canara") {
    return { profile, transactions: extractCanaraFromText(text, userId, source) };
  }
  if (profile === "idfc") {
    return { profile, transactions: extractIdfcFromText(text, userId, source) };
  }
  return { profile, transactions: extractSliceFromText(text, userId, source) };
}
