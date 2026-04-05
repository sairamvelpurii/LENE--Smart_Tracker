const MAX_AMOUNT = 50_000_000;

export interface LlmTransactionRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

const SYSTEM = `You extract individual money movements from Indian bank or credit card statement text (HDFC, SBI, ICICI, Axis, Kotak, etc.).
Return JSON: { "transactions": [ ... ] } only.

Each item:
- date: YYYY-MM-DD (use statement year; if missing, infer from context)
- description: short human-readable narration only (no account numbers, no 12+ digit IDs)
- amount: ONE positive INR number per row, max 2 decimal places. Typical personal transactions are under ₹10,00,000. NEVER concatenate digits from multiple columns. NEVER use running balance, total, or card number as amount.
- type: "expense" for money out (debit, UPI paid, purchase, fee, ATM withdrawal, EMI, bill payment)
- type: "income" for money in (salary credit, interest credited, refund received, cash deposit, NEFT/IMPS received)

STRICT rules:
- Skip: opening/closing balance, available balance, total debits/credits, page headers, IFSC-only lines, statement summary rows.
- If unsure between balance and transaction amount, SKIP the row.
- Do not invent amounts; they must appear explicitly in the text for that row.`;

export async function extractTransactionsWithOpenAI(
  statementText: string,
  apiKey: string,
  model: string,
): Promise<LlmTransactionRow[]> {
  const text = statementText.slice(0, 120_000);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.05,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Extract all transactions from this statement:\n\n${text}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Empty model response");

  content = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(content) as { transactions?: unknown };
  const raw = parsed.transactions;
  if (!Array.isArray(raw)) return [];

  const out: LlmTransactionRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const date = String(o.date ?? "").trim();
    const description = String(o.description ?? "").trim();
    const amount = Number(o.amount);
    const type = o.type === "income" ? "income" : "expense";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) continue;
    if (!description) continue;
    out.push({ date, description: description.slice(0, 500), amount, type });
  }
  return out;
}
