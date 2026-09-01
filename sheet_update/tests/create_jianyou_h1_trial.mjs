#!/usr/bin/env node
/** Create a full official-filing regression run for the Jianyou 2026 H1 examples. */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parse(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, "")] = argv[index + 1];
  for (const key of ["run-dir", "input", "q1-filing", "h1-filing"]) if (!args[key]) throw new Error(`Missing --${key}.`);
  return args;
}

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

const S = {
  main: "\u56fe\u8868 1 \u4e3b\u8981\u8d22\u52a1\u6307\u6807",
  annual: "\u56fe\u88682-3\u8425\u4e1a\u6536\u5165\u548c\u5f52\u6bcd\u51c0\u5229\u6da6",
  quarterly: "\u56fe\u88685\u5206\u5b63\u5ea6\u8d22\u52a1\u6570\u636e",
  quarterlyRevenue: "\u56fe\u88686\u5206\u5b63\u5ea6\u8425\u4e1a\u6536\u5165",
  quarterlyProfit: "\u56fe\u88687\u5206\u5b63\u5ea6\u5f52\u6bcd\u51c0\u5229\u6da6",
  research: "\u56fe\u886810\u7814\u53d1\u8d39\u7528",
  expenseRates: "\u56fe\u886811\u671f\u95f4\u8d39\u7528\u7387",
  grossMargin: "\u6bdb\u5229\u7387",
  helper: "Update Audit",
};

function raw(id, filingId, metric, period, value, page, evidenceIds, statementType = "income_statement") {
  return { id, filing_id: filingId, statement_type: statementType, consolidation_scope: "consolidated", metric, source_label: metric, period, comparison_period: null, value, source_unit: "CNY", target_unit: "CNY million", conversion_factor: 0.000001, pdf_page: page, evidence_ids: evidenceIds };
}

