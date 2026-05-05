import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Row = {
  id: string;
  ctns: number;
  pcs: number;
  price: number;
};

const DEFAULT_ROWS: Omit<Row, "id">[] = [
  { ctns: 1100, pcs: 50, price: 6.71 },
  { ctns: 1087, pcs: 16, price: 3.791 },
  { ctns: 933, pcs: 20, price: 2.584 },
  { ctns: 943, pcs: 80, price: 1.223 },
  { ctns: 600, pcs: 32, price: 1.164 },
  { ctns: 824, pcs: 42, price: 4.249 },
  { ctns: 820, pcs: 100, price: 4.61 },
];

const uid = () => `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const makeDefaultRows = (): Row[] =>
  DEFAULT_ROWS.map((r) => ({ ...r, id: uid() }));

const round2 = (n: number) => Math.round(n * 100) / 100;
const roundDec = (n: number, dec: number) => {
  const f = Math.pow(10, dec);
  return Math.round(n * f) / f;
};

const centsFromPrice = (tt: number, price: number) =>
  Math.round(tt * price * 100);

const amountFromPrice = (tt: number, price: number) =>
  centsFromPrice(tt, price) / 100;

const exactPriceForCents = (tt: number, cents: number) =>
  tt > 0 ? cents / (tt * 100) : 0;

const fmtMoney = (n: number) => {
  const v = Object.is(n, -0) ? 0 : n;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtInt = (n: number) => n.toLocaleString("en-US");

function randomPartition(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (parts === 1) return [total];
  if (total < parts) return [];
  // Generate parts-1 unique breakpoints in [1, total-1]
  const breakSet = new Set<number>();
  // If range too small, fall back to sequential
  const range = total - 1;
  if (range < parts - 1) {
    // distribute as evenly as possible
    const base = Math.floor(total / parts);
    const rem = total - base * parts;
    return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
  }
  while (breakSet.size < parts - 1) {
    breakSet.add(1 + Math.floor(Math.random() * range));
  }
  const breaks = Array.from(breakSet).sort((a, b) => a - b);
  const result: number[] = [];
  let prev = 0;
  for (const b of breaks) {
    result.push(b - prev);
    prev = b;
  }
  result.push(total - prev);
  // shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const CargoOptimizer = () => {
  const [totalCtnsTarget, setTotalCtnsTarget] = useState<number>(6307);
  const [grandTotalTarget, setGrandTotalTarget] = useState<number>(1119475);
  const [numRows, setNumRows] = useState<number>(7);
  const [decimals, setDecimals] = useState<number>(3);
  const [rows, setRows] = useState<Row[]>(() => makeDefaultRows());
  const [banner, setBanner] = useState<{
    type: "success" | "warn" | "info";
    text: string;
  } | null>(null);

  // Sync row count to numRows input when changed
  useEffect(() => {
    setRows((prev) => {
      if (numRows === prev.length) return prev;
      if (numRows > prev.length) {
        const add = numRows - prev.length;
        return [
          ...prev,
          ...Array.from({ length: add }, () => ({
            id: uid(),
            ctns: 100,
            pcs: 10,
            price: 1,
          })),
        ];
      }
      return prev.slice(0, Math.max(1, numRows));
    });
  }, [numRows]);

  const computed = useMemo(() => {
    return rows.map((r) => {
      const tt = r.ctns * r.pcs;
      const amountCents = centsFromPrice(tt, r.price);
      const amount = amountCents / 100;
      return { ...r, tt, amountCents, amount };
    });
  }, [rows]);

  const sumCtns = useMemo(
    () => computed.reduce((a, b) => a + (b.ctns || 0), 0),
    [computed]
  );
  const grandTotal = useMemo(
    () => computed.reduce((a, b) => a + b.amountCents, 0) / 100,
    [computed]
  );

  const ctnsExact = sumCtns === totalCtnsTarget;
  const ctnsDelta = sumCtns - totalCtnsTarget;
  const grandTotalCents = Math.round(grandTotal * 100);
  const grandTotalTargetCents = Math.round(grandTotalTarget * 100);
  const totalExact = grandTotalCents === grandTotalTargetCents;
  const totalDelta = (grandTotalCents - grandTotalTargetCents) / 100;

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handlePcs = (id: string, v: string) => {
    const n = Math.max(1, Math.min(9999, Math.floor(Number(v) || 0)));
    updateRow(id, { pcs: n });
  };

  const handlePrice = (id: string, v: string) => {
    let n = Number(v);
    if (!Number.isFinite(n) || n <= 0) n = 0.001;
    n = roundDec(n, decimals);
    if (n < Math.pow(10, -decimals)) n = Math.pow(10, -decimals);
    updateRow(id, { price: n });
  };

  const handleCtns = (id: string, v: string) => {
    const n = Math.max(1, Math.min(999999, Math.floor(Number(v) || 0)));
    updateRow(id, { ctns: n });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: uid(), ctns: 100, pcs: 10, price: 1 },
    ]);
    setNumRows((n) => n + 1);
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((r) => r.id !== id);
      setNumRows(next.length);
      return next;
    });
  };

  const reset = () => {
    setRows(makeDefaultRows());
    setTotalCtnsTarget(6307);
    setGrandTotalTarget(1119475);
    setNumRows(7);
    setDecimals(3);
    setBanner(null);
  };

  const randomizeCartons = () => {
    if (totalCtnsTarget < rows.length) {
      setBanner({
        type: "warn",
        text: `Total cartons (${totalCtnsTarget}) must be ≥ number of rows (${rows.length}).`,
      });
      return;
    }
    const parts = randomPartition(totalCtnsTarget, rows.length);
    setRows((prev) => prev.map((r, i) => ({ ...r, ctns: parts[i] })));
    setBanner({
      type: "info",
      text: `Distributed ${fmtInt(totalCtnsTarget)} cartons across ${rows.length} rows.`,
    });
  };

  const solve = useCallback(() => {
    const dec = decimals;
    const step = Math.pow(10, -dec);
    const target = grandTotalTarget;

    // Snapshot current rows with TT
    const work = rows.map((r) => ({
      id: r.id,
      ctns: r.ctns,
      pcs: r.pcs,
      tt: r.ctns * r.pcs,
      price: r.price,
    }));

    const totalTT = work.reduce((a, b) => a + b.tt, 0);
    if (totalTT <= 0) {
      setBanner({
        type: "warn",
        text: "Cannot solve: total TT (cartons × pcs) is zero.",
      });
      return;
    }

    // Step 1-2: required avg, set all prices
    const requiredAvg = target / totalTT;
    const basePrice = roundDec(requiredAvg, dec);
    work.forEach((w) => {
      w.price = basePrice < step ? step : basePrice;
    });

    const amountOf = (tt: number, price: number) => round2(tt * price);
    const sumGrand = () =>
      work.reduce((a, b) => a + amountOf(b.tt, b.price), 0);

    let current = round2(sumGrand());
    let residual = round2(target - current);

    // Sort indices by TT desc for adjustment ordering
    const order = work
      .map((_, i) => i)
      .sort((a, b) => work[b].tt - work[a].tt);

    const MAX_ITERS = 10000;
    let iters = 0;
    let stalledPasses = 0;

    while (Math.abs(residual) >= 0.005 && iters < MAX_ITERS) {
      let improvedThisPass = false;
      for (const idx of order) {
        if (Math.abs(residual) < 0.005) break;
        iters++;
        if (iters >= MAX_ITERS) break;
        const w = work[idx];
        const oldAmount = amountOf(w.tt, w.price);

        // try +step and -step
        const upPrice = roundDec(w.price + step, dec);
        const downPrice = roundDec(w.price - step, dec);

        const upDelta =
          upPrice >= step ? amountOf(w.tt, upPrice) - oldAmount : 0;
        const downDelta =
          downPrice >= step ? amountOf(w.tt, downPrice) - oldAmount : 0;

        // Choose the move that reduces |residual| most
        const curAbs = Math.abs(residual);
        const upAbs = Math.abs(round2(residual - upDelta));
        const downAbs = Math.abs(round2(residual - downDelta));

        let best: "none" | "up" | "down" = "none";
        let bestAbs = curAbs;
        if (upPrice >= step && upDelta !== 0 && upAbs < bestAbs) {
          best = "up";
          bestAbs = upAbs;
        }
        if (downPrice >= step && downDelta !== 0 && downAbs < bestAbs) {
          best = "down";
          bestAbs = downAbs;
        }

        if (best === "up") {
          w.price = upPrice;
          residual = round2(residual - upDelta);
          improvedThisPass = true;
        } else if (best === "down") {
          w.price = downPrice;
          residual = round2(residual - downDelta);
          improvedThisPass = true;
        }
      }
      if (!improvedThisPass) {
        stalledPasses++;
        if (stalledPasses >= 2) break;
      } else {
        stalledPasses = 0;
      }
    }

    // Apply prices back to rows
    setRows((prev) =>
      prev.map((r) => {
        const w = work.find((x) => x.id === r.id);
        return w ? { ...r, price: w.price } : r;
      })
    );

    const finalGrand = round2(sumGrand());
    const gap = round2(target - finalGrand);

    if (Math.abs(gap) < 0.005) {
      setBanner({
        type: "success",
        text: `Grand total solved: $${fmtMoney(finalGrand)} — exact match ✓`,
      });
    } else {
      setBanner({
        type: "warn",
        text: `Closest achievable: $${fmtMoney(finalGrand)} — remaining gap: $${fmtMoney(Math.abs(gap))}. Try increasing decimal places or adjusting QTY (PCS) values.`,
      });
    }
  }, [rows, decimals, grandTotalTarget]);

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 pb-32">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Cargo Invoice Optimizer
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Distribute cartons and solve unit prices to hit your grand total exactly.
            </p>
          </div>
          <Link to="/" className="glass-button px-4 py-2 text-xs">
            ← Sum Generator
          </Link>
        </div>

        {/* Control panel */}
        <section className="glass-panel p-5 md:p-6 mb-5" dir="ltr">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">
                Total Cartons (Target)
              </span>
              <input
                type="number"
                min={1}
                max={999999}
                step={1}
                value={totalCtnsTarget}
                onChange={(e) =>
                  setTotalCtnsTarget(
                    Math.max(1, Math.min(999999, Math.floor(Number(e.target.value) || 0)))
                  )
                }
                className="glass-input"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">
                Grand Total (USD)
              </span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={grandTotalTarget}
                onChange={(e) =>
                  setGrandTotalTarget(Math.max(0.01, Number(e.target.value) || 0))
                }
                className="glass-input"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">
                Number of Rows
              </span>
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={numRows}
                onChange={(e) =>
                  setNumRows(
                    Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 1)))
                  )
                }
                className="glass-input"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">
                Unit Price Decimals
              </span>
              <select
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
                className="glass-input"
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d} decimal{d > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={randomizeCartons} className="glass-button px-4 py-2 text-sm">
              🎲 Randomize Cartons
            </button>
            <button onClick={solve} className="submit-button px-5 py-2 text-sm">
              ✦ Solve for Grand Total
            </button>
            <button onClick={addRow} className="glass-button px-4 py-2 text-sm">
              + Add Row
            </button>
            <button onClick={reset} className="glass-button px-4 py-2 text-sm">
              ↺ Reset
            </button>
          </div>

          {banner && (
            <div
              className="mt-4 rounded-xl border p-3 text-sm"
              role="alert"
              style={{
                borderColor:
                  banner.type === "success"
                    ? "hsl(142 70% 45% / 0.5)"
                    : banner.type === "warn"
                    ? "hsl(45 90% 55% / 0.5)"
                    : "hsl(var(--aqua) / 0.4)",
                background:
                  banner.type === "success"
                    ? "hsl(142 70% 45% / 0.08)"
                    : banner.type === "warn"
                    ? "hsl(45 90% 55% / 0.08)"
                    : "hsl(var(--aqua) / 0.06)",
                color:
                  banner.type === "success"
                    ? "hsl(142 80% 70%)"
                    : banner.type === "warn"
                    ? "hsl(45 95% 75%)"
                    : "hsl(var(--foreground))",
              }}
            >
              {banner.text}
            </div>
          )}
        </section>

        {/* Table */}
        <section className="glass-panel p-2 md:p-4" dir="ltr">
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide text-muted-foreground"
                  style={{ borderBottom: "1px solid hsl(var(--aqua) / 0.18)" }}
                >
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-right">QTY (CTNS)</th>
                  <th className="px-3 py-3 text-right">QTY (PCS)</th>
                  <th className="px-3 py-3 text-right">TT / QTY (PCS)</th>
                  <th className="px-3 py-3 text-right">Unit Price (USD)</th>
                  <th className="px-3 py-3 text-right">Amount (USD)</th>
                  <th className="px-3 py-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {computed.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: "1px solid hsl(var(--aqua) / 0.08)" }}
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={999999}
                        step={1}
                        value={r.ctns}
                        onChange={(e) => handleCtns(r.id, e.target.value)}
                        className="glass-input text-right tabular-nums opacity-70"
                        style={{ padding: "0.4rem 0.6rem" }}
                        title="Set by Randomize, editable here"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        step={1}
                        value={r.pcs}
                        onChange={(e) => handlePcs(r.id, e.target.value)}
                        className="glass-input text-right tabular-nums"
                        style={{ padding: "0.4rem 0.6rem" }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono text-muted-foreground">
                      {fmtInt(r.tt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={Math.pow(10, -decimals)}
                        step={Math.pow(10, -decimals)}
                        value={r.price}
                        onChange={(e) => handlePrice(r.id, e.target.value)}
                        className="glass-input text-right tabular-nums"
                        style={{ padding: "0.4rem 0.6rem" }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono">
                      ${fmtMoney(r.amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeRow(r.id)}
                        disabled={rows.length <= 1}
                        className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-destructive disabled:opacity-30"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md"
        style={{
          background: "hsl(var(--background) / 0.85)",
          borderColor: "hsl(var(--aqua) / 0.2)",
        }}
        dir="ltr"
      >
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Total CTNs
            </span>
            <span className="font-mono tabular-nums text-base font-semibold">
              {fmtInt(sumCtns)}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={
                ctnsExact
                  ? {
                      background: "hsl(142 70% 45% / 0.18)",
                      color: "hsl(142 80% 70%)",
                      border: "1px solid hsl(142 70% 45% / 0.5)",
                    }
                  : {
                      background: "hsl(var(--destructive) / 0.18)",
                      color: "hsl(0 90% 75%)",
                      border: "1px solid hsl(var(--destructive) / 0.5)",
                    }
              }
            >
              {ctnsExact ? "✓ exact" : `Δ ${ctnsDelta > 0 ? "+" : ""}${fmtInt(ctnsDelta)}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Grand Total
            </span>
            <span className="font-mono tabular-nums text-lg font-bold">
              ${fmtMoney(grandTotal)}
            </span>
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={
                totalExact
                  ? {
                      background: "hsl(142 70% 45% / 0.22)",
                      color: "hsl(142 85% 72%)",
                      border: "1px solid hsl(142 70% 45% / 0.7)",
                      boxShadow: "0 0 18px hsl(142 70% 45% / 0.35)",
                    }
                  : {
                      background: "hsl(var(--destructive) / 0.22)",
                      color: "hsl(0 95% 78%)",
                      border: "1px solid hsl(var(--destructive) / 0.7)",
                      boxShadow: "0 0 18px hsl(var(--destructive) / 0.35)",
                    }
              }
            >
              {totalExact
                ? "✓ exact"
                : `Δ ${totalDelta > 0 ? "+" : "-"}$${fmtMoney(Math.abs(totalDelta))}`}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CargoOptimizer;
