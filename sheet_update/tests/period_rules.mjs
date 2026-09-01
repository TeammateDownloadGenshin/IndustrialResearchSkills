#!/usr/bin/env node
import assert from "node:assert/strict";

const cases = [
  ["2026Q1", "2026Q1", "2026-1Q", "reported"],
  ["2026H1", "2026H1", "2026-2Q", "H1-Q1"],
  ["2026Q3", "2026Q3", "2026-3Q", "Q3-H1"],
  ["2026FY", "2026FY", "2026-4Q", "FY-Q3"],
];

for (const [requested, cumulative, quarter, rule] of cases) {
  assert.match(requested, /^(?:19|20)\d{2}(?:Q1|H1|Q3|FY)$/);
  assert.equal(cumulative, requested);
  if (requested.endsWith("H1")) assert.ok(!cumulative.includes("Q2"));
  assert.match(quarter, /^(?:19|20)\d{2}-[1-4]Q$/);
  assert.ok(rule.length > 0);
}

process.stdout.write(`${JSON.stringify({ status: "ok", case_count: cases.length })}\n`);
