import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { parseStatementFile } from "../lib/parsers";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { parseINRAmountString } from "../lib/inrParse";
import type { TxType } from "../types";

export function UploadPage() {
  const { user } = useAuth();
  const { addTransactions, addManualTransaction } = useData();
  const navigate = useNavigate();
  const [fileBusy, setFileBusy] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [category, setCategory] = useState("Other");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    setFileBusy(true);
    setFileMsg(null);
    try {
      const { transactions: txs, meta } = await parseStatementFile(f, user.id);
      if (txs.length === 0) {
        setFileMsg(
          meta.detail ??
            "We couldn't read any transactions from this file. Try your bank's CSV or Excel export, or another statement format.",
        );
        return;
      }
      addTransactions(txs);
      const via =
        meta.mode === "openai"
          ? "Smart statement analysis"
          : meta.mode === "bank"
            ? "Bank PDF layout (credits & debits)"
            : "File column / line parser";
      setFileMsg(`Imported ${txs.length} transactions · ${via}.${meta.detail ? ` ${meta.detail}` : ""}`);
      window.setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setFileMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setFileBusy(false);
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const n = parseINRAmountString(amount) ?? parseFloat(amount.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return;
    addManualTransaction({
      date,
      amount: n,
      description: description.trim() || "Manual entry",
      type,
      category: type === "income" ? "Income" : category,
    });
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload data</h1>
        <p className="text-sm text-slate-500">
          Import a bank statement (PDF, CSV, Excel) or add a manual entry for cash / offline spends.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <FileUp className="h-5 w-5 text-indigo-600" />
          File import
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Supports PDF, CSV, and Excel in Indian rupees (₹), including typical number grouping such as{" "}
          <span className="font-medium text-slate-800">1,23,456.78</span>. For the most accurate results,
          use the statement download your bank provides.
        </p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-10 hover:border-indigo-300">
          {fileBusy ? (
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          ) : (
            <FileUp className="h-8 w-8 text-slate-400" />
          )}
          <span className="mt-2 text-sm font-medium text-slate-700">
            Drop PDF, CSV, or Excel here
          </span>
          <span className="text-xs text-slate-500">or click to browse</span>
          <input
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            className="hidden"
            disabled={fileBusy}
            onChange={onFile}
          />
        </label>
        {fileMsg && (
          <p className="mt-3 text-sm text-indigo-700">{fileMsg}</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Manual entry</h2>
        <form onSubmit={submitManual} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Date</label>
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Amount (₹)</label>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Description</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Groceries — cash"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as TxType)}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={type === "income"}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Save transaction
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
