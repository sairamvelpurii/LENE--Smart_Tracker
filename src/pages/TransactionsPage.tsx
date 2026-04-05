import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useData } from "../context/DataContext";
import { formatINRDetailed } from "../lib/format";

export function TransactionsPage() {
  const { transactions, deleteTransaction, deleteAllTransactions } = useData();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">
            Newest first. Source shows whether the row came from a file import or manual entry.
          </p>
        </div>
        {sorted.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmBulk(true)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-100"
          >
            Delete all
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="w-12 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  No transactions yet. Upload a statement or add a manual entry.
                </td>
              </tr>
            ) : (
              sorted.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{t.date}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-800">{t.description}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.category}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        t.type === "income"
                          ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                          : "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                      }
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{t.source === "pdf" ? "file" : "manual"}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                      t.type === "income" ? "text-emerald-700" : "text-slate-900"
                    }`}
                  >
                    {t.type === "income" ? "+" : "−"}
                    {formatINRDetailed(t.amount)}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => setConfirmId(t.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="font-medium text-slate-900">Delete this transaction?</p>
            <p className="mt-2 text-sm text-slate-600">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                onClick={() => {
                  deleteTransaction(confirmId);
                  setConfirmId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="font-medium text-slate-900">Delete all transactions?</p>
            <p className="mt-2 text-sm text-slate-600">
              This removes every transaction for your account.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setConfirmBulk(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                onClick={() => {
                  deleteAllTransactions();
                  setConfirmBulk(false);
                }}
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
