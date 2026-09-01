#!/usr/bin/env node
/** Inspect and render an XLSX before a period update. */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseOptions, loadPackage, safeName, sha256File, jsonStatus } from "./_shared.mjs";

const PERIOD_PATTERN = /(?:19|20)\d{2}\s*(?:Q[1-4]|[1-4]Q|H1|H2|FY|\u5e74|\u4e0a\u534a\u5e74|\u534a\u5e74\u5ea6|\u4e00\u5b63|\u4e09\u5b63)|(?:19|20)\d{2}[-/.](?:03|06|09|12)/i;
const ERROR_PATTERN = /#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/i;

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function parseStart(address) {
  const plain = String(address || "A1").split("!").pop().replace(/\$/g, "").split(":")[0];
  const match = /^([A-Z]+)(\d+)$/i.exec(plain);
  if (!match) return { row: 0, col: 0 };
  let col = 0;
  for (const char of match[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, col: col - 1 };
}

function drawingInfo(sheet) {
  const summarize = (item, type, index) => ({
    type,
    index,
    name: item.name || null,
    title: item.title || null,
    anchor: item.anchor || null,
    series_count: type === "chart" ? (item.series?.items?.length || 0) : undefined,
  });
  return [
    ...(sheet.charts?.items || []).map((item, index) => summarize(item, "chart", index)),
    ...(sheet.images?.items || []).map((item, index) => summarize(item, "image", index)),
    ...(sheet.shapes?.items || []).map((item, index) => summarize(item, "shape", index)),
  ];
}

async function main() {
  const args = parseOptions(process.argv.slice(2), ["input", "output", "preview-dir"]);
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const previewDir = path.resolve(args["preview-dir"]);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  const moduleValue = await loadPackage("@oai/artifact-tool");
  const { FileBlob, SpreadsheetFile } = moduleValue.default || moduleValue;
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
  const sheets = [];

  for (const [sheetIndex, sheet] of workbook.worksheets.items.entries()) {
    const used = sheet.getUsedRange();
    const address = used?.address || null;
    const values = used?.values || [];
    const formulas = used?.formulas || [];
    const start = parseStart(address);
    const cells = [];
    const periodCells = [];
    const formulaErrors = [];
    for (let row = 0; row < values.length; row += 1) {
      for (let col = 0; col < (values[row] || []).length; col += 1) {
        const value = values[row][col];
        const formula = formulas[row]?.[col] || null;
        if (value === null && !formula && value !== 0) continue;
        const cell = `${columnName(start.col + col)}${start.row + row + 1}`;
        const record = { cell, value, formula };
        cells.push(record);
        if (PERIOD_PATTERN.test(String(value ?? ""))) periodCells.push(record);
        if (ERROR_PATTERN.test(String(value ?? "")) || ERROR_PATTERN.test(String(formula ?? ""))) formulaErrors.push(record);
      }
    }
    const previewPath = path.join(previewDir, `${String(sheetIndex + 1).padStart(2, "0")}-${safeName(sheet.name)}.png`);
    const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 0.8, format: "png" });
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
    sheets.push({
      index: sheetIndex,
      name: sheet.name,
      visibility: sheet.visibility || "visible",
      used_range: address,
      cells,
      period_cells: periodCells,
      formula_errors: formulaErrors,
      drawings: drawingInfo(sheet),
      preview_path: previewPath,
    });
  }

  const result = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    input_workbook: { path: inputPath, sha256: await sha256File(inputPath) },
    period_pattern: PERIOD_PATTERN.source,
    sheets,
    baseline_errors: sheets.flatMap((sheet) => sheet.formula_errors.map((item) => ({ sheet: sheet.name, ...item }))),
  };
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
  jsonStatus({ status: "ok", output: outputPath, sheet_count: sheets.length, preview_dir: previewDir });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
