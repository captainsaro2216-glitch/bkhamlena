import { useMemo, useState } from "react";
import { toast } from "sonner";

function generateIntegers(n: number, total: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [total];

  // Center each value around the mean, with bounded variance, then fix sum.
  const mean = total / n;
  // Spread up to ~35% of mean (or at least 1) — "varied but similar in scale".
  const spread = Math.max(1, Math.floor(Math.abs(mean) * 0.35));

  const values: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const base = Math.round(mean);
    const jitter = Math.floor(Math.random() * (2 * spread + 1)) - spread;
    values[i] = base + jitter;
  }

  // Adjust sum to match exactly by distributing the diff ±1 across random indices.
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

  // Light shuffle so adjustments don't cluster visually.
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

const Index = () => {
  const [rows, setRows] = useState<string>("10");
  const [total, setTotal] = useState<string>("1000");
  const [results, setResults] = useState<number[]>([]);

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
    setResults(generateIntegers(n, t));
  };

  const handleCopy = async () => {
    if (!results.length) return;
    try {
      await navigator.clipboard.writeText(results.join("\n"));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
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
              <button onClick={handleCopy} className="glass-button px-5 py-2 text-sm">
                Copy
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-xl border"
              style={{ borderColor: "hsl(var(--aqua) / 0.18)" }}>
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
      </div>
    </main>
  );
};

export default Index;
