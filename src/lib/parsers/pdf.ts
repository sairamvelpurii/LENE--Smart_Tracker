import * as pdfjs from "pdfjs-dist";
import type { Transaction } from "../../types";
import { parseINRAmountString } from "../inrParse";
import { rowsToTransactions } from "./table";
import { extractByBankProfile } from "./bankPdfExtract";
import { extractWithLlmApi } from "./llmClient";

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface TextItem {
  x: number;
  y: number;
  str: string;
}

function clusterLines(items: TextItem[], yTol = 4): string[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: string[] = [];
  let bucket: TextItem[] = [];
  let refY = sorted[0]!.y;

  const flush = () => {
    if (bucket.length === 0) return;
    bucket.sort((a, b) => a.x - b.x);
    const line = bucket
      .map((b) => b.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) lines.push(line);
    bucket = [];
  };

  for (const it of sorted) {
    if (bucket.length === 0) {
      bucket.push(it);
      refY = it.y;
      continue;
    }
    if (Math.abs(it.y - refY) <= yTol) {
      bucket.push(it);
      refY = (refY * (bucket.length - 1) + it.y) / bucket.length;
    } else {
      flush();
      bucket.push(it);
      refY = it.y;
    }
  }
  flush();
  return lines;
}

export async function extractPdfPlainText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pageLines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items) {
      if (!("str" in it) || typeof it.str !== "string" || !it.str.trim()) continue;
      const tr = it.transform;
      const x = tr?.[4] ?? 0;
      const y = tr?.[5] ?? 0;
      items.push({ x, y, str: it.str.trim() });
    }
    pageLines.push(...clusterLines(items));
    pageLines.push("");
  }
  return pageLines.join("\n");
}

function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

type AmountHit = {
  amount: number;
  raw: string;
  markerType: "income" | "expense" | null;
  hasSignal: boolean;
};

function markerToType(marker: string): "income" | "expense" | null {
  const m = marker.toLowerCase();
  if (/\b(cr|credit)\b/.test(m)) return "income";
  if (/\b(dr|debit)\b/.test(m)) return "expense";
  if (m.includes("+")) return "income";
  if (m.includes("-")) return "expense";
  return null;
}

function amountHitsFromText(rest: string): AmountHit[] {
  const hits: AmountHit[] = [];
  const re =
    /([+-])?\s*(₹|Rs\.?|INR)?\s*(\(?\d[\d,]*(?:\.\d{1,2})?\)?)\s*(dr|cr|debit|credit)?/gi;

  for (const m of rest.matchAll(re)) {
    const amountStr = m[3]?.trim();
    if (!amountStr) continue;
    const amount = parseINRAmountString(amountStr);
    if (amount === null || amount <= 0) continue;

    const sign = m[1] ?? "";
    const currency = m[2] ?? "";
    const suffix = m[4] ?? "";
    hits.push({
      amount,
      raw: m[0]?.trim() ?? amountStr,
      markerType: markerToType(`${sign} ${suffix}`),
      hasSignal: Boolean(sign || currency || suffix),
    });
  }
  return hits;
}

function tryParseLine(line: string): Record<string, unknown> | null {
  const dateMatch = line.match(
    /\b(?:(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})|(\d{2})(\d{2})(\d{2,4}))\b/,
  );
  if (!dateMatch) return null;
  const dd = parseInt(dateMatch[1] ?? dateMatch[4] ?? "", 10);
  const mm = parseInt(dateMatch[2] ?? dateMatch[5] ?? "", 10);
  let yy = parseInt(dateMatch[3] ?? dateMatch[6] ?? "", 10);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return null;
  if (yy < 100) yy += 2000;
  const d = new Date(yy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toISOString().slice(0, 10);

  const dIdx = line.indexOf(dateMatch[0]!);
  const rest = dIdx >= 0 ? line.slice(dIdx + dateMatch[0]!.length) : line;
  const hits = amountHitsFromText(rest);
  const signalHits = hits.filter((h) => h.hasSignal || h.markerType !== null);
  const bestHit =
    signalHits.length > 0
      ? signalHits[signalHits.length - 1]!
      : hits.length > 0
        ? hits[hits.length - 1]!
        : null;
  const amount = bestHit?.amount ?? null;
  if (amount === null || amount <= 0) return null;

  const typeStr = line.toLowerCase();
  const markerType = bestHit?.markerType ?? null;
  const isCredit =
    markerType === "income" ||
    (markerType !== "expense" &&
      /\bcr\b|credit|salary|interest\s*credited|received|deposit/i.test(typeStr) &&
      !/\b(dr|debit|paid|purchase|upi-?sent|withdraw)\b/i.test(typeStr));
  const debit = isCredit ? 0 : amount;
  const credit = isCredit ? amount : 0;

  const desc = line
    .replace(dateMatch[0], "")
    .replace(bestHit?.raw ?? "", "")
    .replace(/\b(dr|cr|debit|credit)\b/gi, "")
    .replace(/(?:₹|Rs\.?|INR)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  return {
    Date: date,
    Description: desc || "Bank line",
    Debit: debit,
    Credit: credit,
  };
}

function heuristicFromText(full: string, userId: string): Transaction[] {
  const rows: Record<string, unknown>[] = [];
  for (const line of linesFromText(full)) {
    const row = tryParseLine(line);
    if (row) rows.push(row);
  }
  if (rows.length === 0) {
    const loose = full.match(
      /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[^\d]{0,60}[\d,]+(?:\.\d{2})?/g,
    );
    if (loose) {
      for (const l of loose) {
        const row = tryParseLine(l);
        if (row) rows.push(row);
      }
    }
  }
  return rowsToTransactions(rows, userId, "pdf");
}

export type PdfParseMeta = {
  extractor: "llm" | "local";
  /** Bank-specific layout (Canara / IDFC / Slice) */
  parserKind?: "bank" | "llm" | "heuristic";
  note?: string;
};

export async function parsePdfToTransactions(
  file: File,
  userId: string,
): Promise<{ transactions: Transaction[]; meta: PdfParseMeta }> {
  const fullText = await extractPdfPlainText(file);

  const bank = extractByBankProfile(fullText, userId, "pdf");
  if (bank.profile && bank.transactions.length > 0) {
    return {
      transactions: bank.transactions,
      meta: {
        extractor: "local",
        parserKind: "bank",
        note: `Matched ${bank.profile === "canara" ? "Canara Bank" : bank.profile === "idfc" ? "IDFC FIRST Bank" : "Slice (Small Finance Bank)"} layout — credits vs debits applied.`,
      },
    };
  }

  const llm = await extractWithLlmApi(fullText, file.name, userId, "pdf");
  if (llm.transactions.length > 0) {
    return {
      transactions: llm.transactions,
      meta: { extractor: "llm", parserKind: "llm" },
    };
  }

  const local = heuristicFromText(fullText, userId);
  return {
    transactions: local,
    meta: {
      extractor: "local",
      parserKind: "heuristic",
      note: llm.apiError
        ? `AI extraction failed (${llm.apiError}). Using generic line parser.`
        : undefined,
    },
  };
}
