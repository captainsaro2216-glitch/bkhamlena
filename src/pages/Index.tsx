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
import { useI18n } from "@/i18n";


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

type PrecheckCode =
  | "ok"
  | "block_rows"
  | "block_total"
  | "single_row"
  | "flat"
  | "repeats"
  | "low_unique";

type Precheck = {
  level: "ok" | "warn" | "block";
  code: PrecheckCode;
  data?: { pct?: number; unique?: number; n?: number };
  suggestion?: { rows: number; total: number };
};

function precheck(n: number, t: number): Precheck {
  if (!Number.isFinite(n) || n <= 0) {
    return { level: "block", code: "block_rows" };
  }
  if (!Number.isFinite(t)) {
    return { level: "block", code: "block_total" };
  }
  if (n === 1) {
    return { level: "warn", code: "single_row" };
  }

  const absMean = Math.abs(t) / n;
  const spread = Math.max(1, Math.floor(absMean * 0.35));
  const distinctJitter = 2 * spread + 1;

  const expectedUnique =
    distinctJitter * (1 - Math.pow(1 - 1 / distinctJitter, n));
  const expectedMaxRepeat = Math.max(1, Math.ceil(n / distinctJitter));
  const repeatRatio = expectedMaxRepeat / n;

  const sign = t < 0 ? -1 : 1;
  const targetForGoodVariety = (avg: number) =>
    sign * Math.max(1, Math.round(n * avg));

  if (distinctJitter <= 1 || expectedUnique < 2) {
    return {
      level: "warn",
      code: "flat",
      suggestion: { rows: n, total: targetForGoodVariety(15) },
    };
  }

  if (repeatRatio > 0.6) {
    return {
      level: "warn",
      code: "repeats",
      data: { pct: Math.round(repeatRatio * 100) },
      suggestion: { rows: n, total: targetForGoodVariety(15) },
    };
  }

  if (n >= 5 && expectedUnique / n < 0.35 && expectedUnique < 6) {
    return {
      level: "warn",
      code: "low_unique",
      data: { unique: Math.round(expectedUnique), n },
      suggestion: { rows: n, total: targetForGoodVariety(20) },
    };
  }

  return { level: "ok", code: "ok" };
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
  const { t, lang, setLang } = useI18n();
  const [rows, setRows] = useState<string>("");
  const [total, setTotal] = useState<string>("");
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
    if (!validN || !validT) return { level: "ok", code: "ok" };
    return precheck(parsedN, parsedT);
  }, [parsedN, parsedT, validN, validT]);

  const checkMessage = (() => {
    switch (check.code) {
      case "single_row": return t.warnSingleRow;
      case "flat": return t.warnFlat;
      case "repeats": return t.warnRepeats(check.data?.pct ?? 0);
      case "low_unique": return t.warnLowUnique(check.data?.unique ?? 0, check.data?.n ?? 0);
      case "block_rows": return t.blockRows;
      case "block_total": return t.blockTotal;
      default: return "";
    }
  })();

  const suggestionLabel = (() => {
    if (!check.suggestion) return "";
    switch (check.code) {
      case "flat": return t.warnFlatSuggest(check.suggestion.total);
      case "repeats": return t.warnRepeatsSuggest(check.suggestion.total);
      case "low_unique": return t.warnLowUniqueSuggest(check.suggestion.total);
      default: return "";
    }
  })();

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
      toast.error(t.toastRowsInvalid);
      return;
    }
    if (!validT) {
      toast.error(t.toastTotalInvalid);
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
    setRows("");
    setTotal("");
  };

  const copyValues = async (values: number[], format: CopyFormat) => {
    if (!values.length) return;
    const labels: Record<CopyFormat, string> = {
      newline: t.newline,
      comma: t.comma,
      "comma-space": t.commaSpace,
      space: t.space,
    };
    try {
      await navigator.clipboard.writeText(joinValues(values, format));
      toast.success(t.toastCopied(labels[format]));
    } catch {
      toast.error(t.toastCopyFailedFormat(labels[format]));
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
    const name = window.prompt(t.profilePromptCreate)?.trim();
    if (!name) return;
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setStore((prev) => ({
      profiles: [...prev.profiles, { id, name, history: [] }],
      activeId: id,
    }));
    setResults([]);
    setSelectedId(null);
    toast.success(t.profileCreated(name));
  };

  const renameProfile = () => {
    const name = window.prompt(t.profilePromptRename, activeProfile.name)?.trim();
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
      toast.error(t.cantDeleteOnlyProfile);
      return;
    }
    if (!window.confirm(t.confirmDeleteProfile(activeProfile.name))) return;
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
          aria-label={t.copyTriggerAria}
          className={
            size === "lg"
              ? "glass-button px-5 py-2 text-sm"
              : "glass-button px-3 py-1.5 text-xs"
          }
        >
          {t.copy} ▾
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label={t.copyMenuAria}
        className="glass-panel border-0"
      >
        <DropdownMenuLabel>{t.copyAs}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-label={t.copyFormatAria(t.newline)}
          onClick={() => copyValues(values, "newline")}
        >
          {t.newline}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={t.copyFormatAria(t.comma)}
          onClick={() => copyValues(values, "comma")}
        >
          {t.comma}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={t.copyFormatAria(t.commaSpace)}
          onClick={() => copyValues(values, "comma-space")}
        >
          {t.commaSpace}
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={t.copyFormatAria(t.space)}
          onClick={() => copyValues(values, "space")}
        >
          {t.space}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="glass-button px-3 py-1.5 text-xs">
                {lang === "ckb" ? t.kurdishCentral : t.english} ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-panel border-0">
              <DropdownMenuLabel>{t.language}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLang("ckb")}>
                <span className="flex-1">{t.kurdishCentral}</span>
                {lang === "ckb" && <span>✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("en")}>
                <span className="flex-1">{t.english}</span>
                {lang === "en" && <span>✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </header>

        <form onSubmit={handleGenerate} className="glass-panel p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-2 block text-sm text-muted-foreground">
                {t.rows}
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={rows}
                onChange={(e) => setRows(e.target.value.replace(/[^\d]/g, ""))}
                className="glass-input"
                placeholder={t.rowsPlaceholder}
                dir="ltr"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-muted-foreground">
                {t.total}
              </span>
              <input
                inputMode="numeric"
                pattern="-?[0-9]*"
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/[^\d-]/g, ""))}
                className="glass-input"
                placeholder={t.totalPlaceholder}
                dir="ltr"
              />
            </label>
          </div>

          {check.level !== "ok" && checkMessage && (
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
                  <div>{checkMessage}</div>
                  {check.suggestion && suggestionLabel && (
                    <button
                      type="button"
                      onClick={applySuggestion}
                      className="mt-2 underline underline-offset-2"
                      style={{ color: "hsl(var(--aqua-glow))" }}
                    >
                      {suggestionLabel}
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
            {t.generate}
          </button>
        </form>

        {results.length > 0 && (
          <section className="glass-panel mt-6 p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{t.rowsLabel(results.length)}</span>
                {" · "}
                <span className="text-foreground font-medium">{t.sumLabel(sum)}</span>
              </div>
              {copyMenu(results, "lg")}
            </div>

            <div
              className="max-h-[60vh] overflow-y-auto rounded-xl border"
              style={{ borderColor: "hsl(var(--aqua) / 0.18)" }}
              dir="ltr"
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
              <h2 className="text-base font-medium">{t.history}</h2>
              <p className="text-xs text-muted-foreground">
                {t.historyKept(history.length, HISTORY_LIMIT)}
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
                  <DropdownMenuLabel>{t.profiles}</DropdownMenuLabel>
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
                    {t.newProfile}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={renameProfile}>
                    {t.renameProfile}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={deleteProfile}
                    className="text-destructive focus:text-destructive"
                  >
                    {t.deleteProfile}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="glass-button px-4 py-2 text-xs"
                >
                  {t.clear}
                </button>
              )}
            </div>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noHistory}</p>
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
                        className="flex-1 text-start min-w-0"
                      >
                        <div className="text-sm font-medium tabular-nums">
                          {t.rowsLabel(entry.rows)} · {t.sumLabel(entry.total)}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate" dir="ltr">
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
                        aria-label={t.removeEntry}
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
