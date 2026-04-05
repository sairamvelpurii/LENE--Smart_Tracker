import type { Transaction } from "../../types";
import type { StatementParseMeta } from "./types";
import { parseCsvFile, parseExcelFile } from "./csvExcel";

export type { StatementParseMeta } from "./types";

export interface StatementParseResult {
  transactions: Transaction[];
  meta: StatementParseMeta;
}

export async function parseStatementFile(
  file: File,
  userId: string,
): Promise<StatementParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const { parsePdfToTransactions } = await import("./pdf");
    const { transactions, meta } = await parsePdfToTransactions(file, userId);
    return {
      transactions,
      meta: {
        mode:
          meta.extractor === "llm"
            ? "openai"
            : meta.parserKind === "bank"
              ? "bank"
              : "rules",
        detail: meta.note,
      },
    };
  }
  if (name.endsWith(".csv")) {
    return parseCsvFile(file, userId);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcelFile(file, userId);
  }
  throw new Error("Unsupported file type. Use PDF, CSV, or Excel.");
}

export { parseCsvFile, parseExcelFile };
