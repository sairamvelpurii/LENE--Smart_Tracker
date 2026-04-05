import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO, startOfDay, isWithinInterval } from "date-fns";
import { ChevronDown, ChevronRight, Mail, MessageCircle, Share2 } from "lucide-react";
import { useData } from "../context/DataContext";
import type { DashboardDateFilter } from "../types";
import {
  aggregateByCategory,
  buildDayBehavior,
  buildExtraAlerts,
  buildLeneSays,
  buildShareReportMonthly,
  buildShareReportWeekly,
  buildWeeklyInsights,
  getFilterBounds,
  getWeekSegments,
  lastNMonthsOptions,
  sameDayComparison,
  totals,
  transactionsInRange,
  type FilterBounds,
} from "../lib/analytics";
import { formatINR, formatINRChartAxis, formatINRDetailed } from "../lib/format";
import { quoteForDay } from "../lib/quotes";

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#64748b", "#eab308"];

const SPEND_DATE_CHIP_STYLES = [
  "border border-violet-200 bg-violet-50 text-violet-900",
  "border border-sky-200 bg-sky-50 text-sky-900",
  "border border-teal-200 bg-teal-50 text-teal-900",
  "border border-amber-200 bg-amber-50 text-amber-900",
  "border border-rose-200 bg-rose-50 text-rose-900",
  "border border-indigo-200 bg-indigo-50 text-indigo-900",
  "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  "border border-cyan-200 bg-cyan-50 text-cyan-900",
];

function spendDateChipClass(isoDate: string): string {
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  return SPEND_DATE_CHIP_STYLES[h % SPEND_DATE_CHIP_STYLES.length]!;
}

function weekSliceTxs(
  all: ReturnType<typeof transactionsInRange>,
  bounds: FilterBounds,
  week: 1 | 2 | 3 | 4,
) {
  const segs = getWeekSegments(bounds);
  const seg = segs.find((s) => s.index === week);
  if (!seg) return all;
  return all.filter((t) => {
    const d = parseISO(t.date);
    return isWithinInterval(d, {
      start: startOfDay(seg.start),
      end: startOfDay(seg.end),
    });
  });
}

