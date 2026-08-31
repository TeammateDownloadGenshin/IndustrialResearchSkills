#!/usr/bin/env node
/** Run a local browser smoke test for robust evidence-region capture. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";


const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.resolve(testDirectory, "..");
const fixturePath = path.join(testDirectory, "fixtures", "capture-web.html");
const captureScript = path.join(skillDirectory, "scripts", "capture_web.mjs");


function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Process exited with code ${code}`));
      }
    });
  });
}


async function main() {
  assert.ok(process.env.CODEX_NODE_MODULES, "CODEX_NODE_MODULES is required.");
  const fixture = await fs.readFile(fixturePath);
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/fixture`;
  const workDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "evidence-capture-smoke-"));
  const outputDirectory = path.join(workDirectory, "captures");
  const planPath = path.join(workDirectory, "capture-plan.json");
  const common = {
    url: baseUrl,
    kind: "html",
    source_type: "company_website",
    publisher: "Local Fixture",
    published_date: "2026-01-01",
    context_padding: 60,
  };
  const plan = {
    schema_version: "1.0",
    report_date: "2026-08-31",
    items: [
      { ...common, id: "E001", block_id: "B001", claim_ids: ["C001"], title: "Long page", quotes: ["Target passage at the end of a very long page."] },
      { ...common, id: "E002", block_id: "B001", claim_ids: ["C002"], title: "Unicode split text", quotes: ["\u8de8\u8282\u70b9\u4e2d\u6587\u8bc1\u636e\u6587\u672c\u53ef\u4ee5\u7a33\u5b9a\u5339\u914d\u3002"] },
      { ...common, id: "E003", block_id: "B001", claim_ids: ["C003"], title: "Table row", quotes: ["Confirmed enrollment 4,600 participants"] },
      { ...common, id: "E004", block_id: "B001", claim_ids: ["C004"], title: "Company Announces Phase III Trial Meets All Endpoints", quotes: ["A deliberately missing quotation"] },
      { ...common, id: "E005", block_id: "B001", claim_ids: ["C005"], title: "Weight-loss result", quotes: ["An alternate-language result reached 7.7%"] },
    ],
  };
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), "utf8");
  const args = [captureScript, "--plan", planPath, "--output-dir", outputDirectory];
  if (process.env.PLAYWRIGHT_BROWSER_PATH) {
    args.push("--browser-executable", process.env.PLAYWRIGHT_BROWSER_PATH);
  }
  try {
    await run(process.execPath, args, { env: process.env });
    const payload = JSON.parse(await fs.readFile(path.join(outputDirectory, "capture-results.json"), "utf8"));
    assert.equal(payload.results.length, 5);
    for (const result of payload.results) {
      assert.equal(result.status, "captured", `${result.id}: ${result.error || result.status}`);
      assert.ok(result.screenshot_path);
      assert.ok(result.dismissed_consent_count >= 1);
      assert.ok(result.match_methods.length >= 1);
    }
    assert.ok(payload.results.find((result) => result.id === "E004").match_methods.includes("item_title_context_fallback"));
    assert.ok(payload.results.find((result) => result.id === "E004").support_warning);
    assert.ok(payload.results.find((result) => result.id === "E005").match_methods.includes("distinctive_token_fallback"));
    process.stdout.write(`${JSON.stringify({ status: "ok", captures: payload.results.length, output: outputDirectory })}\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}


main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
