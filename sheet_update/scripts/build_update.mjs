#!/usr/bin/env node
/** Apply an official-filing update manifest to an existing XLSX workpaper. */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseOptions, loadPackage, safeName, sha256File, hyperlinkFormula, jsonStatus } from "./_shared.mjs";

const OFFICIAL_TYPES = new Set(["exchange", "cninfo", "company_periodic_report", "company_ir"]);
const ROW_HEIGHT_PX = 20;

function byId(items, label) {
  const result = new Map();
  for (const item of items || []) {
    if (!item.id) throw new Error(`${label} item is missing an id.`);
    if (result.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    result.set(item.id, item);
  }
  return result;
}

function relativePath(baseDirectory, value) {
  return path.isAbsolute(value) ? value : path.resolve(baseDirectory, value);
}

function maxDrawingBottom(sheet) {
  let bottom = 0;
  for (const item of [...(sheet.charts?.items || []), ...(sheet.images?.items || []), ...(sheet.shapes?.items || [])]) {
    const anchor = item.anchor || {};
    const from = Number(anchor.from?.row ?? 0);
    const to = Number(anchor.to?.row ?? from);
    const extentRows = Math.ceil(Number(anchor.extent?.heightPx ?? 0) / ROW_HEIGHT_PX);
    bottom = Math.max(bottom, to + 1, from + extentRows + 1);
  }
  return bottom;
}

function usedBottom(sheet) {
  const address = sheet.getUsedRange()?.address || "A1";
  const tail = address.split("!").pop().replace(/\$/g, "").split(":").pop();
  const match = /([0-9]+)$/.exec(tail);
  return match ? Number(match[1]) : 1;
}

function setMerged(sheet, row, startCol, colCount, rowCount, value, format, isFormula = false) {
  const range = sheet.getRangeByIndexes(row, startCol, rowCount, colCount);
  range.merge();
  if (isFormula) range.formulas = [[value]];
  else range.values = [[value]];
  if (format) range.format = format;
  return range;
}

async function loadImage(filePath, sharp) {
  const bytes = await fs.readFile(filePath);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Image dimensions are unavailable: ${filePath}`);
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
  return { dataUrl: `data:${mime};base64,${bytes.toString("base64")}`, width: metadata.width, height: metadata.height };
}

async function addEvidenceCard(sheet, row, evidenceItem, filing, supportedCells, screenshotPath, sharp, deferredHyperlinks) {
  const header = [evidenceItem.id, filing.title, filing.published_date, `PDF page ${evidenceItem.pdf_page}`, `Supported cells: ${supportedCells.join(", ")}`].filter(Boolean).join(" | ");
  setMerged(sheet, row, 0, 16, 2, header, {
    fill: "#E7E6E6",
    font: { bold: true, color: "#1F1F1F", size: 10 },
    verticalAlignment: "center",
    horizontalAlignment: "left",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#A6A6A6" },
  });
  row += 2;
  const linkRange = setMerged(sheet, row, 0, 16, 1, filing.url, {
    fill: "#FFFFFF",
    font: { color: "#0563C1", underline: true, size: 9 },
    verticalAlignment: "center",
    horizontalAlignment: "left",
    wrapText: false,
  });
  deferredHyperlinks.push({ range: linkRange, formula: hyperlinkFormula(filing.url) });
  row += 1;
  const image = await loadImage(screenshotPath, sharp);
  const scale = Math.min(1400 / image.width, 1800 / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  sheet.images.add({ dataUrl: image.dataUrl, anchor: { from: { row, col: 0, rowOffsetPx: 2, colOffsetPx: 2 }, extent: { widthPx: width, heightPx: height } } });
  return row + Math.ceil((height + 12) / ROW_HEIGHT_PX) + 2;
}

function addUnresolvedPanel(sheet, row, item) {
  const text = [`Unresolved: ${item.metric || "Unknown metric"}`, `Cells: ${(item.cells || []).join(", ") || "not mapped"}`, `Search scope: ${item.search_scope || "not recorded"}`, `Reason: ${item.reason || "not recorded"}`].join("\n");
  setMerged(sheet, row, 0, 16, 6, text, {
    fill: "#FCE4D6",
    font: { bold: true, color: "#C00000", size: 10 },
    verticalAlignment: "center",
    horizontalAlignment: "left",
    wrapText: true,
    borders: { preset: "outside", style: "medium", color: "#C00000" },
  });
  return row + 7;
}

async function main() {
  const args = parseOptions(process.argv.slice(2), ["input", "manifest", "output", "preview-dir"]);
  const inputPath = path.resolve(args.input);
  const manifestPath = path.resolve(args.manifest);
  const outputPath = path.resolve(args.output);
  const previewDir = path.resolve(args["preview-dir"]);
  const manifestDir = path.dirname(manifestPath);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!/^(?:19|20)\d{2}(?:Q1|H1|Q3|FY)$/.test(String(manifest.requested_period || ""))) {
    throw new Error("requested_period must match YYYYQ1, YYYYH1, YYYYQ3, or YYYYFY.");
  }
  if (outputPath.toLowerCase() === inputPath.toLowerCase()) throw new Error("The output workbook must not overwrite the input workbook.");
  const requiredSuffix = `-updated-${manifest.requested_period}.xlsx`.toLowerCase();
  if (!path.basename(outputPath).toLowerCase().endsWith(requiredSuffix)) {
    throw new Error(`The output filename must end with ${requiredSuffix}.`);
  }
  const expectedHash = manifest.input_workbook?.sha256;
  const actualHash = await sha256File(inputPath);
  if (expectedHash && expectedHash.toLowerCase() !== actualHash.toLowerCase()) throw new Error("Input workbook SHA-256 does not match the manifest.");
  const filings = byId(manifest.source_filings, "source filing");
  for (const filing of filings.values()) {
    if (!OFFICIAL_TYPES.has(filing.source_type)) throw new Error(`Ineligible source type for ${filing.id}: ${filing.source_type}`);
    if (!filing.url) throw new Error(`Source filing ${filing.id} has no URL.`);
  }
  const rawValues = byId(manifest.raw_values, "raw value");
  const evidence = byId(manifest.evidence, "evidence");
  const updates = manifest.updates || [];
  const updateIds = new Set(updates.map((item) => item.id));
  for (const item of updates) {
    if (!item.id || !item.sheet || !item.cell || !["reported_value", "formula", "label"].includes(item.kind)) throw new Error("Each update requires id, sheet, cell, and a valid kind.");
    if (item.kind === "reported_value") {
      if (!Number.isFinite(item.value)) throw new Error(`Reported update ${item.id} must contain a numeric value.`);
      if (!item.raw_value_id || !rawValues.has(item.raw_value_id)) throw new Error(`Reported update ${item.id} has no valid raw_value_id.`);
      if (!Array.isArray(item.evidence_ids) || !item.evidence_ids.length) throw new Error(`Reported update ${item.id} requires evidence_ids.`);
    }
  }
  for (const item of evidence.values()) {
    if (!filings.has(item.filing_id)) throw new Error(`Evidence ${item.id} has no valid filing_id.`);
    if (!Number.isInteger(Number(item.pdf_page)) || Number(item.pdf_page) < 1) throw new Error(`Evidence ${item.id} requires a positive pdf_page.`);
    if (!item.screenshot_path) throw new Error(`Evidence ${item.id} has no screenshot_path.`);
    for (const id of item.supported_update_ids || []) if (!updateIds.has(id)) throw new Error(`Evidence ${item.id} references unknown update ${id}.`);
  }

  const artifactModule = await loadPackage("@oai/artifact-tool");
  const artifactTool = artifactModule.default || artifactModule;
  const sharpModule = await loadPackage("sharp");
  const sharp = sharpModule.default || sharpModule;
  const { FileBlob, SpreadsheetFile } = artifactTool;
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
  workbook.comments.setSelf({ displayName: "User" });
  const sheetNames = new Set(workbook.worksheets.items.map((sheet) => sheet.name));
  const changedSheets = new Set();

  for (const item of manifest.copy_ranges || []) {
    if (!sheetNames.has(item.sheet)) throw new Error(`Copy range references missing sheet: ${item.sheet}`);
    const sheet = workbook.worksheets.getItem(item.sheet);
    sheet.getRange(item.destination).copyFrom(sheet.getRange(item.source), item.copy_type || "all");
    changedSheets.add(item.sheet);
  }

  for (const item of updates) {
    if (!sheetNames.has(item.sheet)) throw new Error(`Update references missing sheet: ${item.sheet}`);
    const sheet = workbook.worksheets.getItem(item.sheet);
    const cell = sheet.getRange(item.cell);
    if (item.copy_from) cell.copyFrom(sheet.getRange(item.copy_from), "all");
    if (item.kind === "formula") {
      if (!String(item.formula || "").startsWith("=")) throw new Error(`Formula update ${item.id} must start with '='.`);
      cell.formulas = [[item.formula]];
    } else {
      cell.values = [[item.value]];
    }
    if (item.number_format) cell.format.numberFormat = item.number_format;
    if (item.kind === "reported_value") {
      const raw = rawValues.get(item.raw_value_id);
      const filing = filings.get(raw.filing_id);
      const comment = [`Source ID: ${filing.id}`, `Report: ${filing.title}`, `URL: ${filing.url}`, `PDF page: ${raw.pdf_page}`, `Source value: ${raw.value} ${raw.source_unit}`, `Target unit: ${raw.target_unit}`, `Conversion factor: ${raw.conversion_factor}`].join("\n");
      workbook.comments.addThread({ cell }, comment);
    }
    changedSheets.add(item.sheet);
  }

  for (const item of manifest.chart_updates || []) {
    if (!sheetNames.has(item.sheet)) throw new Error(`Chart update references missing sheet: ${item.sheet}`);
    const sheet = workbook.worksheets.getItem(item.sheet);
    const chart = sheet.charts.items[Number(item.chart_index)];
    if (!chart) throw new Error(`Chart index ${item.chart_index} is unavailable on ${item.sheet}.`);
    if (item.data_range) chart.setData(sheet.getRange(item.data_range));
    else {
      const series = chart.series.items[Number(item.series_index)];
      if (!series) throw new Error(`Series index ${item.series_index} is unavailable on chart ${item.chart_index} in ${item.sheet}.`);
      if (item.category_formula) series.categoryFormula = String(item.category_formula).replace(/^=/, "");
      if (item.formula) series.formula = String(item.formula).replace(/^=/, "");
    }
    changedSheets.add(item.sheet);
  }

  const deferredHyperlinks = [];
  const evidenceBySheet = new Map();
  for (const update of updates) {
    for (const evidenceId of update.evidence_ids || []) {
      if (!evidence.has(evidenceId)) throw new Error(`Update ${update.id} references unknown evidence ${evidenceId}.`);
      if (!evidenceBySheet.has(update.sheet)) evidenceBySheet.set(update.sheet, new Map());
      const entries = evidenceBySheet.get(update.sheet);
      if (!entries.has(evidenceId)) entries.set(evidenceId, []);
      entries.get(evidenceId).push(update.cell);
    }
  }
  const unresolvedBySheet = new Map();
  for (const item of manifest.unresolved || []) {
    if (!unresolvedBySheet.has(item.sheet)) unresolvedBySheet.set(item.sheet, []);
    unresolvedBySheet.get(item.sheet).push(item);
    changedSheets.add(item.sheet);
  }

  for (const sheetName of new Set([...evidenceBySheet.keys(), ...unresolvedBySheet.keys()])) {
    if (!sheetNames.has(sheetName)) throw new Error(`Evidence placement references missing sheet: ${sheetName}`);
    const sheet = workbook.worksheets.getItem(sheetName);
    let row = Math.max(usedBottom(sheet), maxDrawingBottom(sheet)) + 2;
    for (const [evidenceId, supportedCells] of evidenceBySheet.get(sheetName) || []) {
      const evidenceItem = evidence.get(evidenceId);
      const filing = filings.get(evidenceItem.filing_id);
      const screenshotPath = relativePath(manifestDir, evidenceItem.screenshot_path);
      row = await addEvidenceCard(sheet, row, evidenceItem, filing, [...new Set(supportedCells)], screenshotPath, sharp, deferredHyperlinks);
    }
    for (const unresolved of unresolvedBySheet.get(sheetName) || []) row = addUnresolvedPanel(sheet, row, unresolved);
  }

  await fs.mkdir(previewDir, { recursive: true });
  const previewFiles = [];
  for (const sheetName of changedSheets) {
    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 0.8, format: "png" });
    const previewPath = path.join(previewDir, `${safeName(sheetName)}.png`);
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
    previewFiles.push(previewPath);
  }
  const errorScan = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!", options: { useRegex: true, maxResults: 500 }, summary: "post-update formula error scan", maxChars: 12000 });
  for (const item of deferredHyperlinks) item.range.formulas = [[item.formula]];
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const exported = await SpreadsheetFile.exportXlsx(workbook);
  await exported.save(outputPath);
  const auditPath = `${outputPath}.audit.json`;
  await fs.writeFile(auditPath, JSON.stringify({ schema_version: "1.0", requested_period: manifest.requested_period, changed_sheets: [...changedSheets], preview_files: previewFiles, formula_error_scan: errorScan.ndjson, output_sha256: await sha256File(outputPath) }, null, 2), "utf8");
  jsonStatus({ status: "ok", output: outputPath, audit: auditPath, changed_sheets: [...changedSheets], preview_dir: previewDir });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