function columnName(oneBasedIndex) {
  let value = oneBasedIndex;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function main() {
  return run();
}

async function run() {
  const args = parse(process.argv.slice(2));
  const runDir = path.resolve(args["run-dir"]);
  const input = path.resolve(args.input);
  const q1Filing = path.resolve(args["q1-filing"]);
  const h1Filing = path.resolve(args["h1-filing"]);
  const captureDir = path.join(runDir, "captures");
  await fs.mkdir(runDir, { recursive: true });

  const captureItems = [
    { id: "EV_Q1_SUMMARY", filing_id: "SRC_Q1", pdf_path: q1Filing, page_number: 1, crop: { x: 230, y: 1360, width: 1240, height: 720 }, highlights: [{ x: 245, y: 1650, width: 1210, height: 430 }] },
    { id: "EV_Q1_INCOME_A", filing_id: "SRC_Q1", pdf_path: q1Filing, page_number: 8, crop: { x: 235, y: 1660, width: 1230, height: 520 }, highlights: [{ x: 245, y: 1770, width: 1210, height: 390 }] },
    { id: "EV_Q1_INCOME_B", filing_id: "SRC_Q1", pdf_path: q1Filing, page_number: 9, crop: { x: 235, y: 420, width: 1230, height: 1780 }, highlights: [{ x: 245, y: 470, width: 1210, height: 370 }, { x: 245, y: 1480, width: 1210, height: 620 }] },
    { id: "EV_H1_SUMMARY", filing_id: "SRC_H1", pdf_path: h1Filing, page_number: 6, crop: { x: 220, y: 300, width: 1280, height: 620 }, highlights: [{ x: 250, y: 425, width: 1220, height: 235 }, { x: 250, y: 650, width: 1220, height: 55 }] },
    { id: "EV_H1_CHANGE", filing_id: "SRC_H1", pdf_path: h1Filing, page_number: 18, crop: { x: 225, y: 1200, width: 1260, height: 520 }, highlights: [{ x: 245, y: 1260, width: 1230, height: 275 }] },
    { id: "EV_H1_INCOME", filing_id: "SRC_H1", pdf_path: h1Filing, page_number: 56, crop: { x: 225, y: 1240, width: 1260, height: 950 }, highlights: [{ x: 245, y: 1310, width: 1230, height: 760 }] },
  ];

  const rawValues = [];
  const rawByKey = new Map();
  const addRaw = (key, filing, metric, period, value, page, evidence, type) => {
    const id = `VAL_${key}`;
    rawValues.push(raw(id, filing, metric, period, value, page, evidence, type));
    rawByKey.set(key, id);
  };
  const q1 = {
    revenue: [928664346.80, 885219018.08], cost: [628623395.31, 580611554.09], selling: [98065183.27, 83787149.22], admin: [70402898.65, 42607829.78], research: [32837926.11, 69243203.24], finance: [40344577.43, 21803504.58], operatingProfit: [97705436.00, 92742715.49], totalProfit: [97705436.00, 92739158.24], tax: [8694267.71, 8028085.57], parentProfit: [89011918.16, 84713913.06], adjustedProfit: [56572997.53, 75321188.86], operatingCashFlow: [510072642.46, 164221944.29],
  };
  const h1 = {
    revenue: [1926260932.67, 1979845467.48], cost: [1279272945.24, 1237682262.89], selling: [203906254.59, 185425186.94], admin: [139840090.13, 117579188.83], research: [119305764.16, 142140345.92], finance: [63774067.93, 46979284.98], operatingProfit: [189952027.04, 311945295.96], totalProfit: [189941627.78, 310160900.73], tax: [2386970.20, 23899174.56], parentProfit: [187550698.73, 286267552.30], adjustedProfit: [146289280.96, 260058164.36], operatingCashFlow: [733882857.69, 410413411.47],
  };
  for (const [metric, values] of Object.entries(q1)) {
    const evidence = ["revenue", "totalProfit", "parentProfit", "adjustedProfit"].includes(metric) ? ["EV_Q1_SUMMARY"] : metric === "cost" ? ["EV_Q1_INCOME_A"] : ["EV_Q1_INCOME_B"];
    const page = evidence[0] === "EV_Q1_SUMMARY" ? 1 : evidence[0] === "EV_Q1_INCOME_A" ? 8 : 9;
    addRaw(`Q1_CY_${metric}`, "SRC_Q1", metric, "2026Q1", values[0], page, evidence, metric === "operatingCashFlow" ? "cash_flow_statement" : "income_statement");
    addRaw(`Q1_PY_${metric}`, "SRC_Q1", metric, "2025Q1", values[1], page, evidence, metric === "operatingCashFlow" ? "cash_flow_statement" : "income_statement");
  }
  for (const [metric, values] of Object.entries(h1)) {
    const evidence = ["revenue", "totalProfit", "parentProfit", "adjustedProfit", "operatingCashFlow"].includes(metric) ? ["EV_H1_SUMMARY"] : ["tax", "operatingProfit"].includes(metric) ? ["EV_H1_INCOME"] : ["EV_H1_CHANGE"];
    const page = evidence[0] === "EV_H1_SUMMARY" ? 6 : evidence[0] === "EV_H1_CHANGE" ? 18 : 56;
    addRaw(`H1_CY_${metric}`, "SRC_H1", metric, "2026H1", values[0], page, evidence, metric === "operatingCashFlow" ? "cash_flow_statement" : "income_statement");
    addRaw(`H1_PY_${metric}`, "SRC_H1", metric, "2025H1", values[1], page, evidence, metric === "operatingCashFlow" ? "cash_flow_statement" : "income_statement");
  }

  const updates = [];
  let counter = 0;
  const add = (sheet, cell, kind, valueOrFormula, evidenceIds = [], extra = {}) => {
    counter += 1;
    const item = { id: `UPD_${String(counter).padStart(4, "0")}`, sheet, cell, kind, evidence_ids: evidenceIds, ...extra };
    if (kind === "formula") item.formula = valueOrFormula;
    else item.value = valueOrFormula;
    updates.push(item);
    return item;
  };
  const direct = (sheet, cell, rawKey, value, evidence, format = "#,##0.00") => add(sheet, cell, "reported_value", value / 1e6, evidence, { raw_value_id: rawByKey.get(rawKey), number_format: format });
  const label = (sheet, cell, value, copyFrom) => add(sheet, cell, "label", value, [], copyFrom ? { copy_from: copyFrom } : {});
  const formula = (sheet, cell, value, evidence = [], format, copyFrom) => add(sheet, cell, "formula", value, evidence, { ...(format ? { number_format: format } : {}), ...(copyFrom ? { copy_from: copyFrom } : {}) });

  label(S.main, "E24", "2025H1"); label(S.main, "E25", "2026H1");
  add(S.main, "A2", "label", 45838); add(S.main, "A3", "label", 46203);
  const mainColumns = { F: "revenue", G: "cost", H: "selling", I: "admin", J: "research", K: "finance", L: "tax", M: "parentProfit", N: "adjustedProfit", O: "operatingCashFlow" };
  for (const [column, metric] of Object.entries(mainColumns)) {
    const ev = rawValues.find((item) => item.id === rawByKey.get(`H1_PY_${metric}`)).evidence_ids;
    direct(S.main, `${column}24`, `H1_PY_${metric}`, h1[metric][1], ev);
    direct(S.main, `${column}25`, `H1_CY_${metric}`, h1[metric][0], ev);
    formula(S.main, `${column}26`, column === "O" ? "=(O25-O24)/ABS(O24)" : `=${column}25/${column}24-1`, ev, "0.00%");
  }

  add(S.annual, "N1", "label", 46203); label(S.annual, "N2", "2026H1"); direct(S.annual, "N3", "H1_CY_revenue", h1.revenue[0], ["EV_H1_SUMMARY"]); formula(S.annual, "N4", "=N3/O3-1", ["EV_H1_SUMMARY"], "0.00%"); direct(S.annual, "N5", "H1_CY_parentProfit", h1.parentProfit[0], ["EV_H1_SUMMARY"]); formula(S.annual, "N6", "=N5/O5-1", ["EV_H1_SUMMARY"], "0.00%");
  add(S.annual, "O1", "label", 45838); label(S.annual, "O2", "2025H1"); direct(S.annual, "O3", "H1_PY_revenue", h1.revenue[1], ["EV_H1_SUMMARY"]); direct(S.annual, "O5", "H1_PY_parentProfit", h1.parentProfit[1], ["EV_H1_SUMMARY"]);

  const rowMap = { revenue: 5, cost: 8, selling: 10, admin: 11, research: 12, finance: 13, operatingProfit: 14, totalProfit: 15, tax: 16, parentProfit: 17, adjustedProfit: 20 };
  label(S.quarterly, "AF2", 46203, "AE2"); label(S.quarterly, "AF4", "2026-2Q", "AE4");
  for (const [metric, row] of Object.entries(rowMap)) {
    const q1Ev = rawValues.find((item) => item.id === rawByKey.get(`Q1_CY_${metric}`)).evidence_ids;
    const h1Ev = rawValues.find((item) => item.id === rawByKey.get(`H1_CY_${metric}`)).evidence_ids;
    direct(S.quarterly, `AE${row}`, `Q1_CY_${metric}`, q1[metric][0], q1Ev);
    formula(S.quarterly, `AB${row}`, `=ROUND((${h1[metric][1]}-${q1[metric][1]})/1000000,2)`, [...new Set([...q1Ev, ...h1Ev])], "#,##0.00");
    formula(S.quarterly, `AF${row}`, `=ROUND((${h1[metric][0]}-${q1[metric][0]})/1000000,2)`, [...new Set([...q1Ev, ...h1Ev])], "#,##0.00", `AE${row}`);
  }
  for (const col of ["AB", "AE", "AF"]) {
    const priorYearCol = col === "AF" ? "AB" : col === "AE" ? "AA" : "X";
    const priorQuarterCol = col === "AF" ? "AE" : col === "AE" ? "AD" : "AA";
    formula(S.quarterly, `${col}6`, `=IFERROR(${col}5/${priorYearCol}5-1,"")`, [], "0.00%", col === "AF" ? "AE6" : undefined);
    formula(S.quarterly, `${col}7`, col === "AE" ? '=""' : `=${col}5/${priorQuarterCol}5-1`, [], "0.00%", col === "AF" ? "AE7" : undefined);
    formula(S.quarterly, `${col}9`, `=1-${col}8/${col}5`, [], "0.00%", col === "AF" ? "AE9" : undefined);
    formula(S.quarterly, `${col}18`, `=IFERROR(${col}17/${priorYearCol}17-1,"")`, [], "0.00%", col === "AF" ? "AE18" : undefined);
    formula(S.quarterly, `${col}19`, `=${col}17/${col}5`, [], "0.00%", col === "AF" ? "AE19" : undefined);
    formula(S.quarterly, `${col}21`, `=IFERROR(${col}20/${priorYearCol}20-1,"")`, [], "0.00%", col === "AF" ? "AE21" : undefined);
  }

  label(S.quarterlyRevenue, "AE4", "2026-2Q", "AD4"); formula(S.quarterlyRevenue, "AE5", `='${S.quarterly}'!AF5`, ["EV_Q1_SUMMARY", "EV_H1_SUMMARY"], "#,##0.00", "AD5"); formula(S.quarterlyRevenue, "AE6", `='${S.quarterly}'!AF6`, ["EV_Q1_SUMMARY", "EV_H1_SUMMARY"], "0.00%", "AD6");
  label(S.quarterlyProfit, "AE6", "2026-2Q", "AD6"); formula(S.quarterlyProfit, "AE7", `='${S.quarterly}'!AF17`, ["EV_Q1_SUMMARY", "EV_H1_SUMMARY"], "#,##0.00", "AD7"); formula(S.quarterlyProfit, "AE8", `='${S.quarterly}'!AF18`, [], "0.00%", "AD8"); formula(S.quarterlyProfit, "AE9", `='${S.quarterly}'!AF20`, ["EV_Q1_SUMMARY", "EV_H1_SUMMARY"], "#,##0.00", "AD9"); formula(S.quarterlyProfit, "AE10", `='${S.quarterly}'!AF21`, [], "0.00%", "AD10");

  label(S.research, "N2", "2026H1"); label(S.research, "O2", "2025H1"); direct(S.research, "N3", "H1_CY_research", h1.research[0], ["EV_H1_CHANGE"]); direct(S.research, "O3", "H1_PY_research", h1.research[1], ["EV_H1_CHANGE"]); formula(S.research, "N4", "=N3/N5", ["EV_H1_CHANGE"], "0.00%"); formula(S.research, "O4", "=O3/O5", ["EV_H1_CHANGE"], "0.00%"); label(S.research, "C5", "\u8425\u4e1a\u6536\u5165"); direct(S.research, "N5", "H1_CY_revenue", h1.revenue[0], ["EV_H1_SUMMARY"]); direct(S.research, "O5", "H1_PY_revenue", h1.revenue[1], ["EV_H1_SUMMARY"]);
  label(S.research, "T26", "2026-2Q", "S26"); formula(S.research, "T27", `='${S.quarterly}'!AF5`, ["EV_Q1_SUMMARY", "EV_H1_SUMMARY"], "#,##0.00", "S27"); formula(S.research, "T28", `='${S.quarterly}'!AF12`, ["EV_Q1_INCOME_B", "EV_H1_CHANGE"], "#,##0.00", "S28"); formula(S.research, "T29", "=T28/T27", [], "0.00%", "S29");

  label(S.expenseRates, "N2", "26H1"); label(S.expenseRates, "O2", "25H1"); label(S.expenseRates, "P2", "H1YOY");
  const rateMetrics = { 3: "selling", 4: "admin", 5: "finance" };
  for (const [row, metric] of Object.entries(rateMetrics)) { formula(S.expenseRates, `N${row}`, `=N${Number(row) + 5}/N7`, ["EV_H1_CHANGE"], "0.00%"); formula(S.expenseRates, `O${row}`, `=O${Number(row) + 5}/O7`, ["EV_H1_CHANGE"], "0.00%"); formula(S.expenseRates, `P${row}`, `=N${row}-O${row}`, [], "0.00%"); direct(S.expenseRates, `N${Number(row) + 5}`, `H1_CY_${metric}`, h1[metric][0], ["EV_H1_CHANGE"]); direct(S.expenseRates, `O${Number(row) + 5}`, `H1_PY_${metric}`, h1[metric][1], ["EV_H1_CHANGE"]); }
  direct(S.expenseRates, "N7", "H1_CY_revenue", h1.revenue[0], ["EV_H1_SUMMARY"]); direct(S.expenseRates, "O7", "H1_PY_revenue", h1.revenue[1], ["EV_H1_SUMMARY"]); formula(S.expenseRates, "N6", "=SUM(N3:N5)", [], "0.00%"); formula(S.expenseRates, "O6", "=SUM(O3:O5)", [], "0.00%"); formula(S.expenseRates, "P6", "=N6-O6", [], "0.00%"); formula(S.expenseRates, "N11", "=SUM(N8:N10)", [], "#,##0.00"); formula(S.expenseRates, "O11", "=SUM(O8:O10)", [], "#,##0.00");
  label(S.expenseRates, "A24", "\u5206\u5b63\u5ea6\u4e09\u9879\u8d39\u7528\u7387");
  const quarterCols = ["B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA"];
  const quarterLabels = ["2020-1Q","2020-2Q","2020-3Q","2020-4Q","2021-1Q","2021-2Q","2021-3Q","2021-4Q","2022-1Q","2022-2Q","2022-3Q","2022-4Q","2023-1Q","2023-2Q","2023-3Q","2023-4Q","2024-1Q","2024-2Q","2024-3Q","2024-4Q","2025-1Q","2025-2Q","2025-3Q","2025-4Q","2026-1Q","2026-2Q"];
  for (let i = 0; i < quarterCols.length; i += 1) label(S.expenseRates, `${quarterCols[i]}25`, quarterLabels[i], i ? `${quarterCols[i - 1]}23` : "B23");
  const sourceStart = 7;
  for (let i = 0; i < quarterCols.length; i += 1) {
    const sourceColumn = columnName(sourceStart + i);
    const targetColumn = quarterCols[i];
    for (const [targetRow, sourceRow] of [[26,10],[27,11],[28,13]]) formula(S.expenseRates, `${targetColumn}${targetRow}`, `=IFERROR('${S.quarterly}'!${sourceColumn}${sourceRow}/'${S.quarterly}'!${sourceColumn}5,"")`, [], "0.00%", `${targetColumn}${Math.max(24, targetRow - 2)}`);
    formula(S.expenseRates, `${targetColumn}29`, `=IFERROR(SUM(${targetColumn}26:${targetColumn}28),"")`, [], "0.00%");
  }

  label(S.grossMargin, "C1", "2026Q2"); label(S.grossMargin, "D1", "2025Q2"); label(S.grossMargin, "F1", "YOY26Q2"); formula(S.grossMargin, "C2", `='${S.quarterly}'!AF9`, ["EV_Q1_INCOME_A", "EV_H1_CHANGE"], "0.00%"); formula(S.grossMargin, "D2", `='${S.quarterly}'!AB9`, ["EV_Q1_INCOME_A", "EV_H1_CHANGE"], "0.00%"); formula(S.grossMargin, "F2", "=C2-D2", [], "0.00%");

  function addChartHelper(helperSheet, sourceSheet, helperStart, sourceStart, categoryRow, valueRows, pointCount, headers) {
    const categoryColumn = columnName(helperStart);
    label(helperSheet, `${categoryColumn}4`, "Period");
    for (let seriesIndex = 0; seriesIndex < valueRows.length; seriesIndex += 1) label(helperSheet, `${columnName(helperStart + seriesIndex + 1)}4`, headers[seriesIndex]);
    for (let point = 0; point < pointCount; point += 1) {
      const sourceColumn = columnName(sourceStart + point);
      formula(helperSheet, `${categoryColumn}${5 + point}`, `='${sourceSheet}'!${sourceColumn}${categoryRow}`);
      for (let seriesIndex = 0; seriesIndex < valueRows.length; seriesIndex += 1) formula(helperSheet, `${columnName(helperStart + seriesIndex + 1)}${5 + point}`, `=IFERROR('${sourceSheet}'!${sourceColumn}${valueRows[seriesIndex]},"")`);
    }
    return `${categoryColumn}4:${columnName(helperStart + valueRows.length)}${4 + pointCount}`;
  }
  const revenueHelper = addChartHelper(S.helper, S.quarterlyRevenue, 1, 19, 4, [5, 6], 13, ["Revenue", "YOY"]);
  const parentHelper = addChartHelper(S.helper, S.quarterlyProfit, 5, 19, 6, [7, 8], 13, ["Parent net income", "YOY"]);
  const adjustedHelper = addChartHelper(S.helper, S.quarterlyProfit, 9, 20, 6, [9, 10], 12, ["Adjusted parent net income", "YOY"]);

  const chartUpdates = [
    ...[0,1,2].map((series_index, i) => ({ sheet: S.main, chart_index: 0, series_index, name: ["2025H1","2026H1","\u540c\u6bd4\u589e\u901f"][i] })),
    { sheet: S.quarterlyRevenue, chart_index: 0, data_sheet: S.helper, data_range: revenueHelper, replace_chart: true, chart_type: "line" },
    { sheet: S.quarterlyProfit, chart_index: 0, data_sheet: S.helper, data_range: parentHelper, replace_chart: true, chart_type: "line" },
    { sheet: S.quarterlyProfit, chart_index: 1, data_sheet: S.helper, data_range: adjustedHelper, replace_chart: true, chart_type: "line" },
    ...[0,1,2,3].map((series_index) => ({ sheet: S.expenseRates, chart_index: 1, series_index, category_formula: `='${S.expenseRates}'!$O$25:$AA$25`, formula: `='${S.expenseRates}'!$O$${26 + series_index}:$AA$${26 + series_index}` })),
  ];

  const evidence = captureItems.map((item) => ({ id: item.id, filing_id: item.filing_id, pdf_page: item.page_number, screenshot_path: path.join(captureDir, `${item.id}.png`), supported_update_ids: updates.filter((update) => update.evidence_ids.includes(item.id)).map((update) => update.id) }));
  for (const item of captureItems) item.supported_update_ids = evidence.find((e) => e.id === item.id).supported_update_ids;
  const manifest = {
    schema_version: "1.0", input_workbook: { path: input, sha256: await sha256(input) }, company: { name: "Nanjing King-Friend Biochemical Pharmaceutical Co., Ltd.", stock_code: "603707" }, requested_period: "2026H1",
    source_filings: [
      { id: "SRC_Q1", source_type: "cninfo", title: "2026 First-quarter Report", publisher: "CNINFO", url: "https://static.cninfo.com.cn/finalpage/2026-04-30/1225260232.PDF", published_date: "2026-04-30", local_path: q1Filing, sha256: await sha256(q1Filing), is_correction: false },
      { id: "SRC_H1", source_type: "exchange", title: "2026 Semi-annual Report", publisher: "Shanghai Stock Exchange", url: "https://static.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-08-28/603707_20260828_EYZE.pdf", published_date: "2026-08-28", local_path: h1Filing, sha256: await sha256(h1Filing), is_correction: false },
    ], raw_values: rawValues, clear_ranges: [{ sheet: S.expenseRates, range: "A22:U23", apply_to: "contents" }], helper_sheets: [{ name: S.helper, visibility: "visible" }], hidden_ranges: [], copy_ranges: [
      { sheet: S.expenseRates, source: "B23:U27", destination: "B25:U29", copy_type: "all" },
      { sheet: S.expenseRates, source: "U25:U29", destination: "V25:V29", copy_type: "all" },
      { sheet: S.expenseRates, source: "U25:U29", destination: "W25:W29", copy_type: "all" },
      { sheet: S.expenseRates, source: "U25:U29", destination: "X25:X29", copy_type: "all" },
      { sheet: S.expenseRates, source: "U25:U29", destination: "Y25:Y29", copy_type: "all" },
      { sheet: S.expenseRates, source: "U25:U29", destination: "Z25:Z29", copy_type: "all" },
      { sheet: S.expenseRates, source: "U25:U29", destination: "AA25:AA29", copy_type: "all" }
    ], updates, chart_updates: chartUpdates, evidence,
    unresolved: [{
      sheet: S.quarterly,
      cells: ["AE7"],
      metric: "2026Q1 revenue quarter-on-quarter growth",
      reason: "The 2025 full-year filing was outside this Q1/H1 trial, so the prior-quarter revenue in the input template was not treated as official.",
      search_scope: "2026 first-quarter and 2026 semi-annual official filings"
    }],
    protected_sheets: ["\u56fe\u88684\u73b0\u91d1\u6d41\u91cf\u8868", "\u56fe\u88688\u6536\u5165\u62c6\u5206", "\u56fe\u88689\u6bdb\u5229\u7387\u548c\u51c0\u5229\u7387", "\u56fe\u886812ANDA_20230227", "\u56fe\u886812ANDA", "Sheet3"], baseline_errors: [],
  };
  await fs.writeFile(path.join(runDir, "capture-plan.json"), JSON.stringify({ schema_version: "1.0", items: captureItems }, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "update.json"), JSON.stringify(manifest, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify({ status: "ok", manifest: path.join(runDir, "update.json"), capture_plan: path.join(runDir, "capture-plan.json"), update_count: updates.length })}\n`);
}

main().catch((error) => { process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`); process.exitCode = 1; });
