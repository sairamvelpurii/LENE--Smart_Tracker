import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EmergencyContribution, EmergencyFund, Transaction } from "../types";
import { createId } from "../lib/id";
import { isPlausibleTxnAmount } from "../lib/inrParse";
import { loadEmergency, loadTx, saveEmergency, saveTx } from "../lib/txStore";
import { useAuth } from "./AuthContext";

interface DataValue {
  transactions: Transaction[];
  emergency: EmergencyFund;
  addTransactions: (t: Transaction[]) => void;
  addManualTransaction: (t: Omit<Transaction, "id" | "userId" | "source">) => void;
  deleteTransaction: (id: string) => void;
  deleteAllTransactions: () => void;
  setEmergencyGoal: (amount: number) => void;
  addEmergencyContribution: (c: Omit<EmergencyContribution, "id">) => void;
  deleteEmergencyContribution: (id: string) => void;
}

const DataContext = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [emergency, setEmergency] = useState<EmergencyFund>({
    goalAmount: 0,
    contributions: [],
  });

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setEmergency({ goalAmount: 0, contributions: [] });
      return;
    }
    const raw = loadTx(user.id);
    const loaded = raw.filter((t) => isPlausibleTxnAmount(t.amount));
    if (loaded.length !== raw.length) saveTx(user.id, loaded);
    setTransactions(loaded);
    setEmergency(loadEmergency(user.id));
  }, [user?.id]);

  const addTransactions = useCallback(
    (incoming: Transaction[]) => {
      if (!user || incoming.length === 0) return;
      const sane = incoming.filter((x) => isPlausibleTxnAmount(x.amount));
      if (sane.length === 0) return;
      setTransactions((prev) => {
        const next = [...sane, ...prev];
        saveTx(user.id, next);
        return next;
      });
    },
    [user],
  );

  const addManualTransaction = useCallback(
    (t: Omit<Transaction, "id" | "userId" | "source">) => {
      if (!user || !isPlausibleTxnAmount(t.amount)) return;
      const full: Transaction = {
        ...t,
        id: createId(),
        userId: user.id,
        source: "manual",
      };
      setTransactions((prev) => {
        const next = [full, ...prev];
        saveTx(user.id, next);
        return next;
      });
    },
    [user],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      if (!user) return;
      setTransactions((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveTx(user.id, next);
        return next;
      });
    },
    [user],
  );

  const deleteAllTransactions = useCallback(() => {
    if (!user) return;
    setTransactions([]);
    saveTx(user.id, []);
  }, [user]);

  const setEmergencyGoal = useCallback(
    (amount: number) => {
      if (!user) return;
      setEmergency((prev) => {
        const next = { ...prev, goalAmount: Math.max(0, amount) };
        saveEmergency(user.id, next);
        return next;
      });
    },
    [user],
  );

  const addEmergencyContribution = useCallback(
    (c: Omit<EmergencyContribution, "id">) => {
      if (!user) return;
      setEmergency((prev) => {
        const row: EmergencyContribution = { ...c, id: createId() };
        const next = {
          ...prev,
          contributions: [row, ...prev.contributions],
        };
        saveEmergency(user.id, next);
        return next;
      });
    },
    [user],
  );

  const deleteEmergencyContribution = useCallback(
    (id: string) => {
      if (!user) return;
      setEmergency((prev) => {
        const next = {
          ...prev,
          contributions: prev.contributions.filter((x) => x.id !== id),
        };
        saveEmergency(user.id, next);
        return next;
      });
    },
    [user],
  );

  const value = useMemo(
    () => ({
      transactions,
      emergency,
      addTransactions,
      addManualTransaction,
      deleteTransaction,
      deleteAllTransactions,
      setEmergencyGoal,
      addEmergencyContribution,
      deleteEmergencyContribution,
    }),
    [
      transactions,
      emergency,
      addTransactions,
      addManualTransaction,
      deleteTransaction,
      deleteAllTransactions,
      setEmergencyGoal,
      addEmergencyContribution,
      deleteEmergencyContribution,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
