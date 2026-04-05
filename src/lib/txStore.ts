import type { EmergencyFund, Transaction } from "../types";
import { efKey, txKey } from "./storageKeys";

export function loadTx(userId: string): Transaction[] {
  try {
    const raw = localStorage.getItem(txKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as Transaction[];
  } catch {
    return [];
  }
}

export function saveTx(userId: string, txs: Transaction[]): void {
  localStorage.setItem(txKey(userId), JSON.stringify(txs));
}

export function loadEmergency(userId: string): EmergencyFund {
  try {
    const raw = localStorage.getItem(efKey(userId));
    if (!raw) return { goalAmount: 0, contributions: [] };
    return JSON.parse(raw) as EmergencyFund;
  } catch {
    return { goalAmount: 0, contributions: [] };
  }
}

export function saveEmergency(userId: string, ef: EmergencyFund): void {
  localStorage.setItem(efKey(userId), JSON.stringify(ef));
}
