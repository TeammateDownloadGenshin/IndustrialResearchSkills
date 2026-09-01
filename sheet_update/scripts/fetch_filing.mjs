#!/usr/bin/env node
/** Download a public official filing through a normal browser session. */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseOptions, loadPackage, sha256File, jsonStatus } from "./_shared.mjs";

const ACCESS_MARKERS = ["captcha", "verify you are human", "access denied", "\u767b\u5f55", "\u9a8c\u8bc1\u7801", "\u8bbf\u95ee\u53d7\u9650"];

async function findBrowser(explicit) {
  const candidates = [
    explicit,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await fs.access(candidate); return candidate; } catch { /* Continue. */ }
  }
  return null;
}

function isPdf(bytes) {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

async function main() {
  const args = parseOptions(process.argv.slice(2), ["url", "output"]);
  const outputPath = path.resolve(args.output);
  const moduleValue = await loadPackage("playwright");
  const playwright = moduleValue.default || moduleValue;
  const executablePath = await findBrowser(args["browser-executable"]);
  const browser = await playwright.chromium.launch(executablePath ? { headless: true, executablePath } : { headless: true });
  const context = await browser.newContext({ locale: "zh-CN", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36" });
  let finalUrl = args.url;
  let bytes = null;
  let contentType = "";
  try {
    const page = await context.newPage();
    const response = await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
    if (response) {
      const body = await response.body().catch(() => null);
      contentType = response.headers()["content-type"] || "";
      finalUrl = response.url();
      if (body && isPdf(body)) bytes = body;
    }
    if (!bytes) {
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
      const text = (await page.locator("body").innerText({ timeout: 3000 }).catch(() => "")).toLowerCase();
      const marker = ACCESS_MARKERS.find((item) => text.includes(item));
      if (marker) throw new Error(`Access control encountered (${marker}); no bypass was attempted.`);
      const request = await context.request.get(page.url() || args.url, { timeout: 45000, failOnStatusCode: false });
      finalUrl = request.url();
      contentType = request.headers()["content-type"] || contentType;
      if (!request.ok()) throw new Error(`Official filing download returned HTTP ${request.status()}.`);
      bytes = await request.body();
    }
    if (!isPdf(bytes)) {
      throw new Error(`Downloaded content is not a PDF (content-type: ${contentType || "unknown"}).`);
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes);
  } finally {
    await context.close();
    await browser.close();
  }
  const metadataPath = `${outputPath}.json`;
  const metadata = { schema_version: "1.0", source_url: args.url, final_url: finalUrl, content_type: contentType, output: outputPath, sha256: await sha256File(outputPath), downloaded_at: new Date().toISOString() };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  jsonStatus({ status: "ok", output: outputPath, metadata: metadataPath, sha256: metadata.sha256 });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
