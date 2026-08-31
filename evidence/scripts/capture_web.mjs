#!/usr/bin/env node
/** Capture public HTML passages or public PDF pages for evidence cards. */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";


const PROHIBITED_SOURCE_TYPES = new Set([
  "broker_research",
  "sell_side",
  "securities_research",
  "investment_bank_research",
]);
const ACCESS_MARKERS = [
  "access denied",
  "verify you are human",
  "captcha",
  "login required",
  "sign in to continue",
  "subscription required",
  "enable cookies",
];


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
  if (!args.plan || !args["output-dir"]) {
    throw new Error("Usage: capture_web.mjs --plan <capture-plan.json> --output-dir <directory> [--pdftoppm <path>]");
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


function parseIsoDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return null;
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}


function safeIdentifier(value) {
  return String(value || "evidence")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "evidence";
}


async function findBrowserExecutable(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.PLAYWRIGHT_BROWSER_PATH,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe") : null,
    process.env["PROGRAMFILES(X86)"]
      ? path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe")
      : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (await fs.access(resolved).then(() => true).catch(() => false)) {
      return resolved;
    }
  }
  return null;
}


function validateCutoff(item, reportDate) {
  if (PROHIBITED_SOURCE_TYPES.has(String(item.source_type || ""))) {
    return { status: "rejected_prohibited_source", error: "The source type is prohibited by the evidence policy." };
  }
  const cutoff = parseIsoDate(reportDate);
  if (!cutoff) {
    return { status: "error", error: "The capture plan requires a valid report_date." };
  }
  const published = parseIsoDate(item.published_date);
  if (!published && !item.cutoff_verified) {
    return {
      status: "rejected_missing_publication_date",
      error: "The source has no reliable publication date and cutoff_verified is not true.",
    };
  }
  if (published && published > cutoff) {
    return { status: "rejected_post_cutoff", error: "The source publication date is after the report date." };
  }
  return null;
}


