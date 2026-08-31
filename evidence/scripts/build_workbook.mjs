#!/usr/bin/env node
/** Build an evidence workpaper with @oai/artifact-tool. */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";


const ROW_HEIGHT_PX = 20;
const LEFT_COLUMNS = 14;
const DIVIDER_COLUMN = 14;
const RIGHT_START_COLUMN = 15;
const RIGHT_COLUMNS = 24;
const TOTAL_COLUMNS = 39;
const STATUS_COLORS = {
  covered: { fill: "#E2F0D9", font: "#375623" },
  partial: { fill: "#FFF2CC", font: "#7F6000" },
  unresolved: { fill: "#FCE4D6", font: "#C00000" },
  pending: { fill: "#E7E6E6", font: "#595959" },
};
const DEFAULT_LABELS = {
  index_sheet: "Index",
  workbook_title: "Industry Research Evidence Workpaper",
  report_title: "Report title",
  report_date: "Report date",
  date_source: "Date source",
  input_file: "Input file",
  input_hash: "Input SHA-256",
  block_id: "Block ID",
  sheet_name: "Evidence sheet",
  pages: "Report pages",
  block_type: "Block type",
  topic_claims: "Topic and claims",
  evidence_count: "Evidence count",
  coverage: "Coverage",
  open: "Open",
  open_sheet: "Open sheet",
  original_report: "Original report block",
  supporting_evidence: "Supporting evidence",
  unresolved_evidence: "Unresolved evidence",
  no_evidence_reason: "No eligible evidence or unresolved record was provided.",
  claims: "Claims",
  source: "Source",
  note: "Evidence note",
};


function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  if (!args.manifest || !args.output) {
    throw new Error(
      "Usage: build_workbook.mjs --manifest <evidence.json> --output <workbook.xlsx> [--preview-dir <directory>]",
    );
  }
  return args;
}


async function loadPackage(packageName) {
  const moduleDirectory = process.env.CODEX_NODE_MODULES;
  if (!moduleDirectory) {
    throw new Error("CODEX_NODE_MODULES must point to the loader-provided Node module directory.");
  }
  const packageAnchor = path.join(path.resolve(moduleDirectory), "package.json");
  const requireFromBundle = createRequire(pathToFileURL(packageAnchor));
  const entry = requireFromBundle.resolve(packageName);
  return import(pathToFileURL(entry).href);
}


function mergeLabels(value) {
  const labels = { ...DEFAULT_LABELS };
  if (value && typeof value === "object") {
    for (const [key, label] of Object.entries(value)) {
      if (typeof label === "string" && label.trim()) {
        labels[key] = label;
      }
    }
  }
  return labels;
}


