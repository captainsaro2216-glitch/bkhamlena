import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type HistoryEntry = {
  id: string;
  rows: number;
  total: number;
  values: number[];
  createdAt: number;
};

const HISTORY_KEY = "integer-splitter-history";
const HISTORY_LIMIT = 20;

function generateIntegers(n: number, total: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [total];

  const mean = total / n;
  const spread = Math.max(1, Math.floor(Math.abs(mean) * 0.35));

  const values: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const base = Math.round(mean);
    const jitter = Math.floor(Math.random() * (2 * spread + 1)) - spread;
    values[i] = base + jitter;
  }

  let diff = total - values.reduce((a, b) => a + b, 0);
  while (diff !== 0) {
    const idx = Math.floor(Math.random() * n);
    if (diff > 0) {
      values[idx] += 1;
      diff -= 1;
    } else {
      values[idx] -= 1;
      diff += 1;
    }
  }

  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const Index = () => {
  const [rows, setRows] = useState<string>("10");
  const [total, setTotal] = useState<string>("1000");
  const [results, setResults] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  const sum = useMemo(() => results.reduce((a, b) => a + b, 0), [results]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(rows, 10);
    const t = parseInt(total, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Rows must be a positive integer");
      return;
    }
    if (!Number.isFinite(t) || !/^-?\d+$/.test(total.trim())) {
      toast.error("Target total must be an integer (no decimals)");
      return;
    }
    const values = generateIntegers(n, t);
    setResults(values);

    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rows: n,
      total: t,
      values,
      createdAt: Date.now(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
    setSelectedId(entry.id);
  };

  const copyValues = async (values: number[]) => {
    if (!values.length) return;
    try {
      await navigator.clipboard.writeText(values.join("\n"));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const loadEntry = (entry: HistoryEntry) => {
    setResults(entry.values);
    setRows(String(entry.rows));
    setTotal(String(entry.total));
    setSelectedId(entry.id);
  };

  const removeEntry = (id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const clearHistory = () => {
    setHistory([]);
    setSelectedId(null);
  };

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Integer Splitter
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate random whole numbers that sum to an exact total.
          </p>
        </header>

        <form onSubmit={handleGenerate} className="glass-panel p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-2 block text-sm text-muted-foreground">
                Number of rows
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={rows}
                onChange={(e) => setRows(e.target.value.replace(/[^\d]/g, ""))}
                className="glass-input"
                placeholder="e.g. 10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-muted-foreground">
                Target total
              </span>
              <input
                inputMode="numeric"
                pattern="-?[0-9]*"
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/[^\d-]/g, ""))}
                className="glass-input"
                placeholder="e.g. 1000"
              />
            </label>
          </div>

          <button type="submit" className="glass-button mt-6 w-full">
            Generate
          </button>
        </form>

        {results.length > 0 && (
          <section className="glass-panel mt-6 p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{results.length}</span> rows ·
                sum <span className="text-foreground font-medium">{sum}</span>
              </div>
              <button
                onClick={() => copyValues(results)}
                className="glass-button px-5 py-2 text-sm"
              >
                Copy
              </button>
            </div>

            <div
              className="max-h-[60vh] overflow-y-auto rounded-xl border"
              style={{ borderColor: "hsl(var(--aqua) / 0.18)" }}
            >
              <table className="w-full">
                <tbody>
                  {results.map((v, i) => (
                    <tr
                      key={i}
                      className="border-b last:border-b-0"
                      style={{ borderColor: "hsl(var(--aqua) / 0.1)" }}
                    >
                      <td className="px-5 py-3 font-mono text-base tabular-nums">
                        {v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="glass-panel mt-6 p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-medium">History</h2>
                <p className="text-xs text-muted-foreground">
                  Last {history.length} of {HISTORY_LIMIT} kept locally
                </p>
              </div>
              <button
                onClick={clearHistory}
                className="glass-button px-4 py-2 text-xs"
              >
                Clear
              </button>
            </div>

            <ul className="space-y-2">
              {history.map((entry) => {
                const isActive = entry.id === selectedId;
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border transition-colors"
                    style={{
                      borderColor: isActive
                        ? "hsl(var(--aqua) / 0.6)"
                        : "hsl(var(--aqua) / 0.15)",
                      background: isActive
                        ? "hsl(var(--aqua) / 0.08)"
                        : "hsl(var(--foreground) / 0.03)",
                    }}
                  >
                    <div className="flex items-center gap-2 p-3">
                      <button
                        onClick={() => loadEntry(entry)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium tabular-nums">
                          {entry.rows} rows · sum {entry.total}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {entry.values.slice(0, 6).join(", ")}
                          {entry.values.length > 6 ? "…" : ""}
                        </div>
                      </button>
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {formatTime(entry.createdAt)}
                      </span>
                      <button
                        onClick={() => copyValues(entry.values)}
                        className="glass-button px-3 py-1.5 text-xs"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        aria-label="Remove entry"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
};

export default Index;
