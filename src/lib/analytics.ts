import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { DashboardDateFilter, Transaction } from "../types";
import { refineCategoryIfOther } from "./categories";
import { formatINR } from "./format";

export interface FilterBounds {
  start: Date;
  end: Date;
}

export function getFilterBounds(filter: DashboardDateFilter): FilterBounds {
  if (filter.mode === "month") {
    const d = parseISO(`${filter.month}-01`);
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }
  const a = parseISO(filter.rangeFrom);
  const b = parseISO(filter.rangeTo);
  const start = a <= b ? startOfDay(a) : startOfDay(b);
  const end = a <= b ? startOfDay(b) : startOfDay(a);
  return { start, end };
}

export function transactionsInRange(
  txs: Transaction[],
  bounds: FilterBounds,
): Transaction[] {
  return txs.filter((t) => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start: bounds.start, end: bounds.end });
  });
}

export function splitMonthIntoWeeks(bounds: FilterBounds): {
  index: 1 | 2 | 3 | 4;
  start: Date;
  end: Date;
}[] {
  const y = bounds.start.getFullYear();
  const m = bounds.start.getMonth();
  const lastDay = endOfMonth(bounds.start).getDate();
  const segments: { index: 1 | 2 | 3 | 4; start: Date; end: Date }[] = [
    {
      index: 1,
      start: new Date(y, m, 1),
      end: new Date(y, m, Math.min(7, lastDay)),
    },
    {
      index: 2,
      start: new Date(y, m, 8),
      end: new Date(y, m, Math.min(14, lastDay)),
    },
    {
      index: 3,
      start: new Date(y, m, 15),
      end: new Date(y, m, Math.min(21, lastDay)),
    },
    {
      index: 4,
      start: new Date(y, m, 22),
      end: new Date(y, m, lastDay),
    },
  ];
  return segments.filter((s) => s.start.getDate() <= lastDay);
}

/** For arbitrary ranges: divide into 4 contiguous day buckets */
export function splitRangeIntoFourParts(bounds: FilterBounds): {
  index: 1 | 2 | 3 | 4;
  start: Date;
  end: Date;
}[] {
  const days = eachDayOfInterval({ start: bounds.start, end: bounds.end });
  if (days.length === 0) {
    return [
      { index: 1, start: bounds.start, end: bounds.end },
      { index: 2, start: bounds.start, end: bounds.end },
      { index: 3, start: bounds.start, end: bounds.end },
      { index: 4, start: bounds.start, end: bounds.end },
    ];
  }
  const chunk = Math.ceil(days.length / 4);
  const out: { index: 1 | 2 | 3 | 4; start: Date; end: Date }[] = [];
  for (let i = 0; i < 4; i++) {
    const slice = days.slice(i * chunk, (i + 1) * chunk);
    if (slice.length === 0) continue;
    out.push({
      index: (i + 1) as 1 | 2 | 3 | 4,
      start: slice[0]!,
      end: slice[slice.length - 1]!,
    });
  }
  while (out.length < 4 && out.length > 0) {
    const last = out[out.length - 1]!;
    out.push({ ...last, index: out.length + 1 as 1 | 2 | 3 | 4 });
  }
  return out.length ? out : splitMonthIntoWeeks(bounds);
}

export function getWeekSegments(bounds: FilterBounds): ReturnType<
  typeof splitMonthIntoWeeks
> {
  const isCalMonth =
    bounds.start.getDate() === 1 &&
    format(bounds.end, "yyyy-MM") === format(bounds.start, "yyyy-MM") &&
    bounds.end.getTime() === endOfMonth(bounds.start).getTime();
  if (isCalMonth) return splitMonthIntoWeeks(bounds);
  return splitRangeIntoFourParts(bounds) as ReturnType<typeof splitMonthIntoWeeks>;
}

function expenseWithRefinedCategory(t: Transaction): Transaction {
  return {
    ...t,
    category: refineCategoryIfOther(t.description, t.category),
  };
}

export function aggregateByCategory(
  txs: Transaction[],
): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const raw of txs) {
    const t = expenseWithRefinedCategory(raw);
    if (t.type !== "expense") continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function totals(txs: Transaction[]): {
  income: number;
  expense: number;
  saved: number;
} {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, saved: income - expense };
}

export function savingsRate(income: number, expense: number): number {
  if (income <= 0) return 0;
  return ((income - expense) / income) * 100;
}

export function buildLeneSays(
  txs: Transaction[],
): { text: string; savingsRatePct: number } {
  const { income, expense, saved } = totals(txs);
  const rate = savingsRate(income, expense);
  const cats = aggregateByCategory(txs);
  const top2 = cats.slice(0, 2).map((c) => c.category);

  let tone: string;
  if (rate >= 25) {
    tone =
      "You're saving at a healthy pace — keep this rhythm and your future self will thank you.";
  } else if (rate >= 15) {
    tone =
      "Your savings rate is okay. Trimming discretionary spends could push it into the comfort zone.";
  } else if (rate >= 0) {
    tone =
      "Savings are tight this period. Worth watching big categories and one-time spikes.";
  } else {
    tone =
      "You spent more than you earned in this window — time to pause and rebalance.";
  }

  const catLine =
    top2.length >= 2
      ? `Top spending: ${top2[0]} and ${top2[1]}.`
      : top2.length === 1
        ? `Top spending category: ${top2[0]}.`
        : "Add a few more transactions to see richer category insights.";

  const rateLabel =
    income > 0
      ? `Savings rate: ${rate.toFixed(0)}% (${formatINR(saved)} saved).`
      : `Net flow: ${formatINR(saved)}.`;

  return {
    text: `${catLine} ${rateLabel} ${tone}`,
    savingsRatePct: rate,
  };
}

