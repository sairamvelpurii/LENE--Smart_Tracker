export type TxType = "income" | "expense";
export type TxSource = "pdf" | "manual";

export interface Transaction {
  id: string;
  userId: string;
  date: string;
  amount: number;
  description: string;
  type: TxType;
  category: string;
  source: TxSource;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
}

export interface EmergencyContribution {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface EmergencyFund {
  goalAmount: number;
  contributions: EmergencyContribution[];
}

export type DateFilterMode = "month" | "range";

export interface DashboardDateFilter {
  mode: DateFilterMode;
  /** YYYY-MM when mode === month */
  month: string;
  rangeFrom: string;
  rangeTo: string;
}
