#!/usr/bin/env node
// One PDF of the guide for each role (and one with everything), printed from
// the page scripts/guide/build.mjs made: only that role's tasks and screens.
//
//   PLAYWRIGHT_MJS=… node scripts/guide/pdf.mjs   # → $GUIDE_OUT/pdf/*.pdf
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROLES } from "./roles.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MJS || "playwright");
const OUT = process.env.GUIDE_OUT || "/tmp/sixties-guide/out";
mkdirSync(join(OUT, "pdf"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [key, name] of [["", "Everyone"], ...ROLES.map(([k, n]) => [k, n])]) {
  await page.goto(`file://${join(OUT, "index.html")}${key ? `#print-${key}` : ""}`);
  await page.evaluate(async () => {
    document.querySelectorAll("img[loading]").forEach((i) => (i.loading = "eager"));
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    await document.fonts.ready;
  });
  const file = join(OUT, "pdf", `Sixties-Guide-${name.replace(/\s+/g, "-")}.pdf`);
  await page.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font:8px sans-serif;color:#7a6152;width:100%;padding:0 14mm">The Sixty's Guide · ${name}</div>`,
    footerTemplate: `<div style="font:8px sans-serif;color:#7a6152;width:100%;text-align:right;padding:0 14mm"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  console.log(file);
}
await browser.close();