function runProcess(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Process timed out: ${command}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Process failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`));
      }
    });
  });
}


async function resizePng(sharp, input, outputPath, maxEdge = 1600) {
  const image = sharp(input, { failOn: "error" });
  const metadata = await image.metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const longest = Math.max(width, height);
  const pipeline = longest > maxEdge
    ? image.resize({
        width: width >= height ? maxEdge : undefined,
        height: height > width ? maxEdge : undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
    : image;
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outputPath);
}


async function firstVisibleLocator(page, locator) {
  const count = Math.min(await locator.count(), 12);
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}


async function expandSemanticTarget(locator) {
  const tagName = await locator.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
  if (tagName === "td" || tagName === "th") {
    const row = locator.locator("xpath=ancestor::tr[1]");
    if (await row.isVisible().catch(() => false)) {
      return row;
    }
  }
  return locator;
}


async function dismissConsentBanners(page) {
  const selectors = [
    "#onetrust-reject-all-handler",
    "#onetrust-accept-btn-handler",
    ".cky-btn-reject",
    ".cky-btn-accept",
    "button:has-text('Reject all')",
    "button:has-text('Only necessary')",
    "button:has-text('Accept all')",
    "button:has-text('\u62d2\u7edd\u5168\u90e8')",
    "button:has-text('\u4ec5\u5fc5\u8981')",
    "button:has-text('\u63a5\u53d7\u5168\u90e8')",
    "button:has-text('\u540c\u610f\u5168\u90e8')",
  ];
  let dismissed = 0;
  for (const selector of selectors) {
    const candidate = await firstVisibleLocator(page, page.locator(selector));
    if (!candidate) {
      continue;
    }
    const contextText = await candidate.evaluate((element) => {
      const container = element.closest(
        "[role='dialog'],[aria-modal='true'],[class*='cookie' i],[id*='cookie' i],[class*='consent' i],[id*='consent' i]",
      );
      return (container?.innerText || element.innerText || "").toLowerCase();
    }).catch(() => "");
    if (!/(cookie|consent|privacy|cookies|\u9690\u79c1|\u540c\u610f)/i.test(contextText) && !selector.startsWith("#onetrust")) {
      continue;
    }
    if (await candidate.click({ timeout: 2500 }).then(() => true).catch(() => false)) {
      dismissed += 1;
      await page.waitForTimeout(250);
      break;
    }
  }
  return dismissed;
}


async function locateNormalizedQuote(page, quote, quoteIndex) {
  const token = `q${quoteIndex}-${Date.now()}`;
  const matched = await page.evaluate(({ quoteValue, matchToken }) => {
    const normalize = (value) => String(value || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const compact = (value) => normalize(value).replace(/[^\p{L}\p{N}]+/gu, "");
    const normalizedQuote = normalize(quoteValue);
    const compactQuote = compact(quoteValue);
    if (!normalizedQuote) {
      return false;
    }
    const selectors = "p,li,tr,td,th,h1,h2,h3,h4,h5,h6,blockquote,figcaption,div,span";
    const candidates = [];
    for (const element of document.querySelectorAll(selectors)) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        continue;
      }
      const text = normalize(element.innerText || element.textContent || "");
      if (!text) {
        continue;
      }
      const directMatch = text.includes(normalizedQuote);
      const compactMatch = compactQuote.length >= 8 && compact(text).includes(compactQuote);
      if (directMatch || compactMatch) {
        candidates.push({ element, textLength: text.length, area: rect.width * rect.height });
      }
    }
    candidates.sort((left, right) => left.textLength - right.textLength || left.area - right.area);
    const winner = candidates[0]?.element;
    if (!winner) {
      return false;
    }
    winner.setAttribute("data-codex-quote-match", matchToken);
    return true;
  }, { quoteValue: quote, matchToken: token });
  if (!matched) {
    return null;
  }
  return firstVisibleLocator(page, page.locator(`[data-codex-quote-match="${token}"]`));
}


async function locateDistinctiveTokens(page, quote, quoteIndex) {
  const tokens = String(quote).match(/[A-Za-z]{2,}[-_]?[A-Za-z]*\d+[A-Za-z0-9_-]*|\d+(?:\.\d+)?%/g) || [];
  const normalizedTokens = [...new Set(tokens.map((value) => value.toLowerCase()))];
  if (!normalizedTokens.length) {
    return null;
  }
  const token = `t${quoteIndex}-${Date.now()}`;
  const matched = await page.evaluate(({ requiredTokens, matchToken }) => {
    const selectors = "p,li,tr,td,th,h1,h2,h3,h4,h5,h6,blockquote,figcaption,div,span";
    const candidates = [];
    for (const element of document.querySelectorAll(selectors)) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const text = String(element.innerText || element.textContent || "").normalize("NFKC").toLowerCase();
      if (requiredTokens.every((value) => text.includes(value))) {
        candidates.push({ element, textLength: text.length, area: rect.width * rect.height });
      }
    }
    candidates.sort((left, right) => left.textLength - right.textLength || left.area - right.area);
    const winner = candidates[0]?.element;
    if (!winner) {
      return false;
    }
    winner.setAttribute("data-codex-token-match", matchToken);
    return true;
  }, { requiredTokens: normalizedTokens, matchToken: token });
  return matched
    ? firstVisibleLocator(page, page.locator(`[data-codex-token-match="${token}"]`))
    : null;
}


function titleIsSpecificEnough(title) {
  return /(met all|initiates?|announces?|approv(?:al|ed)|phase\s+[i1-4v]+|topline|results?|collaboration|asco|esmo|obesityweek|fda)/i.test(
    String(title || ""),
  );
}


async function locateTitleAnchors(page, title) {
  const value = String(title || "");
  const anchors = [
    ...(value.match(/[A-Z]{2,}\d+[A-Z0-9-]*/g) || []),
    ...(value.match(/\b(?:19|20)\d{2}\b/g) || []),
    ...(value.match(/\b(?:ASCO|ESMO|WCLC|ADA|ObesityWeek)\b/gi) || []),
    ...(value.match(/phase\s+(?:[ivx]+|[1-4])/gi) || []),
    ...(value.match(/initiat|endpoint|collaborat|approv|profit/gi) || []),
  ].map((item) => item.toLowerCase());
  const required = [...new Set(anchors)];
  if (required.length < 2) {
    return null;
  }
  const token = `title-${Date.now()}`;
  const matched = await page.evaluate(({ requiredAnchors, matchToken }) => {
    const selectors = "p,li,tr,td,th,h1,h2,h3,h4,h5,h6,blockquote,figcaption,div,span";
    const candidates = [];
    for (const element of document.querySelectorAll(selectors)) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const text = String(element.innerText || element.textContent || "").normalize("NFKC").toLowerCase();
      if (requiredAnchors.every((anchor) => text.includes(anchor))) {
        candidates.push({ element, textLength: text.length, area: rect.width * rect.height });
      }
    }
    candidates.sort((left, right) => left.textLength - right.textLength || left.area - right.area);
    const winner = candidates[0]?.element;
    if (!winner) {
      return false;
    }
    winner.setAttribute("data-codex-title-match", matchToken);
    return true;
  }, { requiredAnchors: required, matchToken: token });
  return matched
    ? firstVisibleLocator(page, page.locator(`[data-codex-title-match="${token}"]`))
    : null;
}


async function locateTargets(page, item) {
  const targets = [];
  const matchMethods = [];
  if (item.selector) {
    const located = await firstVisibleLocator(page, page.locator(String(item.selector)));
    if (located) {
      targets.push(await expandSemanticTarget(located));
      matchMethods.push("selector");
    }
  }
  for (const [quoteIndex, quoteValue] of (item.quotes || []).entries()) {
    const quote = String(quoteValue).trim();
    if (!quote) {
      continue;
    }
    let method = "playwright_text";
    let located = await firstVisibleLocator(page, page.getByText(quote, { exact: false }));
    if (!located) {
      located = await locateNormalizedQuote(page, quote, quoteIndex);
      method = "normalized_dom_text";
    }
    if (!located) {
      located = await locateDistinctiveTokens(page, quote, quoteIndex);
      method = "distinctive_token_fallback";
    }
    if (located) {
      targets.push(await expandSemanticTarget(located));
      matchMethods.push(method);
    }
  }
  if (!targets.length && item.title && titleIsSpecificEnough(item.title)) {
    let located = await firstVisibleLocator(page, page.getByText(String(item.title), { exact: false }));
    if (!located) {
      located = await locateNormalizedQuote(page, String(item.title), 999);
    }
    if (!located) {
      located = await locateTitleAnchors(page, String(item.title));
    }
    if (located) {
      targets.push(await expandSemanticTarget(located));
      matchMethods.push("item_title_context_fallback");
    }
  }
  return { targets, matchMethods };
}


async function findObstructingConsentOverlay(page, boxes) {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return page.evaluate(({ targetBox }) => {
    const marker = /(cookie|consent|privacy|cookies|\u9690\u79c1|\u540c\u610f)/i;
    const intersectionArea = (left, right) => {
      const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
      const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
      return width * height;
    };
    const targetArea = Math.max(1, (targetBox.right - targetBox.left) * (targetBox.bottom - targetBox.top));
    for (const element of document.querySelectorAll("body *")) {
      const style = getComputedStyle(element);
      if (style.position !== "fixed" && style.position !== "sticky") {
        continue;
      }
      const text = String(element.innerText || "").slice(0, 2000);
      if (!marker.test(text)) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const documentRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        right: rect.right + window.scrollX,
        bottom: rect.bottom + window.scrollY,
      };
      if (intersectionArea(targetBox, documentRect) / targetArea >= 0.15) {
        return text.replace(/\s+/g, " ").trim().slice(0, 160) || "consent overlay";
      }
    }
    return null;
  }, { targetBox: { left: minX, top: minY, right: maxX, bottom: maxY } });
}


async function captureHtml(page, item, outputPath, sharp) {
  const requestedTimeout = Number(item.navigation_timeout_ms);
  const navigationTimeout = Number.isFinite(requestedTimeout)
    ? Math.max(100, Math.min(60000, requestedTimeout))
    : 45000;
  const navigation = await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
  if (!navigation) {
    throw new Error("Navigation returned no response.");
  }
  if (navigation.status() >= 400) {
    throw new Error(`Navigation returned HTTP ${navigation.status()}.`);
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  const dismissedConsentCount = await dismissConsentBanners(page);
  const bodyText = (await page.locator("body").innerText({ timeout: 10000 }).catch(() => "")).slice(0, 8000).toLowerCase();
  const blockedMarker = ACCESS_MARKERS.find((marker) => bodyText.includes(marker));
  if (blockedMarker) {
    return {
      status: "access_restricted",
      error: `The page appears access restricted: ${blockedMarker}`,
      final_url: page.url(),
      page_title: await page.title(),
    };
  }

  const { targets, matchMethods } = await locateTargets(page, item);
  if (!targets.length) {
    return {
      status: "no_match",
      error: "No visible selector or quoted passage matched the page.",
      final_url: page.url(),
      page_title: await page.title(),
    };
  }

  const boxes = [];
  for (const target of targets) {
    await target.evaluate((element) => {
      element.setAttribute("data-codex-evidence-highlight", "true");
      element.style.setProperty("background", "#fff2a8", "important");
      element.style.setProperty("outline", "3px solid #c00000", "important");
      element.style.setProperty("outline-offset", "2px", "important");
    });
    const box = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    });
    if (box && box.width > 0 && box.height > 0) {
      boxes.push(box);
    }
  }
  if (!boxes.length) {
    return {
      status: "no_visible_box",
      error: "Matched elements did not have a visible bounding box.",
      final_url: page.url(),
      page_title: await page.title(),
    };
  }

  await targets[0].scrollIntoViewIfNeeded();
  const obstructingOverlay = await findObstructingConsentOverlay(page, boxes);
  if (obstructingOverlay) {
    return {
      status: "obstructed_overlay",
      error: `A consent overlay still obstructs the supporting passage: ${obstructingOverlay}`,
      final_url: page.url(),
      page_title: await page.title(),
      dismissed_consent_count: dismissedConsentCount,
      match_methods: matchMethods,
    };
  }

  const pageSize = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
    height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
  }));
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  const padding = Math.max(24, Math.min(240, Number(item.context_padding || 80)));
  const desiredWidth = Math.min(pageSize.width, Math.max(900, maxX - minX + padding * 2));
  const centerX = (minX + maxX) / 2;
  const clipX = Math.max(0, Math.min(pageSize.width - desiredWidth, centerX - desiredWidth / 2));
  const clipY = Math.max(0, minY - padding);
  const clipHeight = Math.min(pageSize.height - clipY, maxY - minY + padding * 2);
  if (clipHeight > 5000) {
    return {
      status: "capture_too_large",
      error: "Matched passages span more than 5000 CSS pixels. Split them into separate capture items.",
      final_url: page.url(),
      page_title: await page.title(),
    };
  }
  let screenshot;
  let captureMethod = "document_clip";
  try {
    screenshot = await page.screenshot({
      type: "png",
      animations: "disabled",
      caret: "hide",
      clip: {
        x: Math.floor(clipX),
        y: Math.floor(clipY),
        width: Math.max(1, Math.floor(desiredWidth)),
        height: Math.max(1, Math.ceil(clipHeight)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Clipped area is either empty or outside")) {
      throw error;
    }
    await targets[0].scrollIntoViewIfNeeded();
    screenshot = await targets[0].screenshot({
      type: "png",
      animations: "disabled",
      caret: "hide",
    });
    captureMethod = "target_element_fallback";
  }
  await resizePng(sharp, screenshot, outputPath);
  return {
    status: "captured",
    error: null,
    final_url: page.url(),
    page_title: await page.title(),
    screenshot_path: outputPath,
    matched_target_count: boxes.length,
    match_methods: matchMethods,
    capture_method: captureMethod,
    dismissed_consent_count: dismissedConsentCount,
    support_warning: matchMethods.includes("item_title_context_fallback")
      ? "The capture used the item title as context because no quoted passage matched. Review direct claim support before accepting it as evidence."
      : null,
  };
}


async function capturePdf(context, item, outputDir, outputPath, sharp, pdftoppm) {
  const response = await context.request.get(item.url, { timeout: 45000, failOnStatusCode: false });
  if (!response.ok()) {
    throw new Error(`PDF download returned HTTP ${response.status()}.`);
  }
  const identifier = safeIdentifier(item.id);
  const pdfPath = path.join(outputDir, `${identifier}-source.pdf`);
  await fs.writeFile(pdfPath, await response.body());
  const pageNumber = Number(item.page_number);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error("PDF capture requires a positive page_number.");
  }
  const renderPrefix = path.join(outputDir, `${identifier}-page`);
  await runProcess(
    pdftoppm,
    ["-f", String(pageNumber), "-l", String(pageNumber), "-singlefile", "-r", "200", "-png", pdfPath, renderPrefix],
    120000,
  );
  const renderedPath = `${renderPrefix}.png`;
  let pipeline = sharp(renderedPath, { failOn: "error" });
  const metadata = await pipeline.metadata();
  const pageWidth = metadata.width || 1;
  const pageHeight = metadata.height || 1;
  let cropBox = { left: 0, top: 0, width: pageWidth, height: pageHeight };
  if (item.crop) {
    const crop = item.crop;
    const left = Math.max(0, Math.floor(Number(crop.x || 0)));
    const top = Math.max(0, Math.floor(Number(crop.y || 0)));
    const width = Math.min(pageWidth - left, Math.floor(Number(crop.width || pageWidth)));
    const height = Math.min(pageHeight - top, Math.floor(Number(crop.height || pageHeight)));
    if (width < 1 || height < 1) {
      throw new Error("PDF crop is outside the rendered page.");
    }
    cropBox = { left, top, width, height };
    pipeline = pipeline.extract({ left, top, width, height });
  }
  const highlightRects = [];
  for (const highlight of item.highlights || []) {
    const pageLeft = Math.max(0, Math.floor(Number(highlight.x || 0)));
    const pageTop = Math.max(0, Math.floor(Number(highlight.y || 0)));
    const pageRight = Math.min(pageWidth, pageLeft + Math.floor(Number(highlight.width || 0)));
    const pageBottom = Math.min(pageHeight, pageTop + Math.floor(Number(highlight.height || 0)));
    const left = Math.max(0, pageLeft - cropBox.left);
    const top = Math.max(0, pageTop - cropBox.top);
    const right = Math.min(cropBox.width, pageRight - cropBox.left);
    const bottom = Math.min(cropBox.height, pageBottom - cropBox.top);
    if (right > left && bottom > top) {
      highlightRects.push({ left, top, width: right - left, height: bottom - top });
    }
  }
  if ((item.highlights || []).length > 0 && highlightRects.length === 0) {
    throw new Error("PDF highlights do not intersect the selected crop.");
  }
  if (highlightRects.length > 0) {
    const rectangles = highlightRects.map((rect) =>
      '<rect x="' + rect.left + '" y="' + rect.top + '" width="' + rect.width + '" height="' + rect.height + '" fill="#FFF2A8" fill-opacity="0.38" stroke="#D71920" stroke-width="5"/>'
    ).join("");
    const overlay = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + cropBox.width + '" height="' + cropBox.height + '">' + rectangles + '</svg>'
    );
    pipeline = pipeline.composite([{ input: overlay, top: 0, left: 0 }]);
  }
  const buffer = await pipeline.png().toBuffer();
  await resizePng(sharp, buffer, outputPath);
  return {
    status: "captured",
    error: null,
    final_url: response.url(),
    page_title: item.title || null,
    screenshot_path: outputPath,
    page_number: pageNumber,
    crop: item.crop || null,
    highlight_count: highlightRects.length,
  };
}


async function main() {
  const args = parseArgs(process.argv.slice(2));
  const planPath = path.resolve(args.plan);
  const outputDir = path.resolve(args["output-dir"]);
  await fs.mkdir(outputDir, { recursive: true });
  const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
  if (!Array.isArray(plan.items)) {
    throw new Error("Capture plan items must be an array.");
  }
  const playwrightModule = await loadPackage("playwright");
  const playwright = playwrightModule.default || playwrightModule;
  const sharpModule = await loadPackage("sharp");
  const sharp = sharpModule.default || sharpModule;
  const browserExecutable = await findBrowserExecutable(args["browser-executable"]);
  const launchOptions = browserExecutable ? { headless: true, executablePath: browserExecutable } : { headless: true };
  const browser = await playwright.chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: "en-US",
    colorScheme: "light",
    deviceScaleFactor: 1,
  });
  const results = [];
  const pdftoppm = args.pdftoppm || process.env.PDFTOPPM_PATH || "pdftoppm";
  try {
    for (const item of plan.items) {
      const baseResult = {
        id: item.id,
        block_id: item.block_id,
        claim_ids: item.claim_ids || [],
        url: item.url,
        source_type: item.source_type,
        title: item.title || null,
        publisher: item.publisher || null,
        published_date: item.published_date || null,
        accessed_at: new Date().toISOString(),
      };
      const cutoffFailure = validateCutoff(item, plan.report_date);
      if (cutoffFailure) {
        results.push({ ...baseResult, ...cutoffFailure, screenshot_path: null });
        continue;
      }
      const outputPath = path.join(outputDir, `${safeIdentifier(item.id)}.png`);
      try {
        let capture;
        if (String(item.kind || "html") === "pdf") {
          capture = await capturePdf(context, item, outputDir, outputPath, sharp, pdftoppm);
        } else {
          const page = await context.newPage();
          try {
            capture = await captureHtml(page, item, outputPath, sharp);
          } finally {
            await page.close();
          }
        }
        results.push({ ...baseResult, ...capture });
      } catch (error) {
        results.push({
          ...baseResult,
          status: "capture_error",
          error: error instanceof Error ? error.message : String(error),
          screenshot_path: null,
        });
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const resultPath = path.join(outputDir, "capture-results.json");
  await fs.writeFile(resultPath, JSON.stringify({ schema_version: "1.0", results }, null, 2), "utf8");
  const captured = results.filter((item) => item.status === "captured").length;
  process.stdout.write(`${JSON.stringify({ status: "ok", output: resultPath, item_count: results.length, captured })}\n`);
}


main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
