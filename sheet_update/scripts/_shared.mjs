import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export function parseOptions(argv, required = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  for (const key of required) {
    if (!options[key]) throw new Error(`Missing required option --${key}.`);
  }
  return options;
}

export async function loadPackage(packageName) {
  const moduleDirectory = process.env.CODEX_NODE_MODULES;
  if (!moduleDirectory) {
    throw new Error("CODEX_NODE_MODULES must point to the loader-provided Node module directory.");
  }
  const anchor = path.join(path.resolve(moduleDirectory), "package.json");
  const requireFromBundle = createRequire(pathToFileURL(anchor));
  return import(pathToFileURL(requireFromBundle.resolve(packageName)).href);
}

export async function sha256File(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function safeName(value) {
  return String(value || "item").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim();
}

export function jsonStatus(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function excelString(value) {
  return String(value ?? "").replace(/"/g, '""');
}

export function hyperlinkFormula(url) {
  return `=HYPERLINK("${excelString(url)}","${excelString(url)}")`;
}
