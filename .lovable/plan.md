
# Walkthrough: Your One-Click Invoice Generator

## What you've built so far

You currently have a Cargo Invoice Optimizer that does this:

```text
USER INPUTS                  ENGINE                      OUTPUT
-----------                  ------                      ------
Grand Total ($)         →    Feasibility check     →    Table of rows with
Total Cartons           →    Diophantine solver    →    CTNS, PCS, Unit Price,
# Rows                  →    Price-band projection →    Amount — summing to
Decimals (1–5)          →    PCS-suggestion engine →    EXACT grand total
Min/Max Unit Price                                      EXACT total cartons
```

The math foundation is solid: cent-scaled integer arithmetic, GCD divisibility checks, extended-Euclidean solve, then a price-band projection. The recent PCS-suggestion panel lets the user fix infeasibility in one click.

## Where the friction still is

Even with everything above, the user today must:
1. Type the grand total
2. Click **Randomize Cartons**
3. Read the feasibility chip
4. (Maybe) click **Apply** on a PCS suggestion
5. Click **Solve**
6. (Maybe) widen the price band and re-solve

That is 3–6 clicks and some reading. A "one-click invoice" should collapse all of that into a single button that **never fails** and always returns an invoice matching the user's grand total exactly.

---

## Recommended Method: The "Auto-Fit" Pipeline

Instead of asking the user to orchestrate Randomize → Suggest → Apply → Solve, build a single `autoFit()` function behind one big button: **"⚡ Generate Exact Invoice"**.

### The pipeline (runs in <50 ms, all client-side)

```text
        ┌─────────────────────────────────────────────────┐
        │  Inputs: Grand Total, Total CTNS, # Rows,       │
        │          Decimals, Min/Max Price                │
        └────────────────────┬────────────────────────────┘
                             ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 1 — Distribute cartons (jittered even split)       │
   │   randomPartition(totalCtns, nRows)                     │
   └────────────────────┬────────────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 2 — Seed PCS values from a "nice" pool             │
   │   pool = [10,12,16,20,24,25,30,32,40,50,60,80,100]      │
   │   pick to make GCD(TT_i) divide T·10^dec                │
   └────────────────────┬────────────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 3 — Auto-repair if still infeasible                │
   │   Try ±1, ±2, ±3 PCS deltas (single row, then 2-row)    │
   │   Pick the smallest fix that satisfies divisibility     │
   │   AND keeps required avg price inside [min, max] band   │
   └────────────────────┬────────────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 4 — Solve prices (existing extended-GCD solver)    │
   └────────────────────┬────────────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 5 — Project into [min, max] band (existing)        │
   │   If projection fails → auto-widen band by 10% and      │
   │   retry, up to 3 times. Show a tiny "band widened" note │
   └────────────────────┬────────────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 6 — Verify: sum(amount_cents) == targetCents       │
   │   If not, retry Step 1 with new random seed (max 5×)    │
   └────────────────────┬────────────────────────────────────┘
                        ▼
              ✓ Exact invoice rendered
```

The key insight: **Step 2 (smart PCS seeding) is what makes this reliable**. By choosing PCS values from a small pool of common multiples (10, 12, 16, 20, 25…), the GCD condition is almost always satisfied on the first try, so the user never sees a feasibility warning.

### Why this is better than alternatives

| Approach | Pros | Cons |
|---|---|---|
| **Manual flow (today)** | Maximum control | 3–6 clicks, requires understanding feasibility |
| **Brute-force search** | Always works | Slow (>1 s), unpredictable PCS values |
| **LP/ILP solver lib** | Mathematically pure | Adds dependency, overkill, slow on web |
| **Auto-Fit pipeline (recommended)** | One click, <50 ms, predictable, reuses your existing solver | Slightly more code, needs a curated PCS pool |

---

## Proposed UI changes

Keep everything you have, but reframe the page around one hero button:

```text
┌──────────────────────────────────────────────────────────┐
│  Grand Total: [$1,119,475]    Cartons: [6307]            │
│  Rows: [7]  Decimals: [3]  Price: [$0.01] – [$100]       │
│                                                          │
│      ┌────────────────────────────────────────┐          │
│      │  ⚡ GENERATE EXACT INVOICE              │          │
│      └────────────────────────────────────────┘          │
│                                                          │
│  [Advanced ▾]  Randomize · Solve · Suggest · Reset       │
└──────────────────────────────────────────────────────────┘
```

- The big button runs the full Auto-Fit pipeline.
- All current buttons (Randomize, Solve, Apply Suggestion) move into a collapsible **Advanced** section for power users.
- The feasibility chip and PCS-suggestion panel stay, but only appear if the user is in Advanced mode and something is actually wrong.

---

## Optional polish (future)

- **Export**: one-click PDF / Excel / CSV of the generated invoice.
- **Presets**: save common configurations (grand total + carton count + band).
- **History**: keep the last 5 generated invoices in localStorage so users can revert.
- **Determinism toggle**: a "use seed" checkbox so the same inputs always produce the same invoice (useful for auditing).

---

## What I'd implement next (if you approve)

1. Add `autoFit()` function with the 6-step pipeline above.
2. Add the curated PCS pool constant.
3. Add the hero **⚡ Generate Exact Invoice** button at the top of the control panel.
4. Move existing buttons into an **Advanced** collapsible section.
5. Add an auto-band-widen retry loop with a subtle inline note when it triggers.

Estimated work: one focused edit to `src/pages/CargoOptimizer.tsx`, ~150 new lines, no new dependencies.

Reply **approve** (or tell me which steps to drop/change) and I'll switch to build mode and implement it.
