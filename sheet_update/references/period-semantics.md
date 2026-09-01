# Period Semantics

The requested period is authoritative and must match `YYYYQ1`, `YYYYH1`, `YYYYQ3`, or `YYYYFY`.

| Requested period | Cumulative or annual label | Single-quarter label | Single-quarter rule |
| --- | --- | --- | --- |
| `YYYYQ1` | `YYYYQ1` | `YYYY-1Q` | Reported Q1 cumulative value |
| `YYYYH1` | `YYYYH1` | `YYYY-2Q` | H1 cumulative minus Q1 cumulative |
| `YYYYQ3` | `YYYYQ3` | `YYYY-3Q` | Q3 cumulative minus H1 cumulative |
| `YYYYFY` | `YYYYFY` | `YYYY-4Q` | FY value minus Q3 cumulative |

Apply cumulative subtraction only to income-statement and cash-flow measures. Use period-end disclosed values directly for balance-sheet measures.

Rules:

- Never display an H1 cumulative column as Q2.
- A source value must retain its disclosed period, current/comparative column, scope, statement type, and unit.
- Apply unit conversion before writing a reported value. Record both the source unit and target unit plus a numeric conversion factor.
- Use formulas for single-quarter subtraction, totals, margins, expense ratios, year-on-year changes, and quarter-on-quarter changes.
- When a prerequisite cumulative value is absent or cannot be mapped reliably, leave the derived cell blank and add an unresolved record.
- Prefer consolidated statements. If only parent-company statements are available, disclose that limitation and do not mix scopes within one series.
