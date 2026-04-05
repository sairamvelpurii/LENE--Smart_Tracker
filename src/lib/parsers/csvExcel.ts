import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Transaction } from "../../types";
import { extractWithLlmApi } from "./llmClient";
import type { StatementParseMeta } from "./types";
import { rowsToTransactions } from "./table";

export async function parseCsvFile(
  file: File,
  userId: string,
): Promise<{ transactions: Transaction[]; meta: StatementParseMeta }> {
  const rawText = await file.text();

  const tableRows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(rawText, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        resolve(res.data.filter((r) => Object.keys(r).length > 0));
      },
      error: reject,
    });
  });

  let txs = rowsToTransactions(tableRows, userId, "pdf");
  if (txs.length > 0) {
    return { transactions: txs, meta: { mode: "rules" } };
  }

  const llm = await extractWithLlmApi(rawText, file.name, userId, "pdf");
  if (llm.transactions.length > 0) {
    return { transactions: llm.transactions, meta: { mode: "openai" } };
  }

  return {
    transactions: [],
    meta: {
      mode: "rules",
      detail:
        llm.apiError ??
        "No rows from columns or AI. Check CSV headers (Date, Description, Debit/Credit) or add OPENAI_API_KEY.",
    },
  };
}

export async function parseExcelFile(
  file: File,
  userId: string,
): Promise<{ transactions: Transaction[]; meta: StatementParseMeta }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) {
    return { transactions: [], meta: { mode: "rules", detail: "Empty workbook." } };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  let txs = rowsToTransactions(rows, userId, "pdf");
  if (txs.length > 0) {
    return { transactions: txs, meta: { mode: "rules" } };
  }

  const csvText = XLSX.utils.sheet_to_csv(sheet);
  const llm = await extractWithLlmApi(csvText, file.name, userId, "pdf");
  if (llm.transactions.length > 0) {
    return { transactions: llm.transactions, meta: { mode: "openai" } };
  }

  return {
    transactions: [],
    meta: {
      mode: "rules",
      detail:
        llm.apiError ??
        "No rows parsed. Export as CSV or set OPENAI_API_KEY for AI extraction.",
    },
  };
}
