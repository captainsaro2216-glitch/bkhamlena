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
  // Even base distribution
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  const arr = Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
  // Apply small jitter (~±12% of base) but keep values nearly similar
  const jitter = Math.max(1, Math.floor(base * 0.12));
  for (let i = 0; i < parts - 1; i++) {
    const delta = Math.floor(Math.random() * (2 * jitter + 1)) - jitter;
    if (arr[i] + delta >= 1 && arr[parts - 1] - delta >= 1) {
      arr[i] += delta;
      arr[parts - 1] -= delta;
    }
  }
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function gcdN(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

const CargoOptimizer = () => {
  const [totalCtnsTarget, setTotalCtnsTarget] = useState<number>(6307);
  const [grandTotalTarget, setGrandTotalTarget] = useState<number>(1119475);
  const [numRows, setNumRows] = useState<number>(7);
  const [decimals, setDecimals] = useState<number>(3);
  const [minPrice, setMinPrice] = useState<number>(0.01);
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [rows, setRows] = useState<Row[]>(() => makeDefaultRows());
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [freeDivide, setFreeDivide] = useState<boolean>(false);
  const [copyAsForceDivide, setCopyAsForceDivide] = useState<boolean>(false);
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
    setMinPrice(0.01);
    setMaxPrice(100);
    setBanner(null);
  };

  const copyNumbers = async () => {
    // Clean tab-separated columns: CTNS  PCS  Price  Amount
    const lines: string[] = ["CTNS\tPCS\tPrice\tAmount"];
    computed.forEach((r) => {
      lines.push(
        `${r.ctns}\t${r.pcs}\t${r.price.toFixed(decimals)}\t${r.amount.toFixed(2)}`
      );
    });
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setBanner({ type: "success", text: "Copied invoice numbers (tab-separated columns)." });
    } catch {
      setBanner({ type: "warn", text: "Copy failed. Browser may have blocked clipboard access." });
    }
  };

  const copyColumn = async (label: string, values: (string | number)[]) => {
    const text = values.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setBanner({ type: "success", text: `Copied ${label} column (${values.length} rows).` });
    } catch {
      setBanner({ type: "warn", text: "Copy failed. Browser may have blocked clipboard access." });
    }
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

  // Live feasibility check (without mutating rows)
  const feasibility = useMemo(() => {
    const dec = decimals;
    const scale = Math.pow(10, dec);
    const targetCents = Math.round(grandTotalTarget * 100);

    if (minPrice <= 0) {
      return { ok: false, reason: "Min unit price must be greater than 0 (no zero or negative prices allowed)." };
    }
    if (maxPrice < minPrice) {
      return { ok: false, reason: "Max unit price must be ≥ min unit price." };
    }
    if (dec < 2) {
      const factor = Math.pow(10, 2 - dec);
      if (targetCents % factor !== 0) {
        return {
          ok: false,
          reason: `At ${dec} decimal${dec > 1 ? "s" : ""}, the grand total must be a multiple of $${(factor / 100).toFixed(Math.max(0, 2 - dec))}.`,
        };
      }
    }
    const T = Math.round((targetCents * scale) / 100);
    const usable = rows.map((r) => r.ctns * r.pcs).filter((tt) => tt > 0);
    if (usable.length === 0) return { ok: false, reason: "Total TT (cartons × pcs) is zero." };

    let g = usable[0];
    for (let i = 1; i < usable.length; i++) g = gcdN(g, usable[i]);
    if (T % g !== 0) {
      return {
        ok: false,
        reason: `Exact total impossible at ${dec} decimal${dec > 1 ? "s" : ""}: GCD of TT values (${g}) does not divide the scaled target. Add/remove a row or change a QTY (PCS).`,
      };
    }

    // Bounds check on k = price * scale
    const kMin = Math.ceil(minPrice * scale);
    const kMax = Math.floor(maxPrice * scale);
    if (kMin < 1) {
      return { ok: false, reason: "Min unit price too small for chosen decimals." };
    }
    if (kMin > kMax) {
      return { ok: false, reason: "Min/max range yields no valid price at chosen decimals." };
    }
    const totalTT = usable.reduce((a, b) => a + b, 0);
    const lo = usable.reduce((a, tt) => a + tt * kMin, 0);
    const hi = usable.reduce((a, tt) => a + tt * kMax, 0);
    if (T < lo || T > hi) {
      const avg = T / totalTT / scale;
      return {
        ok: false,
        reason: `Required average unit price is $${avg.toFixed(dec)} which is outside the [$${minPrice}, $${maxPrice}] band. Widen the band or change quantities.`,
      };
    }
    return { ok: true as const, reason: "Exact total is achievable with current settings." };
  }, [rows, grandTotalTarget, decimals, minPrice, maxPrice]);

  // Suggestions: smallest PCS (QTY) changes that make exact total feasible.
  // Search single-row deltas first (cheapest), then 2-row combos if needed.
  type Suggestion = {
    changes: { rowId: string; rowIndex: number; oldPcs: number; newPcs: number; delta: number }[];
    totalAbsDelta: number;
    label: string;
    reason: string;
  };

  const suggestions = useMemo<Suggestion[]>(() => {
    if (feasibility.ok) return [];
    const dec = decimals;
    const scale = Math.pow(10, dec);
    const targetCents = Math.round(grandTotalTarget * 100);
    if (dec < 2) {
      const factor = Math.pow(10, 2 - dec);
      if (targetCents % factor !== 0) return []; // user must change total/decimals
    }
    const T = Math.round((targetCents * scale) / 100);
    if (minPrice <= 0 || maxPrice < minPrice) return [];
    const kMin = Math.ceil(minPrice * scale);
    const kMax = Math.floor(maxPrice * scale);
    if (kMin < 1 || kMin > kMax) return [];

    const baseCtns = rows.map((r) => r.ctns);
    const basePcs = rows.map((r) => r.pcs);
    const n = rows.length;

    const checkFeasible = (pcsArr: number[]): boolean => {
      const tts: number[] = [];
      for (let i = 0; i < n; i++) {
        const tt = baseCtns[i] * pcsArr[i];
        if (tt <= 0) return false;
        tts.push(tt);
      }
      let g = tts[0];
      for (let i = 1; i < n; i++) g = gcdN(g, tts[i]);
      if (T % g !== 0) return false;
      const lo = tts.reduce((a, t) => a + t * kMin, 0);
      const hi = tts.reduce((a, t) => a + t * kMax, 0);
      if (T < lo || T > hi) return false;
      return true;
    };

    const out: Suggestion[] = [];
    const MAX_DELTA = 25;

    // Single-row search
    for (let i = 0; i < n; i++) {
      for (let d = 1; d <= MAX_DELTA; d++) {
        for (const sign of [-1, 1]) {
          const newPcs = basePcs[i] + sign * d;
          if (newPcs < 1 || newPcs > 9999) continue;
          const trial = basePcs.slice();
          trial[i] = newPcs;
          if (checkFeasible(trial)) {
            out.push({
              changes: [{ rowId: rows[i].id, rowIndex: i, oldPcs: basePcs[i], newPcs, delta: sign * d }],
              totalAbsDelta: d,
              label: `Row ${i + 1}: PCS ${basePcs[i]} → ${newPcs} (${sign > 0 ? "+" : ""}${sign * d})`,
              reason: "Single-row PCS change",
            });
            break;
          }
        }
        if (out.some((s) => s.changes[0]?.rowIndex === i)) break;
      }
    }

    // If we have at least one single-row fix, return top 5 by smallest delta
    if (out.length > 0) {
      return out.sort((a, b) => a.totalAbsDelta - b.totalAbsDelta).slice(0, 5);
    }

    // Two-row combo search (small radius) as fallback
    for (let i = 0; i < n && out.length < 5; i++) {
      for (let j = i + 1; j < n && out.length < 5; j++) {
        let found = false;
        for (let total = 2; total <= 10 && !found; total++) {
          for (let di = 1; di < total && !found; di++) {
            const dj = total - di;
            for (const si of [-1, 1]) {
              for (const sj of [-1, 1]) {
                const npi = basePcs[i] + si * di;
                const npj = basePcs[j] + sj * dj;
                if (npi < 1 || npi > 9999 || npj < 1 || npj > 9999) continue;
                const trial = basePcs.slice();
                trial[i] = npi;
                trial[j] = npj;
                if (checkFeasible(trial)) {
                  out.push({
                    changes: [
                      { rowId: rows[i].id, rowIndex: i, oldPcs: basePcs[i], newPcs: npi, delta: si * di },
                      { rowId: rows[j].id, rowIndex: j, oldPcs: basePcs[j], newPcs: npj, delta: sj * dj },
                    ],
                    totalAbsDelta: di + dj,
                    label: `Row ${i + 1}: ${basePcs[i]}→${npi}, Row ${j + 1}: ${basePcs[j]}→${npj}`,
                    reason: "Two-row PCS change",
                  });
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
          }
        }
      }
    }

    return out.sort((a, b) => a.totalAbsDelta - b.totalAbsDelta).slice(0, 5);
  }, [rows, grandTotalTarget, decimals, minPrice, maxPrice, feasibility.ok]);

  const applySuggestion = (s: Suggestion) => {
    setRows((prev) =>
      prev.map((r) => {
        const ch = s.changes.find((c) => c.rowId === r.id);
        return ch ? { ...r, pcs: ch.newPcs } : r;
      })
    );
    setBanner({
      type: "info",
      text: `Applied PCS change: ${s.label}. Click Solve to recompute prices.`,
    });
  };

  const solve = useCallback(() => {
    if (!feasibility.ok) {
      setBanner({ type: "warn", text: feasibility.reason });
      return;
    }
    const dec = decimals;
    const scale = Math.pow(10, dec);
    const targetCents = Math.round(grandTotalTarget * 100);
    const T = Math.round((targetCents * scale) / 100);

    const work = rows.map((r) => ({ id: r.id, tt: r.ctns * r.pcs, k: 0 }));
    const usable = work.filter((w) => w.tt > 0);

    const tts = usable.map((u) => u.tt);
    const kMin = Math.ceil(minPrice * scale);
    const kMax = Math.floor(maxPrice * scale);

    // Initial: clamp to band; start everyone at kMin then push the rest
    const totalTT = tts.reduce((a, b) => a + b, 0);
    const avgK = Math.max(kMin, Math.min(kMax, Math.round(T / totalTT)));
    usable.forEach((w) => { w.k = avgK; });
    let currentSum = usable.reduce((a, b) => a + b.tt * b.k, 0);
    let rem = T - currentSum;

    // Sequential extended-gcd to solve sum(tt_i * delta_i) = rem
    const n = usable.length;
    const prefixG: number[] = [tts[0]];
    for (let i = 1; i < n; i++) prefixG.push(gcdN(prefixG[i - 1], tts[i]));

    const extGcd = (a: number, b: number): [number, number, number] => {
      if (b === 0) return [a, 1, 0];
      const [gg, x1, y1] = extGcd(b, a % b);
      return [gg, y1, x1 - Math.floor(a / b) * y1];
    };

    const deltas = new Array(n).fill(0);
    let r = rem;
    for (let i = n - 1; i >= 1; i--) {
      const gi = prefixG[i];
      const [, , y] = extGcd(prefixG[i - 1], tts[i]);
      const factor = r / gi;
      const dy = y * factor;
      deltas[i] = dy;
      r = r - dy * tts[i];
    }
    deltas[0] = r / tts[0];
    for (let i = 0; i < n; i++) usable[i].k += deltas[i];

    // Project into [kMin, kMax] while preserving sum(tt_i * k_i) = T.
    // Repeatedly: pick an out-of-band row, push it toward bound, compensate
    // by adjusting another row in the opposite direction by (tt_i / tt_j) units.
    const MAX_ITER = 5000;
    let iter = 0;
    const inBand = (k: number) => k >= kMin && k <= kMax;

    while (iter++ < MAX_ITER) {
      const badIdx = usable.findIndex((u) => !inBand(u.k));
      if (badIdx === -1) break;
      const bad = usable[badIdx];
      const target = bad.k < kMin ? kMin : kMax;
      const need = target - bad.k; // amount we want to add to bad.k
      // We need to subtract need * tt_bad / tt_other from some other row.
      // Find a donor j != badIdx with integer compensation and stays in band.
      let placed = false;
      // Try donors with largest slack first
      const donors = usable
        .map((u, i) => ({ u, i }))
        .filter(({ i }) => i !== badIdx)
        .sort((a, b) => {
          const slackA = need > 0 ? a.u.k - kMin : kMax - a.u.k;
          const slackB = need > 0 ? b.u.k - kMin : kMax - b.u.k;
          return slackB - slackA;
        });

      for (const { u: donor, i: donorIdx } of donors) {
        // Compensation: bad.k += d (toward target), donor.k -= d * tt_bad / tt_donor
        // Need d * tt_bad % tt_donor == 0. Use minimum step that moves bad fully or as much as possible.
        const lcmDen = donor.tt / gcdN(donor.tt, bad.tt);
        // step in bad.k that yields integer change in donor.k
        const stepBad = lcmDen; // positive
        // direction
        const dir = need > 0 ? 1 : -1;
        // how much we can move bad in this direction (toward target)
        const maxBadMove = dir > 0 ? Math.min(need, kMax - bad.k) : Math.max(need, kMin - bad.k);
        const stepsMax = Math.floor(Math.abs(maxBadMove) / stepBad);
        if (stepsMax <= 0) continue;
        // Donor change per step
        const donorPerStep = -dir * (stepBad * bad.tt) / donor.tt; // integer
        // donor in-band constraint
        let stepsAllowed = stepsMax;
        if (donorPerStep > 0) {
          stepsAllowed = Math.min(stepsAllowed, Math.floor((kMax - donor.k) / donorPerStep));
        } else if (donorPerStep < 0) {
          stepsAllowed = Math.min(stepsAllowed, Math.floor((donor.k - kMin) / -donorPerStep));
        }
        if (stepsAllowed <= 0) continue;
        bad.k += dir * stepBad * stepsAllowed;
        donor.k += donorPerStep * stepsAllowed;
        usable[donorIdx] = donor;
        placed = true;
        break;
      }
      if (!placed) {
        setBanner({
          type: "warn",
          text: "Could not enforce min/max price band while keeping the exact total. Widen the band, change decimals, or adjust QTY values.",
        });
        return;
      }
    }

    if (usable.some((u) => u.k < kMin || u.k > kMax)) {
      setBanner({
        type: "warn",
        text: "Solver hit iteration limit while enforcing price bounds. Widen the min/max band or adjust QTY values.",
      });
      return;
    }

    const finalById = new Map<string, number>();
    usable.forEach((u) => finalById.set(u.id, u.k / scale));

    setRows((prev) =>
      prev.map((r2) => {
        const p = finalById.get(r2.id);
        return p !== undefined ? { ...r2, price: p } : r2;
      })
    );

    setBanner({
      type: "success",
      text: `Grand total solved: $${fmtMoney(grandTotalTarget)} — exact at ${dec} decimal${dec > 1 ? "s" : ""}, prices within [$${minPrice}, $${maxPrice}] ✓`,
    });
  }, [rows, grandTotalTarget, decimals, minPrice, maxPrice, feasibility]);

  // Compute force-divide values without mutating state (for copy)
  const computeForceDivide = useCallback(
    (
      ctnsArr: number[],
      pcsArr: number[],
    ): { ctns: number; pcs: number; price: number; amount: number }[] | null => {
      const n = ctnsArr.length;
      const tts = ctnsArr.map((c, i) => c * pcsArr[i]);
      const totalTT = tts.reduce((a, b) => a + b, 0);
      if (totalTT <= 0 || tts.some((t) => t <= 0)) return null;
      const targetCents = Math.round(grandTotalTarget * 100);
      const amountsCents = tts.map((t) => Math.floor((targetCents * t) / totalTT));
      let remainder = targetCents - amountsCents.reduce((a, b) => a + b, 0);
      const order = tts
        .map((t, i) => ({ i, frac: (targetCents * t) / totalTT - Math.floor((targetCents * t) / totalTT) }))
        .sort((a, b) => b.frac - a.frac);
      for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
        amountsCents[order[k].i]++;
      }
      while (remainder > 0) { amountsCents[remainder % n]++; remainder--; }
      return amountsCents.map((c, i) => ({
        ctns: ctnsArr[i],
        pcs: pcsArr[i],
        price: c / 100 / tts[i],
        amount: c / 100,
      }));
    },
    [grandTotalTarget],
  );

  // ============ FORCE-DIVIDE (no TT/QTY constraint) ============
  // Distributes target amount cents across rows proportional to TT, then sets
  // price = amountCents / 100 / TT. Always produces an exact grand total at any
  // decimal setting because amounts are tracked in integer cents.
  const forceDividePrices = useCallback(
    (ctnsArr?: number[], pcsArr?: number[]): boolean => {
      const ctns = ctnsArr ?? rows.map((r) => r.ctns);
      const pcs = pcsArr ?? rows.map((r) => r.pcs);
      const n = rows.length;
      const tts = ctns.map((c, i) => c * pcs[i]);
      const totalTT = tts.reduce((a, b) => a + b, 0);
      if (totalTT <= 0 || tts.some((t) => t <= 0)) {
        setBanner({ type: "warn", text: "Force-divide needs valid CTNS and PCS in every row." });
        return false;
      }
      const targetCents = Math.round(grandTotalTarget * 100);
      // Proportional integer-cent split, then distribute remainder cents largest-first
      const amountsCents = tts.map((t) => Math.floor((targetCents * t) / totalTT));
      let remainder = targetCents - amountsCents.reduce((a, b) => a + b, 0);
      const order = tts
        .map((t, i) => ({ i, frac: (targetCents * t) / totalTT - Math.floor((targetCents * t) / totalTT) }))
        .sort((a, b) => b.frac - a.frac);
      for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
        amountsCents[order[k].i]++;
      }
      while (remainder > 0) { amountsCents[remainder % n]++; remainder--; }

      const newPrices = amountsCents.map((c, i) => c / 100 / tts[i]);
      setRows((prev) =>
        prev.map((r, i) => ({
          ...r,
          ctns: ctns[i],
          pcs: pcs[i],
          price: newPrices[i],
        })),
      );
      setBanner({
        type: "success",
        text: `✓ Forced exact total $${fmtMoney(grandTotalTarget)} by dividing amounts ÷ QTY (TT/QTY constraint disabled).`,
      });
      return true;
    },
    [rows, grandTotalTarget],
  );

  // ============ AUTO-FIT PIPELINE (one-click exact invoice) ============
  const tryPrices = useCallback(
    (
      ctnsArr: number[],
      pcsArr: number[],
      dec: number,
      targetCents: number,
      minP: number,
      maxP: number,
    ): number[] | null => {
      const n = ctnsArr.length;
      if (n === 0) return null;
      const scale = Math.pow(10, dec);
      const T = Math.round((targetCents * scale) / 100);
      const tts = ctnsArr.map((c, i) => c * pcsArr[i]);
      if (tts.some((t) => t <= 0)) return null;

      let g = tts[0];
      for (let i = 1; i < n; i++) g = gcdN(g, tts[i]);
      if (T % g !== 0) return null;

      const kMin = Math.ceil(minP * scale);
      const kMax = Math.floor(maxP * scale);
      if (kMin < 1 || kMin > kMax) return null;
      const totalTT = tts.reduce((a, b) => a + b, 0);
      if (T < totalTT * kMin || T > totalTT * kMax) return null;

      const ks = new Array<number>(n);
      const avgK = Math.max(kMin, Math.min(kMax, Math.round(T / totalTT)));
      for (let i = 0; i < n; i++) ks[i] = avgK;
      const rem = T - ks.reduce((a, k, i) => a + k * tts[i], 0);

      const prefixG = [tts[0]];
      for (let i = 1; i < n; i++) prefixG.push(gcdN(prefixG[i - 1], tts[i]));
      const extGcd = (a: number, b: number): [number, number, number] => {
        if (b === 0) return [a, 1, 0];
        const [gg, x1, y1] = extGcd(b, a % b);
        return [gg, y1, x1 - Math.floor(a / b) * y1];
      };
      const deltas = new Array(n).fill(0);
      let r = rem;
      for (let i = n - 1; i >= 1; i--) {
        const gi = prefixG[i];
        const [, , y] = extGcd(prefixG[i - 1], tts[i]);
        const factor = r / gi;
        const dy = y * factor;
        deltas[i] = dy;
        r = r - dy * tts[i];
      }
      deltas[0] = r / tts[0];
      for (let i = 0; i < n; i++) ks[i] += deltas[i];

      const inBand = (k: number) => k >= kMin && k <= kMax;
      let iter = 0;
      while (iter++ < 5000) {
        const badIdx = ks.findIndex((k) => !inBand(k));
        if (badIdx === -1) break;
        const target = ks[badIdx] < kMin ? kMin : kMax;
        const need = target - ks[badIdx];
        let placed = false;
        const order = ks
          .map((_, i) => i)
          .filter((i) => i !== badIdx)
          .sort((a, b) => {
            const sa = need > 0 ? ks[a] - kMin : kMax - ks[a];
            const sb = need > 0 ? ks[b] - kMin : kMax - ks[b];
            return sb - sa;
          });
        for (const j of order) {
          const stepBad = tts[j] / gcdN(tts[j], tts[badIdx]);
          const dir = need > 0 ? 1 : -1;
          const maxBadMove =
            dir > 0 ? Math.min(need, kMax - ks[badIdx]) : Math.max(need, kMin - ks[badIdx]);
          const stepsMax = Math.floor(Math.abs(maxBadMove) / stepBad);
          if (stepsMax <= 0) continue;
          const donorPerStep = (-dir * (stepBad * tts[badIdx])) / tts[j];
          let stepsAllowed = stepsMax;
          if (donorPerStep > 0) {
            stepsAllowed = Math.min(stepsAllowed, Math.floor((kMax - ks[j]) / donorPerStep));
          } else if (donorPerStep < 0) {
            stepsAllowed = Math.min(stepsAllowed, Math.floor((ks[j] - kMin) / -donorPerStep));
          }
          if (stepsAllowed <= 0) continue;
          ks[badIdx] += dir * stepBad * stepsAllowed;
          ks[j] += donorPerStep * stepsAllowed;
          placed = true;
          break;
        }
        if (!placed) return null;
      }
      if (ks.some((k) => k < kMin || k > kMax)) return null;
      const sum = ks.reduce((a, k, i) => a + k * tts[i], 0);
      if (sum !== T) return null;
      return ks.map((k) => k / scale);
    },
    [],
  );

  const PCS_POOL = [10, 12, 16, 20, 24, 25, 30, 32, 40, 48, 50, 60, 75, 80, 100];

  const autoFit = useCallback(() => {
    const dec = decimals;
    const targetCents = Math.round(grandTotalTarget * 100);

    if (totalCtnsTarget < rows.length) {
      setBanner({ type: "warn", text: `Total cartons (${totalCtnsTarget}) must be ≥ number of rows (${rows.length}).` });
      return;
    }

    // Force-Divide mode: skip GCD/decimal/band constraints entirely.
    if (freeDivide) {
      const n = rows.length;
      const ctnsArr = randomPartition(totalCtnsTarget, n);
      if (ctnsArr.length !== n) {
        setBanner({ type: "warn", text: "Could not distribute cartons across rows." });
        return;
      }
      const pcsArr = rows.map((r) => r.pcs > 0 ? r.pcs : PCS_POOL[Math.floor(Math.random() * PCS_POOL.length)]);
      forceDividePrices(ctnsArr, pcsArr);
      return;
    }

    if (dec < 2) {
      const factor = Math.pow(10, 2 - dec);
      if (targetCents % factor !== 0) {
        setBanner({
          type: "warn",
          text: `Grand total must be a multiple of $${(factor / 100).toFixed(Math.max(0, 2 - dec))} at ${dec} decimal.`,
        });
        return;
      }
    }

    const n = rows.length;
    const ids = rows.map((r) => r.id);
    let bandWidened = 0;
    let curMin = minPrice;
    let curMax = maxPrice;

    for (let bandTry = 0; bandTry < 4; bandTry++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const ctnsArr = randomPartition(totalCtnsTarget, n);
        if (ctnsArr.length !== n) continue;
        let pcsArr = Array.from(
          { length: n },
          () => PCS_POOL[Math.floor(Math.random() * PCS_POOL.length)],
        );
        let prices = tryPrices(ctnsArr, pcsArr, dec, targetCents, curMin, curMax);
        if (!prices) {
          outer: for (let radius = 1; radius <= 4 && !prices; radius++) {
            for (let i = 0; i < n; i++) {
              for (const sign of [-1, 1]) {
                const np = pcsArr[i] + sign * radius;
                if (np < 1 || np > 9999) continue;
                const trial = pcsArr.slice();
                trial[i] = np;
                const p = tryPrices(ctnsArr, trial, dec, targetCents, curMin, curMax);
                if (p) {
                  pcsArr = trial;
                  prices = p;
                  break outer;
                }
              }
            }
          }
        }
        if (prices) {
          const newRows: Row[] = ids.map((id, i) => ({
            id,
            ctns: ctnsArr[i],
            pcs: pcsArr[i],
            price: prices![i],
          }));
          setRows(newRows);
          if (bandWidened > 0) {
            setMinPrice(curMin);
            setMaxPrice(curMax);
          }
          setBanner({
            type: "success",
            text:
              `✓ Exact invoice generated: $${fmtMoney(grandTotalTarget)} across ${fmtInt(totalCtnsTarget)} cartons` +
              (bandWidened > 0
                ? ` (price band auto-widened to [$${curMin.toFixed(dec)}, $${curMax.toFixed(dec)}])`
                : "") +
              `.`,
          });
          return;
        }
      }
      bandWidened++;
      curMin = Math.max(Math.pow(10, -dec), curMin * 0.9);
      curMax = curMax * 1.1;
    }

    setBanner({
      type: "warn",
      text: "Auto-Fit could not converge. Try a different row count, total cartons, or grand total.",
    });
  }, [rows, totalCtnsTarget, grandTotalTarget, decimals, minPrice, maxPrice, tryPrices, freeDivide, forceDividePrices]);

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

          {/* Price band panel */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl p-4"
               style={{ border: "1px solid hsl(var(--aqua) / 0.18)", background: "hsl(var(--aqua) / 0.04)" }}>
            <label className="block">
              <span className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">
                Min Unit Price (USD)
              </span>
              <input
                type="number"
                min={Math.pow(10, -decimals)}
                step={Math.pow(10, -decimals)}
                value={minPrice}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMinPrice(Number.isFinite(n) && n > 0 ? roundDec(n, decimals) : Math.pow(10, -decimals));
                }}
                className="glass-input"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs text-muted-foreground uppercase tracking-wide">
                Max Unit Price (USD)
              </span>
              <input
                type="number"
                min={Math.pow(10, -decimals)}
                step={Math.pow(10, -decimals)}
                value={maxPrice}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMaxPrice(Number.isFinite(n) && n > 0 ? roundDec(n, decimals) : minPrice);
                }}
                className="glass-input"
              />
            </label>
            <div className="flex items-end">
              <div
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={{
                  border: `1px solid hsl(${feasibility.ok ? "142 70% 45%" : "45 90% 55%"} / 0.5)`,
                  background: `hsl(${feasibility.ok ? "142 70% 45%" : "45 90% 55%"} / 0.08)`,
                  color: `hsl(${feasibility.ok ? "142 80% 70%" : "45 95% 75%"})`,
                }}
              >
                {feasibility.ok ? "✓ Feasible — " : "⚠ Not feasible — "}
                {feasibility.reason}
              </div>
            </div>
          </div>

          {/* Force-Divide toggle */}
          <label
            className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer select-none"
            style={{
              border: `1px solid hsl(var(--aqua) / ${freeDivide ? 0.5 : 0.18})`,
              background: `hsl(var(--aqua) / ${freeDivide ? 0.08 : 0.03})`,
            }}
          >
            <input
              type="checkbox"
              checked={freeDivide}
              onChange={(e) => setFreeDivide(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">
                Disable TT/QTY constraint — Force-Divide prices
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Splits the grand total across rows in cents and sets each price = amount ÷ (CTNS × PCS).
                Always exact at any decimals; ignores GCD feasibility and the min/max price band.
              </div>
            </div>
          </label>

          {!feasibility.ok && suggestions.length > 0 && (
            <div
              className="mt-4 rounded-xl p-4"
              style={{
                border: "1px solid hsl(var(--aqua) / 0.25)",
                background: "hsl(var(--aqua) / 0.05)",
              }}
            >
              <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Smallest PCS changes to make exact total feasible
                </span>
                <span className="text-xs text-muted-foreground">
                  {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-2">
                {suggestions.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    style={{
                      background: "hsl(var(--background) / 0.5)",
                      border: "1px solid hsl(var(--aqua) / 0.15)",
                    }}
                  >
                    <div className="text-sm">
                      <div className="font-mono tabular-nums">{s.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.reason} · total |Δ| = {s.totalAbsDelta}
                      </div>
                    </div>
                    <button
                      onClick={() => applySuggestion(s)}
                      className="submit-button px-3 py-1.5 text-xs whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={autoFit}
              className="submit-button w-full max-w-md px-6 py-4 text-base font-semibold tracking-wide"
            >
              ⚡ Generate Exact Invoice
            </button>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? "▴ Hide advanced controls" : "▾ Advanced controls"}
            </button>
          </div>

          {showAdvanced && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <button onClick={randomizeCartons} className="glass-button px-4 py-2 text-sm">
                🎲 Randomize Cartons
              </button>
              <button onClick={solve} className="glass-button px-4 py-2 text-sm">
                ✦ Solve Prices
              </button>
              <button onClick={() => forceDividePrices()} className="glass-button px-4 py-2 text-sm">
                ÷ Force-Divide Prices
              </button>
              <button onClick={addRow} className="glass-button px-4 py-2 text-sm">
                + Add Row
              </button>
              <button onClick={reset} className="glass-button px-4 py-2 text-sm">
                ↺ Reset
              </button>
            </div>
          )}


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
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Invoice rows
            </span>
            <button
              onClick={copyNumbers}
              className="glass-button px-3 py-1.5 text-xs"
              title="Copy cartons, PCS, and prices in clean vertical format"
            >
              📋 Copy Numbers
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide text-muted-foreground"
                  style={{ borderBottom: "1px solid hsl(var(--aqua) / 0.18)" }}
                >
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>QTY (CTNS)</span>
                      <button
                        onClick={() => copyColumn("CTNS", computed.map((r) => fmtInt(r.ctns)))}
                        className="ml-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Copy CTNS column"
                      >
                        📋
                      </button>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>QTY (PCS)</span>
                      <button
                        onClick={() => copyColumn("PCS", computed.map((r) => fmtInt(r.pcs)))}
                        className="ml-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Copy PCS column"
                      >
                        📋
                      </button>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right">TT / QTY (PCS)</th>
                  <th className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>Unit Price (USD)</span>
                      <button
                        onClick={() => copyColumn("Unit Price", computed.map((r) => r.price.toFixed(decimals)))}
                        className="ml-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Copy Unit Price column"
                      >
                        📋
                      </button>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>Amount (USD)</span>
                      <button
                        onClick={() => copyColumn("Amount", computed.map((r) => `$${fmtMoney(r.amount)}`))}
                        className="ml-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Copy Amount column"
                      >
                        📋
                      </button>
                    </div>
                  </th>
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