export interface WeekInsight {
  week: 1 | 2 | 3 | 4;
  spending: number;
  income: number;
  topCategories: { category: string; amount: number }[];
  balanceEnd: number;
  tip: string;
  smartMessage: string;
}

export function buildWeeklyInsights(
  txs: Transaction[],
  bounds: FilterBounds,
): WeekInsight[] {
  const segments = getWeekSegments(bounds);
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const byWeek: WeekInsight[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const inSeg = sorted.filter((t) => {
      const d = parseISO(t.date);
      return isWithinInterval(d, {
        start: startOfDay(seg.start),
        end: startOfDay(seg.end),
      });
    });
    let spend = 0;
    let inc = 0;
    const catMap = new Map<string, number>();
    for (const t of inSeg) {
      if (t.type === "expense") {
        spend += t.amount;
        const c = refineCategoryIfOther(t.description, t.category);
        catMap.set(c, (catMap.get(c) ?? 0) + t.amount);
      } else {
        inc += t.amount;
      }
    }

    let running = 0;
    const end = startOfDay(seg.end);
    for (const t of sorted) {
      const d = parseISO(t.date);
      if (d < bounds.start || d > end) continue;
      if (t.type === "income") running += t.amount;
      else running -= t.amount;
    }

    const topCategories = [...catMap.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const prevSpend = byWeek[i - 1]?.spending ?? spend;
    let smartMessage = "Steady week.";
    if (i > 0) {
      if (prevSpend > 0 && spend > prevSpend * 1.2) {
        smartMessage = "Spending jumped vs last week — check large purchases.";
      } else if (spend < prevSpend * 0.85 && prevSpend > 0) {
        smartMessage = "Nice work — you spent less than last week.";
      }
    }

    const tip =
      spend > inc && spend > 0
        ? "Review subscriptions and impulse buys this week."
        : "Keep logging cash spends so nothing hides.";

    byWeek.push({
      week: seg.index,
      spending: spend,
      income: inc,
      topCategories,
      balanceEnd: running,
      tip,
      smartMessage,
    });
  }

  return byWeek;
}

export interface DayBehavior {
  highest: { date: string; amount: number } | null;
  lowest: { date: string; amount: number } | null;
  buckets: {
    label: string;
    className: string;
    dates: string[];
  }[];
}

const BUCKET_DEF = [
  { max: 500, label: "Under ₹500", className: "bg-emerald-100 text-emerald-900" },
  {
    max: 1000,
    label: "₹500 – ₹1,000",
    className: "bg-sky-100 text-sky-900",
  },
  {
    max: 3000,
    label: "₹1,000 – ₹3,000",
    className: "bg-amber-100 text-amber-900",
  },
  {
    max: 10000,
    label: "₹3,000 – ₹10,000",
    className: "bg-orange-100 text-orange-900",
  },
  {
    max: Infinity,
    label: "Over ₹10,000",
    className: "bg-rose-100 text-rose-900",
  },
];

export function spendingByDay(txs: Transaction[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    m.set(t.date, (m.get(t.date) ?? 0) + t.amount);
  }
  return m;
}

export function buildDayBehavior(txs: Transaction[]): DayBehavior {
  const dayMap = spendingByDay(txs);
  const entries = [...dayMap.entries()].filter(([, a]) => a > 0);
  if (entries.length === 0) {
    return {
      highest: null,
      lowest: null,
      buckets: BUCKET_DEF.map((b) => ({
        label: b.label,
        className: b.className,
        dates: [],
      })),
    };
  }
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const highest = { date: sorted[0]![0], amount: sorted[0]![1] };
  const sortedAsc = [...entries].sort((a, b) => a[1] - b[1]);
  const lowest = { date: sortedAsc[0]![0], amount: sortedAsc[0]![1] };

  const buckets = BUCKET_DEF.map((def, idx) => {
    const min = idx === 0 ? 0 : BUCKET_DEF[idx - 1]!.max;
    const dates = entries
      .filter(([_, amt]) => amt > min && amt <= def.max)
      .map(([d]) => d)
      .sort();
    return { label: def.label, className: def.className, dates };
  });

  return { highest, lowest, buckets };
}

export interface ExtraAlert {
  type: "warn" | "info" | "success";
  title: string;
  body: string;
}

export function buildExtraAlerts(
  txs: Transaction[],
  weekly: WeekInsight[],
): ExtraAlert[] {
  const alerts: ExtraAlert[] = [];
  const { income, expense } = totals(txs);
  const rate = savingsRate(income, expense);
  if (income > 0 && rate < 20) {
    alerts.push({
      type: "warn",
      title: "Savings rate below 20%",
      body: "Try to keep at least one-fifth of income unspent for resilience.",
    });
  }

  const cats = aggregateByCategory(txs);
  const totalExp = cats.reduce((s, c) => s + c.amount, 0);
  for (const c of cats) {
    if (totalExp > 0 && c.amount / totalExp > 0.4) {
      alerts.push({
        type: "warn",
        title: "Category concentration",
        body: `${c.category} is over 40% of spending — sanity-check if that's intended.`,
      });
      break;
    }
  }

  for (let i = 1; i < weekly.length; i++) {
    const prev = weekly[i - 1]!.spending;
    const cur = weekly[i]!.spending;
    if (prev > 100 && cur > prev * 1.3) {
      alerts.push({
        type: "warn",
        title: "Week-over-week spike",
        body: `Week ${weekly[i]!.week} spending was much higher than the prior week.`,
      });
      break;
    }
  }

  let down = true;
  for (let i = 1; i < weekly.length; i++) {
    if (weekly[i]!.spending >= weekly[i - 1]!.spending) {
      down = false;
      break;
    }
  }
  if (weekly.length >= 2 && down && weekly[0]!.spending > 0) {
    alerts.push({
      type: "success",
      title: "Spending trend",
      body: "Your weekly spending declined each week — great discipline.",
    });
  }

  return alerts;
}

/** Same calendar day in last 3 full months (excluding current filter — uses `today` and expense txs) */
export function sameDayComparison(
  allTx: Transaction[],
  today: Date = new Date(),
): { monthKey: string; label: string; spent: number }[] {
  const day = getDate(today);
  const out: { monthKey: string; label: string; spent: number }[] = [];
  for (let k = 1; k <= 3; k++) {
    const ref = subMonths(today, k);
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const last = endOfMonth(ref).getDate();
    const d = Math.min(day, last);
    const iso = format(new Date(y, m, d), "yyyy-MM-dd");
    let spent = 0;
    for (const t of allTx) {
      if (t.date !== iso || t.type !== "expense") continue;
      spent += t.amount;
    }
    out.push({
      monthKey: format(ref, "yyyy-MM"),
      label: format(ref, "MMM yyyy"),
      spent,
    });
  }
  return out.reverse();
}

export function lastNMonthsOptions(n: number): { value: string; label: string }[] {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = subMonths(startOfMonth(now), i);
    opts.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy"),
    });
  }
  return opts;
}