export function DashboardPage() {
  const { transactions, emergency, setEmergencyGoal, addEmergencyContribution, deleteEmergencyContribution } =
    useData();

  const monthOpts = useMemo(() => lastNMonthsOptions(6), []);
  const [filter, setFilter] = useState<DashboardDateFilter>(() => ({
    mode: "month",
    month: format(new Date(), "yyyy-MM"),
    rangeFrom: format(new Date(), "yyyy-MM-dd"),
    rangeTo: format(new Date(), "yyyy-MM-dd"),
  }));

  const [pieScope, setPieScope] = useState<"full" | 1 | 2 | 3 | 4>("full");
  const [showMoreCats, setShowMoreCats] = useState(true);
  const [weekOpen, setWeekOpen] = useState<Record<number, boolean>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareKind, setShareKind] = useState<"monthly" | "weekly">("monthly");
  const [shareWeek, setShareWeek] = useState<1 | 2 | 3 | 4>(1);

  const bounds = useMemo(() => getFilterBounds(filter), [filter]);

  const slice = useMemo(
    () => transactionsInRange(transactions, bounds),
    [transactions, bounds],
  );

  const pieInput = useMemo(() => {
    if (pieScope === "full") return slice;
    return weekSliceTxs(slice, bounds, pieScope);
  }, [slice, bounds, pieScope]);

  const catData = useMemo(() => aggregateByCategory(pieInput), [pieInput]);
  const pieDisplay = showMoreCats ? catData : catData.slice(0, 6);
  const { income, expense, saved } = useMemo(() => totals(slice), [slice]);
  const lene = useMemo(() => buildLeneSays(slice), [slice]);
  const weekly = useMemo(() => buildWeeklyInsights(slice, bounds), [slice, bounds]);
  const alerts = useMemo(() => buildExtraAlerts(slice, weekly), [slice, weekly]);
  const dayBehave = useMemo(() => buildDayBehavior(slice.filter((t) => t.type === "expense")), [slice]);
  const sameDay = useMemo(() => sameDayComparison(transactions), [transactions]);

  const weekBars = useMemo(() => {
    return weekly.map((w) => ({
      name: `W${w.week}`,
      Spending: w.spending,
      Income: w.income,
    }));
  }, [weekly]);

  const savingsRate = lene.savingsRatePct;
  const efTotal = emergency.contributions.reduce((s, c) => s + c.amount, 0);
  const efPct =
    emergency.goalAmount > 0 ? Math.min(100, (efTotal / emergency.goalAmount) * 100) : 0;

  const reportText = useMemo(() => {
    if (shareKind === "monthly") return buildShareReportMonthly(transactions, bounds);
    return buildShareReportWeekly(transactions, bounds, shareWeek);
  }, [shareKind, shareWeek, transactions, bounds]);

  const mailtoHref = `mailto:${shareEmail || ""}?subject=${encodeURIComponent("LENE report")}&body=${encodeURIComponent(reportText)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Your money in ₹ — filtered period applies to all widgets.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium uppercase text-slate-500">View</label>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={filter.mode}
              onChange={(e) =>
                setFilter((f) => ({ ...f, mode: e.target.value as "month" | "range" }))
              }
            >
              <option value="month">By month</option>
              <option value="range">Custom range</option>
            </select>
          </div>
          {filter.mode === "month" ? (
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500">Month</label>
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                value={filter.month}
                onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
              >
                {monthOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-medium uppercase text-slate-500">From</label>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={filter.rangeFrom}
                  onChange={(e) => setFilter((f) => ({ ...f, rangeFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase text-slate-500">To</label>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={filter.rangeTo}
                  onChange={(e) => setFilter((f) => ({ ...f, rangeTo: e.target.value }))}
                />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Share2 className="h-4 w-4" />
            Share report
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total money in", value: income, className: "text-emerald-700" },
          { label: "Total money out", value: expense, className: "text-rose-700" },
          { label: "Saved", value: saved, className: saved >= 0 ? "text-indigo-700" : "text-amber-700" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${c.className}`}>{formatINR(c.value)}</p>
          </div>
        ))}
      </section>

      {/* LENE Says */}
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-5">
        <h2 className="text-sm font-semibold text-indigo-900">LENE says</h2>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950">{lene.text}</p>
      </section>

      {/* Pie + weekly bars */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Where your money goes</h2>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={pieScope}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "full") setPieScope("full");
                else setPieScope(parseInt(v, 10) as 1 | 2 | 3 | 4);
              }}
            >
              <option value="full">Full period</option>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
            </select>
          </div>
          {pieDisplay.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500">No expenses in this slice.</p>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieDisplay as { category: string; amount: number }[]}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {pieDisplay.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatINR(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1">
                {pieDisplay.map((c, i) => {
                  const totalCat = pieDisplay.reduce((s, x) => s + x.amount, 0);
                  const pct = totalCat > 0 ? (c.amount / totalCat) * 100 : 0;
                  return (
                    <li
                      key={c.category}
                      className="flex items-center justify-between gap-2 text-xs text-slate-600"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        {c.category}
                      </span>
                      <span>
                        {pct.toFixed(0)}% · {formatINR(c.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {catData.length > 6 && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
                  onClick={() => setShowMoreCats(!showMoreCats)}
                >
                  {showMoreCats ? "Show less" : "Show more categories"}
                </button>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
          <div>
            <h2 className="font-semibold text-slate-900">Weekly spending</h2>
            <p className="text-xs text-slate-500">Total expenses per week segment</p>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINRChartAxis(Number(v))} />
                  <Tooltip formatter={(value) => formatINR(Number(value ?? 0))} />
                  <Bar dataKey="Spending" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Spending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Income vs expense</h2>
            <p className="text-xs text-slate-500">Side-by-side per week</p>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINRChartAxis(Number(v))} />
                  <Tooltip
                    formatter={(value) => formatINR(Number(value ?? 0))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} minPointSize={2} />
                  <Bar dataKey="Spending" fill="#f43f5e" radius={[4, 4, 0, 0]} minPointSize={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      {/* Weekly insights */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Weekly insights</h2>
        {weekly.map((w) => {
          const open = weekOpen[w.week] ?? false;
          return (
            <div key={w.week} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
                onClick={() => setWeekOpen((o) => ({ ...o, [w.week]: !open }))}
              >
                {open ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <span className="font-medium">Week {w.week}</span>
                <span className="text-xs text-slate-500">{w.tip}</span>
                <span className="ml-auto text-sm font-semibold text-slate-800">
                  {formatINR(w.spending)}
                </span>
              </button>
              <div className="h-1.5 bg-slate-100">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{
                    width: `${Math.min(100, (w.spending / (expense || 1)) * 100)}%`,
                  }}
                />
              </div>
              {open && (
                <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                  <p>{w.smartMessage}</p>
                  <p>
                    <span className="font-medium text-slate-800">Running balance (end of week):</span>{" "}
                    {formatINR(w.balanceEnd)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Income this week:</span>{" "}
                    {formatINR(w.income)}
                  </p>
                  <div>
                    <p className="font-medium text-slate-800">Top categories</p>
                    <ul className="mt-1 list-inside list-disc">
                      {w.topCategories.map((c) => (
                        <li key={c.category}>
                          {c.category}: {formatINR(c.amount)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Day behavior */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Your spending behavior</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Highest spend day</p>
            {dayBehave.highest ? (
              <p className="mt-1 text-sm font-medium text-slate-800">
                {dayBehave.highest.date} — {formatINR(dayBehave.highest.amount)}
              </p>
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Most frugal day</p>
            {dayBehave.lowest ? (
              <p className="mt-1 text-sm font-medium text-slate-800">
                {dayBehave.lowest.date} — {formatINR(dayBehave.lowest.amount)}
              </p>
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {dayBehave.buckets.map((b) => (
            <div key={b.label} className="flex flex-wrap gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${b.className}`}>
                {b.label}
              </span>
              {b.dates.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {b.dates.map((d) => (
                    <span
                      key={d}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm ${spendDateChipClass(d)}`}
                    >
                      {d}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-slate-500">—</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Extra alerts */}
      {alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Extra insights</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 text-sm ${
                  a.type === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : a.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <p className="font-semibold">{a.title}</p>
                <p className="mt-1 text-xs opacity-90">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Same day comparison */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Same day comparison</h2>
        <p className="mt-1 text-xs text-slate-500">
          Spending on today&apos;s calendar day over the last 3 months (expenses only).
        </p>
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sameDay.map((d) => ({ label: d.label, spent: d.spent }))}
              margin={{ left: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(v) => formatINRChartAxis(Number(v))} />
              <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatINR(Number(value ?? 0))} />
              <Bar dataKey="spent" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Emergency fund */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Emergency fund</h2>
        <p className="mt-1 text-sm italic text-indigo-800">&ldquo;{quoteForDay()}&rdquo;</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-500">Goal (₹)</label>
            <input
              type="number"
              min={0}
              className="mt-1 block w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={emergency.goalAmount || ""}
              onChange={(e) => setEmergencyGoal(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${efPct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {formatINR(efTotal)} of {formatINR(emergency.goalAmount || 0)} ({efPct.toFixed(0)}%)
        </p>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amt = parseFloat(String(fd.get("amt")));
            const dt = String(fd.get("dt"));
            const note = String(fd.get("note") || "");
            if (!Number.isFinite(amt) || amt <= 0) return;
            addEmergencyContribution({ date: dt, amount: amt, note: note || undefined });
            e.currentTarget.reset();
          }}
        >
          <input type="date" name="dt" required className="rounded-lg border px-2 py-1.5 text-sm" defaultValue={format(new Date(), "yyyy-MM-dd")} />
          <input name="amt" type="number" step="0.01" placeholder="Amount" required className="w-28 rounded-lg border px-2 py-1.5 text-sm" />
          <input name="note" placeholder="Note" className="flex-1 min-w-[120px] rounded-lg border px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
            Add
          </button>
        </form>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {emergency.contributions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>
                {c.date} — {formatINRDetailed(c.amount)}
                {c.note ? ` · ${c.note}` : ""}
              </span>
              <button
                type="button"
                className="text-xs text-rose-600 hover:underline"
                onClick={() => deleteEmergencyContribution(c.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {savingsRate >= 20 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          You saved {savingsRate.toFixed(0)}% this period — consider moving some into your Emergency Fund.
        </div>
      )}

      {/* Share modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Share my report</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-500">Report type</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={shareKind}
                  onChange={(e) => setShareKind(e.target.value as "monthly" | "weekly")}
                >
                  <option value="monthly">Monthly summary</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              {shareKind === "weekly" && (
                <div>
                  <label className="text-xs text-slate-500">Week</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={shareWeek}
                    onChange={(e) => setShareWeek(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4)}
                  >
                    {[1, 2, 3, 4].map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500">Email address</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <pre className="max-h-32 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-wrap">
                {reportText}
              </pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
              >
                <Mail className="h-4 w-4" />
                Send via email
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(reportText)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
              <button
                type="button"
                className="ml-auto rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setShareOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