function sanitizeSheetName(rawName, fallback, used) {
  let base = String(rawName || fallback || "Block")
    .replace(/[\[\]:*?/\\]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  if (!base) {
    base = String(fallback || "Block").slice(0, 31);
  }
  let candidate = base;
  let suffixNumber = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${suffixNumber}`;
    candidate = `${base.slice(0, 31 - suffix.length).trim()}${suffix}`;
    suffixNumber += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}


function excelString(value) {
  return String(value ?? "").replace(/"/g, '""');
}


function hyperlinkFormula(target, display) {
  return `=HYPERLINK("${excelString(target)}","${excelString(display)}")`;
}


function sheetTargetFormula(sheetName, display) {
  const quotedSheet = String(sheetName).replace(/'/g, "''");
  return hyperlinkFormula(`#'${quotedSheet}'!A1`, display);
}


function statusStyle(status) {
  return STATUS_COLORS[String(status || "pending")] || STATUS_COLORS.pending;
}


function pageLabel(pages) {
  return Array.isArray(pages) ? pages.join(", ") : String(pages || "");
}


function claimSummary(block) {
  const claims = Array.isArray(block.claims) ? block.claims : [];
  const text = claims.slice(0, 4).map((claim) => `${claim.id}: ${claim.text}`).join(" | ");
  return [block.topic, text].filter(Boolean).join(" - ");
}


function mimeTypeForImage(imagePath) {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  return "image/png";
}


async function loadImage(imagePath, sharp) {
  const resolved = path.resolve(imagePath);
  const bytes = await fs.readFile(resolved);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Image dimensions are unavailable: ${resolved}`);
  }
  return {
    path: resolved,
    dataUrl: `data:${mimeTypeForImage(resolved)};base64,${bytes.toString("base64")}`,
    width: metadata.width,
    height: metadata.height,
  };
}


function fitDimensions(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}


async function addImage(sheet, imagePath, rowIndex, columnIndex, maxWidth, maxHeight, sharp) {
  const image = await loadImage(imagePath, sharp);
  const size = fitDimensions(image.width, image.height, maxWidth, maxHeight);
  sheet.images.add({
    dataUrl: image.dataUrl,
    anchor: {
      from: { row: rowIndex, col: columnIndex, rowOffsetPx: 2, colOffsetPx: 2 },
      extent: { widthPx: size.width, heightPx: size.height },
    },
  });
  return Math.ceil((size.height + 10) / ROW_HEIGHT_PX);
}


function styleMergedLabel(range, fill, fontColor, fontSize = 10) {
  range.format = {
    fill,
    font: { bold: true, color: fontColor, size: fontSize },
    verticalAlignment: "center",
    horizontalAlignment: "left",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#D9D9D9" },
  };
}


function setMergedValue(sheet, row, column, rowCount, columnCount, value, format = null, formula = false) {
  const range = sheet.getRangeByIndexes(row, column, rowCount, columnCount);
  range.merge();
  if (formula) {
    range.formulas = [[value]];
  } else {
    range.values = [[value]];
  }
  if (format) {
    range.format = format;
  }
  return range;
}


function unresolvedText(block, labels) {
  const unresolved = Array.isArray(block.unresolved) ? block.unresolved : [];
  if (!unresolved.length) {
    return labels.no_evidence_reason;
  }
  return unresolved
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      const claim = item.claim_id ? `${item.claim_id}: ` : "";
      const text = item.claim_text || item.text || "";
      const scope = item.search_scope ? ` Search scope: ${item.search_scope}.` : "";
      const reason = item.reason ? ` Reason: ${item.reason}` : "";
      return `${claim}${text}${scope}${reason}`.trim();
    })
    .join("\n\n");
}


async function populateEvidenceSheet(sheet, block, labels, sharp, deferredHyperlinks) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  const status = String(block.coverage_status || "pending");
  const statusColors = statusStyle(status);

  setMergedValue(
    sheet,
    0,
    0,
    1,
    LEFT_COLUMNS,
    `${block.id} | ${block.topic || block.type || "Block"} | Pages ${pageLabel(block.pages)}`,
    {
      fill: "#1F4E78",
      font: { bold: true, color: "#FFFFFF", size: 13 },
      verticalAlignment: "center",
      horizontalAlignment: "left",
      wrapText: true,
    },
  );
  setMergedValue(
    sheet,
    0,
    RIGHT_START_COLUMN,
    1,
    RIGHT_COLUMNS,
    `${labels.coverage}: ${status}`,
    {
      fill: statusColors.fill,
      font: { bold: true, color: statusColors.font, size: 12 },
      verticalAlignment: "center",
      horizontalAlignment: "left",
    },
  );
  const originalHeader = setMergedValue(sheet, 2, 0, 1, LEFT_COLUMNS, labels.original_report);
  styleMergedLabel(originalHeader, "#D9EAF7", "#1F1F1F", 11);
  const evidenceHeader = setMergedValue(sheet, 2, RIGHT_START_COLUMN, 1, RIGHT_COLUMNS, labels.supporting_evidence);
  styleMergedLabel(evidenceHeader, "#E2F0D9", "#1F1F1F", 11);

  let leftRow = 3;
  for (const imagePath of block.source_images || []) {
    const rows = await addImage(sheet, imagePath, leftRow, 0, 800, 1350, sharp);
    leftRow += rows + 1;
  }

  let rightRow = 3;
  for (const evidence of block.evidence || []) {
    const claimIds = Array.isArray(evidence.claim_ids) ? evidence.claim_ids.join(", ") : "";
    const headerText = [
      evidence.id,
      evidence.source_type,
      evidence.published_date,
      claimIds ? `${labels.claims}: ${claimIds}` : null,
    ].filter(Boolean).join(" | ");
    const header = setMergedValue(sheet, rightRow, RIGHT_START_COLUMN, 1, RIGHT_COLUMNS, headerText);
    styleMergedLabel(header, "#E7E6E6", "#1F1F1F", 10);
    rightRow += 1;

    const titleText = [evidence.publisher, evidence.title].filter(Boolean).join(" - ") || labels.source;
    setMergedValue(
      sheet,
      rightRow,
      RIGHT_START_COLUMN,
      1,
      RIGHT_COLUMNS,
      titleText,
      {
        fill: "#F8F8F8",
        font: { bold: true, color: "#333333", size: 10 },
        verticalAlignment: "center",
        horizontalAlignment: "left",
        wrapText: true,
      },
    );
    rightRow += 1;

    if (!evidence.url) {
      throw new Error(`Evidence ${evidence.id || "item"} in block ${block.id} has no URL.`);
    }
    const urlRange = setMergedValue(
      sheet,
      rightRow,
      RIGHT_START_COLUMN,
      1,
      RIGHT_COLUMNS,
      evidence.url,
      {
        fill: "#FFFFFF",
        font: { color: "#0563C1", underline: true, size: 9 },
        verticalAlignment: "center",
        horizontalAlignment: "left",
        wrapText: false,
      },
    );
    deferredHyperlinks.push({ range: urlRange, formula: hyperlinkFormula(evidence.url, evidence.url) });
    rightRow += 1;

    if (evidence.note) {
      setMergedValue(
        sheet,
        rightRow,
        RIGHT_START_COLUMN,
        2,
        RIGHT_COLUMNS,
        `${labels.note}: ${evidence.note}`,
        {
          fill: "#FFFDF2",
          font: { color: "#595959", italic: true, size: 9 },
          verticalAlignment: "center",
          horizontalAlignment: "left",
          wrapText: true,
          borders: { preset: "outside", style: "thin", color: "#E6E6E6" },
        },
      );
      rightRow += 2;
    }

    if (!evidence.screenshot_path) {
      throw new Error(`Evidence ${evidence.id || "item"} in block ${block.id} has no screenshot_path.`);
    }
    const rows = await addImage(sheet, evidence.screenshot_path, rightRow, RIGHT_START_COLUMN, 1240, 1450, sharp);
    rightRow += rows + 2;
  }

  const needsUnresolved = status === "unresolved" || status === "partial" || !(block.evidence || []).length;
  if (needsUnresolved) {
    const panelText = unresolvedText(block, labels);
    const unresolvedCount = Array.isArray(block.unresolved) ? block.unresolved.length : 0;
    const panelRows = Math.max(5, unresolvedCount * 3 + 2);
    setMergedValue(
      sheet,
      rightRow,
      RIGHT_START_COLUMN,
      panelRows,
      RIGHT_COLUMNS,
      `${labels.unresolved_evidence}\n\n${panelText}`,
      {
        fill: "#FCE4D6",
        font: { bold: true, color: "#C00000", size: 10 },
        verticalAlignment: "center",
        horizontalAlignment: "left",
        wrapText: true,
        borders: { preset: "outside", style: "medium", color: "#C00000" },
      },
    );
    rightRow += panelRows + 1;
  }

  const maxRows = Math.max(leftRow, rightRow, 12);
  sheet.getRangeByIndexes(0, 0, maxRows, TOTAL_COLUMNS).format.rowHeightPx = ROW_HEIGHT_PX;
  sheet.getRangeByIndexes(0, 0, maxRows, LEFT_COLUMNS).format.columnWidthPx = 64;
  sheet.getRangeByIndexes(0, DIVIDER_COLUMN, maxRows, 1).format = {
    fill: "#C00000",
    columnWidthPx: 14,
  };
  sheet.getRangeByIndexes(0, RIGHT_START_COLUMN, maxRows, RIGHT_COLUMNS).format.columnWidthPx = 54;
  return maxRows;
}


function populateIndexSheet(sheet, manifest, blocks, labels, deferredHyperlinks) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(7);
  const report = manifest.report || {};
  setMergedValue(
    sheet,
    0,
    0,
    1,
    8,
    labels.workbook_title,
    {
      fill: "#1F4E78",
      font: { bold: true, color: "#FFFFFF", size: 16 },
      verticalAlignment: "center",
      horizontalAlignment: "left",
    },
  );
  const metadata = [
    [labels.report_title, report.title || ""],
    [labels.report_date, report.report_date || ""],
    [
      labels.date_source,
      `${report.report_date_source || ""}${report.report_date_is_fallback ? " (fallback)" : ""}`,
    ],
    [labels.input_file, report.input_filename || ""],
    [labels.input_hash, report.sha256 || ""],
  ];
  metadata.forEach(([label, value], index) => {
    const row = index + 1;
    sheet.getRangeByIndexes(row, 0, 1, 1).values = [[label]];
    sheet.getRangeByIndexes(row, 0, 1, 1).format = {
      fill: "#D9EAF7",
      font: { bold: true, color: "#1F1F1F" },
      verticalAlignment: "center",
      horizontalAlignment: "left",
    };
    setMergedValue(
      sheet,
      row,
      1,
      1,
      7,
      value,
      {
        fill: "#FFFFFF",
        font: { color: "#333333" },
        verticalAlignment: "center",
        horizontalAlignment: "left",
        wrapText: true,
      },
    );
  });
  const headers = [
    labels.block_id,
    labels.sheet_name,
    labels.pages,
    labels.block_type,
    labels.topic_claims,
    labels.evidence_count,
    labels.coverage,
    labels.open,
  ];
  sheet.getRange("A7:H7").values = [headers];
  sheet.getRange("A7:H7").format = {
    fill: "#4472C4",
    font: { bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
    horizontalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2F3" },
  };

  blocks.forEach((block, index) => {
    const row = index + 8;
    sheet.getRangeByIndexes(row - 1, 0, 1, 7).values = [[
      block.id,
      block.sheet_name,
      pageLabel(block.pages),
      block.type,
      claimSummary(block),
      Array.isArray(block.evidence) ? block.evidence.length : 0,
      block.coverage_status || "pending",
    ]];
    const openRange = sheet.getRangeByIndexes(row - 1, 7, 1, 1);
    openRange.values = [[labels.open_sheet]];
    deferredHyperlinks.push({
      range: openRange,
      formula: sheetTargetFormula(block.sheet_name, labels.open_sheet),
    });
    const rowRange = sheet.getRangeByIndexes(row - 1, 0, 1, 8);
    rowRange.format = {
      fill: index % 2 === 0 ? "#FFFFFF" : "#F7F9FC",
      font: { color: "#333333" },
      verticalAlignment: "center",
      horizontalAlignment: "left",
      wrapText: true,
      borders: { preset: "all", style: "thin", color: "#E6E6E6" },
      rowHeightPx: 36 + Math.max(1, (block.claims || []).length) * 18,
    };
    const statusColors = statusStyle(block.coverage_status);
    sheet.getRangeByIndexes(row - 1, 6, 1, 1).format = {
      fill: statusColors.fill,
      font: { bold: true, color: statusColors.font },
      verticalAlignment: "center",
      horizontalAlignment: "center",
      borders: { preset: "all", style: "thin", color: "#E6E6E6" },
    };
    sheet.getRangeByIndexes(row - 1, 7, 1, 1).format = {
      fill: "#FFFFFF",
      font: { color: "#0563C1", underline: true },
      verticalAlignment: "center",
      horizontalAlignment: "center",
      borders: { preset: "all", style: "thin", color: "#E6E6E6" },
    };
  });

  const rowCount = Math.max(8 + blocks.length, 10);
  sheet.getRangeByIndexes(0, 0, rowCount, 1).format.columnWidthPx = 82;
  sheet.getRangeByIndexes(0, 1, rowCount, 1).format.columnWidthPx = 190;
  sheet.getRangeByIndexes(0, 2, rowCount, 1).format.columnWidthPx = 90;
  sheet.getRangeByIndexes(0, 3, rowCount, 1).format.columnWidthPx = 92;
  sheet.getRangeByIndexes(0, 4, rowCount, 1).format.columnWidthPx = 430;
  sheet.getRangeByIndexes(0, 5, rowCount, 1).format.columnWidthPx = 105;
  sheet.getRangeByIndexes(0, 6, rowCount, 1).format.columnWidthPx = 105;
  sheet.getRangeByIndexes(0, 7, rowCount, 1).format.columnWidthPx = 90;
  sheet.getRange("A1:H1").format.rowHeightPx = 34;
  sheet.getRange("A7:H7").format.rowHeightPx = 32;
  return rowCount;
}


async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const outputPath = path.resolve(args.output);
  const previewDir = args["preview-dir"] ? path.resolve(args["preview-dir"]) : null;
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.blocks) || !manifest.blocks.length) {
    throw new Error("The evidence manifest contains no blocks.");
  }
  const artifactModule = await loadPackage("@oai/artifact-tool");
  const artifactTool = artifactModule.default || artifactModule;
  const sharpModule = await loadPackage("sharp");
  const sharp = sharpModule.default || sharpModule;
  const { Workbook, SpreadsheetFile } = artifactTool;
  const labels = mergeLabels(manifest.labels);
  const workbook = Workbook.create();
  const usedSheetNames = new Set();
  const indexName = sanitizeSheetName(labels.index_sheet, "Index", usedSheetNames);
  const indexSheet = workbook.worksheets.add(indexName);
  const deferredHyperlinks = [];

  const blocks = manifest.blocks.map((rawBlock, index) => {
    const block = { ...rawBlock };
    const fallback = block.id || `B${String(index + 1).padStart(3, "0")}`;
    block.sheet_name = sanitizeSheetName(block.sheet_name, fallback, usedSheetNames);
    block._sheet = workbook.worksheets.add(block.sheet_name);
    return block;
  });

  for (const block of blocks) {
    await populateEvidenceSheet(block._sheet, block, labels, sharp, deferredHyperlinks);
  }
  const indexRows = populateIndexSheet(indexSheet, manifest, blocks, labels, deferredHyperlinks);

  const indexInspection = await workbook.inspect({
    kind: "table",
    range: `${indexName}!A1:H${Math.min(indexRows, 30)}`,
    include: "values,formulas",
    tableMaxRows: 30,
    tableMaxCols: 8,
    maxChars: 8000,
  });
  const previewFiles = [];
  if (previewDir) {
    await fs.mkdir(previewDir, { recursive: true });
    for (const sheet of workbook.worksheets.items) {
      const preview = await workbook.render({
        sheetName: sheet.name,
        autoCrop: "all",
        scale: 0.8,
        format: "png",
      });
      const previewPath = path.join(previewDir, `${safePreviewName(sheet.name)}.png`);
      await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
      previewFiles.push(previewPath);
    }
  }

  for (const hyperlink of deferredHyperlinks) {
    hyperlink.range.formulas = [[hyperlink.formula]];
  }
  const formulaErrors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 300 },
    summary: "final formula error scan",
    maxChars: 6000,
  });
  if (previewDir) {
    await fs.writeFile(
      path.join(previewDir, "verification.json"),
      JSON.stringify(
        {
          index_inspection: indexInspection.ndjson,
          formula_error_scan: formulaErrors.ndjson,
          preview_files: previewFiles,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  process.stdout.write(`${JSON.stringify({ status: "ok", output: outputPath, sheets: blocks.length + 1, previews: previewFiles.length })}\n`);
}


function safePreviewName(value) {
  return String(value || "sheet")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "sheet";
}


main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
