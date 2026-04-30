import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HistoryEntry = {
  id: string;
  rows: number;
  total: number;
  values: number[];
  createdAt: number;
};

type Profile = {
  id: string;
  name: string;
  history: HistoryEntry[];
};

type Store = {
  profiles: Profile[];
  activeId: string;
};

const STORE_KEY = "integer-splitter-store-v2";
const HISTORY_LIMIT = 20;

const DEFAULT_STORE: Store = {
  profiles: [{ id: "default", name: "Default", history: [] }],
  activeId: "default",
};

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.profiles?.length) return parsed;
    }
    // Migrate old key if present
    const legacy = localStorage.getItem("integer-splitter-history");
    if (legacy) {
      const history = JSON.parse(legacy) as HistoryEntry[];
      return {
        profiles: [{ id: "default", name: "Default", history }],
        activeId: "default",
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_STORE;
}

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

type Precheck = {
  level: "ok" | "warn" | "block";
  message?: string;
  suggestion?: { rows: number; total: number; label: string };
};

function precheck(n: number, t: number): Precheck {
  if (!Number.isFinite(n) || n <= 0) {
    return { level: "block", message: "Rows must be a positive integer." };
  }
  if (!Number.isFinite(t)) {
    return { level: "block", message: "Target total must be an integer." };
  }
  if (n === 1) {
    return {
      level: "warn",
      message: "Only 1 row — the single value will equal the total exactly.",
    };
  }
  const absMean = Math.abs(t) / n;
  if (absMean < 1) {
    // e.g. 100 rows summing to 5 — most values must be 0.
    const suggestedTotal = n * 5;
    return {
      level: "warn",
      message:
        "Average per row is below 1. Most values will be 0 or 1, so results won't look varied.",
      suggestion: {
        rows: n,
        total: t < 0 ? -suggestedTotal : suggestedTotal,
        label: `Use total ${t < 0 ? -suggestedTotal : suggestedTotal} (avg 5/row)`,
      },
    };
  }
  if (absMean < 3) {
    const suggestedTotal = n * 10;
    return {
      level: "warn",
      message:
        "Average per row is very small — variance will be limited (jitter rounds to ±1).",
      suggestion: {
        rows: n,
        total: t < 0 ? -suggestedTotal : suggestedTotal,
        label: `Use total ${t < 0 ? -suggestedTotal : suggestedTotal} for more variety`,
      },
    };
  }
  return { level: "ok" };
}

type CopyFormat = "newline" | "comma" | "space" | "comma-space";

function joinValues(values: number[], format: CopyFormat) {
  switch (format) {
    case "comma":
      return values.join(",");
    case "comma-space":
      return values.join(", ");
    case "space":
      return values.join(" ");
    case "newline":
    default:
      return values.join("\n");
  }
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const Index = () => {
  const [rows, setRows] = useState<string>("10");
  const [total, setTotal] = useState<string>("1000");
  const [results, setResults] = useState<number[]>([]);
  const [store, setStore] = useState<Store>(() => loadStore());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeProfile =
    store.profiles.find((p) => p.id === store.activeId) ?? store.profiles[0];
  const history = activeProfile.history;

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }, [store]);

  const sum = useMemo(() => results.reduce((a, b) => a + b, 0), [results]);

  const parsedN = parseInt(rows, 10);
  const parsedT = parseInt(total, 10);
  const validN = /^\d+$/.test(rows.trim());
  const validT = /^-?\d+$/.test(total.trim());
  const check: Precheck = useMemo(() => {
    if (!validN || !validT) return { level: "ok" };
    return precheck(parsedN, parsedT);
  }, [parsedN, parsedT, validN, validT]);

  const updateActiveProfile = (updater: (p: Profile) => Profile) => {
    setStore((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeId ? updater(p) : p
      ),
    }));
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validN || parsedN <= 0) {
      toast.error("Rows must be a positive integer");
      return;
    }
    if (!validT) {
      toast.error("Target total must be an integer (no decimals)");
      return;
    }
    const values = generateIntegers(parsedN, parsedT);
    setResults(values);

    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rows: parsedN,
      total: parsedT,
      values,
      createdAt: Date.now(),
    };
    updateActiveProfile((p) => ({
      ...p,
      history: [entry, ...p.history].slice(0, HISTORY_LIMIT),
    }));
    setSelectedId(entry.id);
  };

  const copyValues = async (values: number[], format: CopyFormat) => {
    if (!values.length) return;
    try {
      await navigator.clipboard.writeText(joinValues(values, format));
      const labels: Record<CopyFormat, string> = {
        newline: "newline-separated",
        comma: "comma-separated",
        "comma-space": "comma + space",
        space: "space-separated",
      };
      toast.success(`Copied (${labels[format]})`);
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
    updateActiveProfile((p) => ({
      ...p,
      history: p.history.filter((e) => e.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const clearHistory = () => {
    updateActiveProfile((p) => ({ ...p, history: [] }));
    setSelectedId(null);
  };

  const switchProfile = (id: string) => {
    setStore((prev) => ({ ...prev, activeId: id }));
    setResults([]);
    setSelectedId(null);
  };

  const createProfile = () => {
    const name = window.prompt("Name this profile")?.trim();
    if (!name) return;
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setStore((prev) => ({
      profiles: [...prev.profiles, { id, name, history: [] }],
      activeId: id,
    }));
    setResults([]);
    setSelectedId(null);
    toast.success(`Profile "${name}" created`);
  };

  const renameProfile = () => {
    const name = window.prompt("Rename profile", activeProfile.name)?.trim();
    if (!name) return;
    setStore((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeId ? { ...p, name } : p
      ),
    }));
  };

  const deleteProfile = () => {
    if (store.profiles.length <= 1) {
      toast.error("Can't delete the only profile");
      return;
    }
    if (!window.confirm(`Delete profile "${activeProfile.name}"?`)) return;
    setStore((prev) => {
      const remaining = prev.profiles.filter((p) => p.id !== prev.activeId);
      return { profiles: remaining, activeId: remaining[0].id };
    });
    setResults([]);
    setSelectedId(null);
  };

  const applySuggestion = () => {
    if (!check.suggestion) return;
    setRows(String(check.suggestion.rows));
    setTotal(String(check.suggestion.total));
  };

  const copyMenu = (values: number[], size: "lg" | "sm" = "lg") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={
            size === "lg"
              ? "glass-button px-5 py-2 text-sm"
              : "glass-button px-3 py-1.5 text-xs"
          }
        >
          Copy ▾
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-panel border-0">
        <DropdownMenuLabel>Copy as…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copyValues(values, "newline")}>
          Newline-separated
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyValues(values, "comma")}>
          Comma-separated
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyValues(values, "comma-space")}>
          Comma + space
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyValues(values, "space")}>
          Space-separated
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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

          {check.level !== "ok" && check.message && (
            <div
              className="mt-4 rounded-xl border p-3 text-sm"
              style={{
                borderColor:
                  check.level === "block"
                    ? "hsl(var(--destructive) / 0.5)"
                    : "hsl(var(--aqua) / 0.4)",
                background:
                  check.level === "block"
                    ? "hsl(var(--destructive) / 0.08)"
                    : "hsl(var(--aqua) / 0.06)",
              }}
              role="alert"
            >
              <div className="flex items-start gap-2">
                <span aria-hidden>{check.level === "block" ? "⛔" : "⚠️"}</span>
                <div className="flex-1">
                  <div>{check.message}</div>
                  {check.suggestion && (
                    <button
                      type="button"
                      onClick={applySuggestion}
                      className="mt-2 underline underline-offset-2 hover:text-aqua"
                      style={{ color: "hsl(var(--aqua-glow))" }}
                    >
                      {check.suggestion.label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="glass-button mt-6 w-full disabled:opacity-50"
            disabled={check.level === "block"}
          >
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
              {copyMenu(results, "lg")}
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

        <section className="glass-panel mt-6 p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-medium">History</h2>
              <p className="text-xs text-muted-foreground">
                {history.length} of {HISTORY_LIMIT} kept locally
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="glass-button px-4 py-2 text-xs max-w-[180px] truncate">
                    {activeProfile.name} ▾
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-panel border-0 min-w-[200px]">
                  <DropdownMenuLabel>Profiles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {store.profiles.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => switchProfile(p.id)}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.id === store.activeId && <span>✓</span>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={createProfile}>
                    + New profile…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={renameProfile}>
                    Rename current…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={deleteProfile}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete current
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="glass-button px-4 py-2 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No generations yet in this profile.
            </p>
          ) : (
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
                        className="flex-1 text-left min-w-0"
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
                      {copyMenu(entry.values, "sm")}
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
          )}
        </section>
      </div>
    </main>
  );
};

export default Index;
