#!/usr/bin/env node
/** Render and highlight local official filing PDF regions. */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { parseOptions, loadPackage, safeName, jsonStatus } from "./_shared.mjs";

function run(command, args, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Command timed out: ${command}`)); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function normalizedBox(raw, width, height, label) {
  const x = Math.max(0, Math.floor(Number(raw?.x ?? 0)));
  const y = Math.max(0, Math.floor(Number(raw?.y ?? 0)));
  const right = Math.min(width, x + Math.floor(Number(raw?.width ?? width)));
  const bottom = Math.min(height, y + Math.floor(Number(raw?.height ?? height)));
  if (right <= x || bottom <= y) throw new Error(`${label} is outside the rendered page.`);
  return { left: x, top: y, width: right - x, height: bottom - y };
}

async function capture(item, outputDir, sharp, pdftoppm) {
  const pdfPath = path.resolve(item.pdf_path || "");
  const pageNumber = Number(item.page_number);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("page_number must be a positive integer.");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sheet-update-capture-"));
  try {
    const prefix = path.join(tempDir, "page");
    await run(pdftoppm, ["-f", String(pageNumber), "-l", String(pageNumber), "-singlefile", "-r", "200", "-png", pdfPath, prefix]);
    const renderedPath = `${prefix}.png`;
    const metadata = await sharp(renderedPath).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Rendered page dimensions are unavailable.");
    const crop = normalizedBox(item.crop || {}, metadata.width, metadata.height, "Crop");
    const highlights = (item.highlights || []).map((value) => normalizedBox(value, metadata.width, metadata.height, "Highlight"))
      .map((value) => ({
        left: Math.max(0, value.left - crop.left),
        top: Math.max(0, value.top - crop.top),
        width: Math.min(crop.width, value.left + value.width - crop.left) - Math.max(0, value.left - crop.left),
        height: Math.min(crop.height, value.top + value.height - crop.top) - Math.max(0, value.top - crop.top),
      })).filter((value) => value.width > 0 && value.height > 0);
    if ((item.highlights || []).length && !highlights.length) throw new Error("No highlight intersects the crop.");
    let pipeline = sharp(renderedPath).extract(crop);
    if (highlights.length) {
      const rectangles = highlights.map((box) => `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="#FFF2A8" fill-opacity="0.38" stroke="#D71920" stroke-width="5"/>`).join("");
      const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${crop.width}" height="${crop.height}">${rectangles}</svg>`);
      pipeline = pipeline.composite([{ input: overlay, left: 0, top: 0 }]);
    }
    const outputPath = path.join(outputDir, `${safeName(item.id)}.png`);
    await pipeline.resize({ width: 1800, height: 2200, fit: "inside", withoutEnlargement: true }).png().toFile(outputPath);
    return { id: item.id, filing_id: item.filing_id, status: "captured", pdf_path: pdfPath, page_number: pageNumber, screenshot_path: outputPath, crop, highlight_count: highlights.length, supported_update_ids: item.supported_update_ids || [] };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseOptions(process.argv.slice(2), ["plan", "output-dir"]);
  const plan = JSON.parse(await fs.readFile(path.resolve(args.plan), "utf8"));
  if (!Array.isArray(plan.items)) throw new Error("Capture plan items must be an array.");
  const outputDir = path.resolve(args["output-dir"]);
  await fs.mkdir(outputDir, { recursive: true });
  const sharpModule = await loadPackage("sharp");
  const sharp = sharpModule.default || sharpModule;
  const pdftoppm = args.pdftoppm || process.env.PDFTOPPM_PATH || "pdftoppm";
  const results = [];
  for (const item of plan.items) {
    try { results.push(await capture(item, outputDir, sharp, pdftoppm)); }
    catch (error) { results.push({ id: item.id, filing_id: item.filing_id, status: "capture_error", error: error instanceof Error ? error.message : String(error), screenshot_path: null }); }
  }
  const output = path.join(outputDir, "capture-results.json");
  await fs.writeFile(output, JSON.stringify({ schema_version: "1.0", results }, null, 2), "utf8");
  jsonStatus({ status: "ok", output, item_count: results.length, captured: results.filter((item) => item.status === "captured").length });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
