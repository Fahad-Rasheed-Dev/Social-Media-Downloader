import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface DownloadRecord {
  id: string;
  title: string;
  platform: string;
  format: string;
  quality: string;
  thumbnail?: string;
  uploader?: string;
  duration?: string;
  savedAt: number;
}

interface HistoryContextValue {
  history: DownloadRecord[];
  addRecord: (record: Omit<DownloadRecord, "id" | "savedAt">) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const STORAGE_KEY = "@saveflow_history";

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<DownloadRecord[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setHistory(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const persist = useCallback(async (records: DownloadRecord[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, []);

  const addRecord = useCallback(
    async (record: Omit<DownloadRecord, "id" | "savedAt">) => {
      const full: DownloadRecord = {
        ...record,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        savedAt: Date.now(),
      };
      setHistory((prev) => {
        const next = [full, ...prev].slice(0, 50);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeRecord = useCallback(
    async (id: string) => {
      setHistory((prev) => {
        const next = prev.filter((r) => r.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <HistoryContext.Provider
      value={{ history, addRecord, removeRecord, clearHistory }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider");
  return ctx;
}