export function buildShareReportMonthly(
  txs: Transaction[],
  bounds: FilterBounds,
): string {
  const slice = transactionsInRange(txs, bounds);
  const { income, expense, saved } = totals(slice);
  const rate = savingsRate(income, expense);
  const cats = aggregateByCategory(slice).slice(0, 5);
  const weeks = buildWeeklyInsights(slice, bounds);
  const lines = [
    `LENE — Monthly summary (${format(bounds.start, "dd MMM yyyy")} – ${format(bounds.end, "dd MMM yyyy")})`,
    ``,
    `Income: ${formatINR(income)}`,
    `Expenses: ${formatINR(expense)}`,
    `Saved: ${formatINR(saved)} (${rate.toFixed(0)}% savings rate)`,
    ``,
    `Top categories:`,
    ...cats.map((c) => `• ${c.category}: ${formatINR(c.amount)}`),
    ``,
    `Weekly breakdown:`,
    ...weeks.map(
      (w) =>
        `• Week ${w.week}: spent ${formatINR(w.spending)}, income ${formatINR(w.income)}`,
    ),
    ``,
    rate >= 20
      ? "Tip: Consider moving part of savings to your Emergency Fund."
      : "Tip: Aim for 20%+ savings rate when possible.",
  ];
  return lines.join("\n");
}

export function buildShareReportWeekly(
  txs: Transaction[],
  bounds: FilterBounds,
  weekIndex: 1 | 2 | 3 | 4,
): string {
  const slice = transactionsInRange(txs, bounds);
  const weeks = buildWeeklyInsights(slice, bounds);
  const w = weeks.find((x) => x.week === weekIndex) ?? weeks[0];
  if (!w) return "No data for this week.";
  const { income, expense, saved } = totals(slice);
  const rate = savingsRate(income, expense);
  const lines = [
    `LENE — Week ${weekIndex} report`,
    ``,
    `Period: ${format(bounds.start, "MMMM yyyy")}`,
    `Spent this week: ${formatINR(w.spending)}`,
    `Income this week: ${formatINR(w.income)}`,
    ``,
    `Top 3 categories:`,
    ...w.topCategories.map((c) => `• ${c.category}: ${formatINR(c.amount)}`),
    ``,
    `Month-to-date savings rate: ${rate.toFixed(0)}% (${formatINR(saved)} saved overall in selection)`,
    ``,
    w.spending > w.income
      ? "Advice: Trim discretionary spends if this week felt heavy."
      : "Nice — income covered this week's spends.",
  ];
  return lines.join("\n");
}
