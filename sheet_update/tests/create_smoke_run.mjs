#!/usr/bin/env node
/** Create deterministic capture and update manifests for the Jianyou H1 smoke test. */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parse(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, "")] = argv[index + 1];
  for (const key of ["run-dir", "input", "filing"]) if (!args[key]) throw new Error(`Missing --${key}.`);
  return args;
}

async function hash(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function raw(id, metric, value, page, evidenceId) {
  return { id, filing_id: "SRC001", statement_type: "income_statement", consolidation_scope: "consolidated", metric, source_label: metric, period: id.includes("PY") ? "2025H1" : "2026H1", comparison_period: null, value, source_unit: "CNY", target_unit: "CNY million", conversion_factor: 0.000001, pdf_page: page, evidence_ids: [evidenceId] };
}

function direct(id, cell, rawValueId, value, evidenceId) {
  return { id, sheet: "\u56fe\u8868 1 \u4e3b\u8981\u8d22\u52a1\u6307\u6807", cell, kind: "reported_value", raw_value_id: rawValueId, value: value / 1_000_000, number_format: "#,##0.00", evidence_ids: [evidenceId] };
}

async function main() {
  const args = parse(process.argv.slice(2));
  const runDir = path.resolve(args["run-dir"]);
  const input = path.resolve(args.input);
  const filing = path.resolve(args.filing);
  await fs.mkdir(runDir, { recursive: true });
  const captureDir = path.join(runDir, "captures");
  const plan = {
    schema_version: "1.0",
    items: [
      { id: "EV001", filing_id: "SRC001", pdf_path: filing, page_number: 6, crop: { x: 220, y: 300, width: 1280, height: 620 }, highlights: [{ x: 250, y: 425, width: 1220, height: 235 }, { x: 250, y: 650, width: 1220, height: 55 }], supported_update_ids: ["UPD_F24", "UPD_F25", "UPD_M24", "UPD_M25", "UPD_N24", "UPD_N25", "UPD_O24", "UPD_O25"] },
      { id: "EV002", filing_id: "SRC001", pdf_path: filing, page_number: 18, crop: { x: 225, y: 1200, width: 1260, height: 520 }, highlights: [{ x: 245, y: 1260, width: 1230, height: 275 }], supported_update_ids: ["UPD_G24", "UPD_G25", "UPD_H24", "UPD_H25", "UPD_I24", "UPD_I25", "UPD_J24", "UPD_J25", "UPD_K24", "UPD_K25"] },
      { id: "EV003", filing_id: "SRC001", pdf_path: filing, page_number: 56, crop: { x: 225, y: 1440, width: 1260, height: 360 }, highlights: [{ x: 245, y: 1490, width: 1230, height: 55 }], supported_update_ids: ["UPD_L24", "UPD_L25"] }
    ]
  };
  await fs.writeFile(path.join(runDir, "capture-plan.json"), JSON.stringify(plan, null, 2), "utf8");

  const metrics = [
    ["F", "revenue", 1979845467.48, 1926260932.67, 6, "EV001"],
    ["G", "operating_cost", 1237682262.89, 1279272945.24, 18, "EV002"],
    ["H", "selling_expense", 185425186.94, 203906254.59, 18, "EV002"],
    ["I", "administrative_expense", 117579188.83, 139840090.13, 18, "EV002"],
    ["J", "research_and_development_expense", 142140345.92, 119305764.16, 18, "EV002"],
    ["K", "finance_expense", 46979284.98, 63774067.93, 18, "EV002"],
    ["L", "income_tax_expense", 23899174.56, 2386970.20, 56, "EV003"],
    ["M", "net_income_attributable_to_parent", 286267552.30, 187550698.73, 6, "EV001"],
    ["N", "adjusted_net_income_attributable_to_parent", 260058164.36, 146289280.96, 6, "EV001"],
    ["O", "operating_cash_flow", 410413411.47, 733882857.69, 6, "EV001"],
  ];
  const rawValues = [];
  const updates = [
    { id: "UPD_E24", sheet: "\u56fe\u8868 1 \u4e3b\u8981\u8d22\u52a1\u6307\u6807", cell: "E24", kind: "label", value: "2025H1" },
    { id: "UPD_E25", sheet: "\u56fe\u8868 1 \u4e3b\u8981\u8d22\u52a1\u6307\u6807", cell: "E25", kind: "label", value: "2026H1" },
  ];
  for (const [column, metric, prior, current, page, evidenceId] of metrics) {
    const priorId = `VAL_${column}_PY`;
    const currentId = `VAL_${column}_CY`;
    rawValues.push(raw(priorId, metric, prior, page, evidenceId), raw(currentId, metric, current, page, evidenceId));
    updates.push(direct(`UPD_${column}24`, `${column}24`, priorId, prior, evidenceId));
    updates.push(direct(`UPD_${column}25`, `${column}25`, currentId, current, evidenceId));
    updates.push({ id: `UPD_${column}26`, sheet: "\u56fe\u8868 1 \u4e3b\u8981\u8d22\u52a1\u6307\u6807", cell: `${column}26`, kind: "formula", formula: column === "O" ? "=(O25-O24)/ABS(O24)" : `=${column}25/${column}24-1`, number_format: "0.00%", evidence_ids: [evidenceId] });
  }
  const protectedSheets = ["\u56fe\u88682-3\u8425\u4e1a\u6536\u5165\u548c\u5f52\u6bcd\u51c0\u5229\u6da6", "\u56fe\u88684\u73b0\u91d1\u6d41\u91cf\u8868", "\u56fe\u88685\u5206\u5b63\u5ea6\u8d22\u52a1\u6570\u636e", "\u56fe\u88686\u5206\u5b63\u5ea6\u8425\u4e1a\u6536\u5165", "\u56fe\u88687\u5206\u5b63\u5ea6\u5f52\u6bcd\u51c0\u5229\u6da6", "\u56fe\u88688\u6536\u5165\u62c6\u5206", "\u56fe\u88689\u6bdb\u5229\u7387\u548c\u51c0\u5229\u7387", "\u56fe\u886810\u7814\u53d1\u8d39\u7528", "\u56fe\u886811\u671f\u95f4\u8d39\u7528\u7387", "\u6bdb\u5229\u7387", "\u56fe\u886812ANDA_20230227", "\u56fe\u886812ANDA", "Sheet3"];
  const evidence = plan.items.map((item) => ({ id: item.id, filing_id: "SRC001", pdf_page: item.page_number, screenshot_path: path.join(captureDir, `${item.id}.png`), supported_update_ids: item.supported_update_ids }));
  const manifest = {
    schema_version: "1.0",
    input_workbook: { path: input, sha256: await hash(input) },
    company: { name: "Nanjing King-Friend Biochemical Pharmaceutical Co., Ltd.", stock_code: "603707" },
    requested_period: "2026H1",
    source_filings: [{ id: "SRC001", source_type: "exchange", title: "2026 Semi-annual Report", publisher: "Shanghai Stock Exchange", url: "https://static.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-08-28/603707_20260828_EYZE.pdf", published_date: "2026-08-28", local_path: filing, sha256: await hash(filing), is_correction: false }],
    raw_values: rawValues,
    copy_ranges: [],
    updates,
    chart_updates: [],
    evidence,
    unresolved: [],
    protected_sheets: protectedSheets,
    baseline_errors: [],
  };
  await fs.writeFile(path.join(runDir, "update.json"), JSON.stringify(manifest, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify({ status: "ok", capture_plan: path.join(runDir, "capture-plan.json"), manifest: path.join(runDir, "update.json") })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
