// Documents kept with the records (0053, release AA), through the real screens:
// a manager keeps a delivery note with its delivery from Purchasing's 📎, a
// phone's photo made smaller before it goes and a PDF as it is; each is
// listed with its name, size and who, and opens through a link to the file
// that lasts a minute; the photo is taken off saying why, and kept apart with
// why; a file that is not a picture or a PDF is refused in words, and nothing
// is sent. The owner keeps the bill's PDF with the bill from the supplier's
// statement (where the 📎 is left off the printed statement) and a receipt
// with an expense. A cashier is sent away and opens no file. The audit trail
// names each by its record. The page in Arabic and Kurdish.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const n = (q) => Number(last(q));
const B = "00000000-0000-0000-0000-0000000000b1";
const WATER = "c0000000-0000-0000-0000-000000000003";
const MANAGER = "a0000000-0000-0000-0000-00000000000b";
const supplier = last(
  `select id from supplier where business_id = '${B}' and is_active order by name, id limit 1`,
);
const supplierName = last(`select name from supplier where id = '${supplier}'`);

// A delivery, its bill and an expense, as the tests' own shortcut.
const receipt = last(`select test.act_as('manager@example.com');
  select receive_goods('${supplier}', '[{"item_id":"${WATER}","qty":4,"unit_price":300}]',
                       p_confirm => true) ->> 'receipt_id'`);
const receiptNo = last(`select receipt_no from goods_receipt where id = '${receipt}'`);
const bill = last(`select test.act_as('owner@example.com');
  select record_bill('${supplier}', 'E2E-DOC-1', ${TODAY}, 1200, 0, '${receipt}', null) ->> 'bill_id'`);
const expense = last(`select test.act_as('owner@example.com');
  select record_expense('Printer paper', 2500, '6900', 'bank', p_idempotency_key => gen_random_uuid()) ->> 'expense_id'`);
const files = () => n(`select count(*) from storage.objects where bucket_id = 'documents'`);
const kept = (record, name) =>
  last(`select id || '|' || content_type || '|' || size_bytes || '|' || storage_path || '|'
               || coalesce(note, '') || '|' || coalesce(removed_reason, '')
          from document_attachment where record_id = '${record}' and file_name = '${name}'`).split(
    "|",
  );

/** A photo as a phone takes one: 3,000 by 2,000 pixels, well over 1.5 MB as a JPEG. */
async function phonePhoto(page) {
  const b64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 2000;
    const g = canvas.getContext("2d");
    const img = g.createImageData(3000, 2000);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (i / 4) % 3000;
      img.data[i] = (v * 7 + Math.random() * 90) % 255;
      img.data[i + 1] = Math.random() * 255;
      img.data[i + 2] = ((i / 12000) % 255) + Math.random() * 40;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return Buffer.from(b64, "base64");
}

/** A small picture, as a screenshot of a receipt would be. */
async function smallPng(page) {
  const b64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 400;
    const g = canvas.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 300, 400);
    g.fillStyle = "#000";
    g.fillText("Printer paper 2,500", 20, 40);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return btoa(String.fromCharCode(...bytes));
  });
  return Buffer.from(b64, "base64");
}

/** A PDF, as a supplier sends one. */
async function aPdf(title) {
  const p = await browser.newPage();
  await p.setContent(`<h1>${title}</h1><p>4 × Golden water at 300 = 1,200 IQD</p>`);
  const pdf = await p.pdf({ format: "A4" });
  await p.close();
  return pdf;
}

/** Attach the file chosen, and wait for it to be listed by its name. */
async function attach(page, input, file, name = null, note = null) {
  await page.getByTestId(input).setInputFiles(file);
  if (name !== null) await page.getByTestId("document-name").fill(name);
  if (note !== null) await page.getByTestId("document-note").fill(note);
  await page.getByTestId("document-attach").click();
  await page
    .locator(`[data-testid="document-row"][data-name="${name ?? file.name}"]`)
    .waitFor({ timeout: 30000 });
}

let pdfId = null;
console.log(
  "▸ a manager keeps the delivery note with the delivery: a photo, made smaller, and a PDF",
);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const row = page.locator(`[data-testid="receipt-row"][data-receipt="${receiptNo}"]`);
  const link = row.getByTestId("documents-link");
  check(
    (await link.getAttribute("data-count")) === "0",
    "the delivery's 📎 says it keeps none yet",
  );
  await Promise.all([page.waitForURL(`**/documents/goods_receipt/${receipt}`), link.click()]);
  await page.waitForLoadState("networkidle");
  check(
    (await page.getByTestId("documents-record").textContent()).trim() === `Delivery ${receiptNo}` &&
      (await page.getByTestId("documents-about").textContent()).includes(supplierName) &&
      (await page.getByTestId("documents-none").isVisible()),
    `its page names the delivery (${receiptNo}, ${supplierName}), keeping none yet`,
  );

  const photo = await phonePhoto(page);
  check(
    photo.length > 1.5 * 1024 * 1024,
    `a phone's photo of the note: ${(photo.length / 1048576).toFixed(1)} MB`,
  );
  const before = files();
  await page
    .getByTestId("document-camera")
    .setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: photo });
  check(
    (await page.getByTestId("document-name").inputValue()) === "IMG_2041.jpg",
    "its name starts as the file's",
  );
  await page.getByTestId("document-name").fill("Delivery note");
  await page.getByTestId("document-note").fill("signed by the driver");
  await page.getByTestId("document-attach").click();
  await page
    .locator('[data-testid="document-row"][data-name="Delivery note"]')
    .waitFor({ timeout: 30000 });
  const [photoId, photoType, photoSize, photoPath, photoNote] = kept(receipt, "Delivery note");
  check(
    photoType === "image/jpeg" &&
      Number(photoSize) < photo.length &&
      photoNote === "signed by the driver",
    `kept as a JPEG of ${(Number(photoSize) / 1048576).toFixed(1)} MB, smaller than it was, with its note`,
  );
  const [w, h] = await page.evaluate(async (url) => {
    const b = await (await fetch(url)).blob();
    const p = await createImageBitmap(b);
    return [p.width, p.height];
  }, `/documents/file/${photoId}`);
  check(Math.max(w, h) === 2000, `its longer side made 2,000 pixels (${w} × ${h})`);
  check(
    photoPath.startsWith(`${B}/goods_receipt/${receipt}/`) &&
      last(`select owner from storage.objects where name = '${photoPath}'`) === MANAGER &&
      files() === before + 1,
    "the file is in the bucket under the café, the delivery and a name of its own, put there by the manager",
  );

  const pdf = await aPdf("Delivery note, page 2");
  await attach(page, "document-file", {
    name: "delivery-note-2.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  const kept2 = kept(receipt, "delivery-note-2.pdf");
  pdfId = kept2[0];
  check(
    kept2[1] === "application/pdf" && Number(kept2[2]) === pdf.length,
    "a PDF is kept as it was sent, under the file's own name",
  );
  const list = await page.getByTestId("documents-list").textContent();
  check(
    (await page.getByTestId("document-row").count()) === 2 &&
      list.includes("Demo Manager") &&
      /\d+ KB/.test(list) &&
      /\d\.\d MB/.test(list),
    "both listed, with their size and who attached them",
  );

  const res = await page.request.get(`${BASE}/documents/file/${pdfId}`, { maxRedirects: 0 });
  const to = res.headers()["location"] ?? "";
  check(
    res.status() >= 300 && res.status() < 400 && to.includes("/storage/v1/object/sign/documents/"),
    "opening one sends the browser to a link to the file itself, not through the app",
  );
  const token = new URL(to).searchParams.get("token") ?? "";
  const exp = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()).exp;
  check(exp - Date.now() / 1000 <= 61, "a link that lasts a minute");
  const file = await page.request.get(to);
  check(
    (await file.body()).equals(pdf) && file.headers()["content-type"] === "application/pdf",
    "which gives the PDF as it was sent",
  );
  const dl = await page.request.get(`${BASE}/documents/file/${pdfId}?download=1`, {
    maxRedirects: 0,
  });
  const saved = await page.request.get(dl.headers()["location"] ?? "");
  check(
    /attachment/.test(saved.headers()["content-disposition"] ?? "") &&
      decodeURIComponent(saved.headers()["content-disposition"] ?? "").includes(
        "delivery-note-2.pdf",
      ),
    "and Download saves it under its own name",
  );

  const photoRow = page.locator('[data-testid="document-row"][data-name="Delivery note"]');
  await photoRow.getByTestId("document-detach").click();
  await photoRow.getByTestId("document-detach-reason").fill("Blurred: taken again");
  await photoRow.getByTestId("document-detach-confirm").click();
  await page
    .locator('[data-testid="removed-row"][data-name="Delivery note"]')
    .waitFor({ timeout: 20000 });
  const removed = await page.getByTestId("documents-removed").textContent();
  check(
    (await photoRow.count()) === 0 &&
      removed.includes("Blurred: taken again") &&
      removed.includes("Demo Manager"),
    "the photo is taken off, and listed apart with who took it off and why",
  );
  check(
    kept(receipt, "Delivery note")[5] === "Blurred: taken again" &&
      n(`select count(*) from storage.objects where name = '${photoPath}'`) === 1,
    "the database keeps it, with why; the file stays",
  );

  const sent = files();
  await page.getByTestId("document-file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a document"),
  });
  await page.getByTestId("document-attach").click();
  await page.getByText("A document is a picture (JPEG, PNG or WebP) or a PDF").waitFor();
  check(files() === sent, "a text file is refused in words, and nothing is sent");

  await open(page, "/purchasing");
  check(
    (await row.getByTestId("documents-link").getAttribute("data-count")) === "1",
    "back on Purchasing, the delivery's 📎 says 1",
  );
  await ctx.close();
}

console.log("▸ the owner keeps the bill's PDF with the bill, from the supplier's statement");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/vendors/${supplier}/statement`);
  const link = page.locator(`a[href="/documents/purchase_invoice/${bill}"]`).first();
  check((await link.getAttribute("data-count")) === "0", "the bill's line has its 📎");
  await Promise.all([page.waitForURL(`**/documents/purchase_invoice/${bill}`), link.click()]);
  await page.waitForLoadState("networkidle");
  check(
    (await page.getByTestId("documents-record").textContent()).trim() === "Bill E2E-DOC-1",
    "its page is the bill's, by its number",
  );
  await attach(page, "document-file", {
    name: "E2E-DOC-1.pdf",
    mimeType: "application/pdf",
    buffer: await aPdf("Invoice E2E-DOC-1"),
  });
  check(kept(bill, "E2E-DOC-1.pdf")[1] === "application/pdf", "the bill keeps its PDF");
  await open(page, `/vendors/${supplier}/statement`);
  check((await link.getAttribute("data-count")) === "1", "and the statement's 📎 says 1");
  await page.emulateMedia({ media: "print" });
  check(
    (await page.locator('.print-doc [data-testid="supplier-statement"]').isVisible()) &&
      !(await page.locator(`.print-doc a[href="/documents/purchase_invoice/${bill}"]`).isVisible()),
    "the printed statement, for the supplier, leaves the 📎 off",
  );
  await page.emulateMedia({ media: "screen" });
  await ctx.close();
}

console.log("▸ and a receipt with an expense, from Expenses");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/expenses");
  const link = page.locator(`a[href="/documents/expense/${expense}"]`);
  await Promise.all([page.waitForURL(`**/documents/expense/${expense}`), link.click()]);
  await page.waitForLoadState("networkidle");
  check(
    (await page.getByTestId("documents-about").textContent()).includes("Printer paper"),
    "its page says what the expense was for",
  );
  await attach(
    page,
    "document-file",
    { name: "receipt.png", mimeType: "image/png", buffer: await smallPng(page) },
    "Receipt",
    "from the stationer",
  );
  const [, type, size] = kept(expense, "Receipt");
  check(type === "image/png" && Number(size) > 0, "a small picture is kept as it is, a PNG");
  await open(page, "/expenses");
  check(
    (await page.locator(`a[href="/documents/expense/${expense}"]`).getAttribute("data-count")) ===
      "1",
    "and the expense's 📎 says 1",
  );
  await ctx.close();
}

console.log("▸ a cashier, who sees no costs, is sent away and opens no file");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, `/documents/goods_receipt/${receipt}`);
  check(
    !new URL(page.url()).pathname.startsWith("/documents"),
    "the delivery's documents send the cashier elsewhere",
  );
  const res = await page.request.get(`${BASE}/documents/file/${pdfId}`, { maxRedirects: 0 });
  check(res.status() === 404, "and a document's file is not found for them");
  await ctx.close();
}

console.log("▸ the audit trail names each document by its record");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/audit?group=documents");
  const trail = await page.getByTestId("audit-trail").textContent();
  check(
    trail.includes(`Receipt ${receiptNo}`) &&
      trail.includes("Supplier bill E2E-DOC-1") &&
      trail.includes("Printer paper"),
    "the delivery by its number, the bill by its number, the expense by what it was for",
  );
  check(
    (await page.locator('tr[data-action="document.attach"]').count()) === 4 &&
      (await page.locator('tr[data-action="document.detach"]').count()) === 1 &&
      trail.includes("Blurred: taken again"),
    "four attached, and one taken off with why",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const words = [];
  for (const path of [`/documents/goods_receipt/${receipt}`, "/audit?group=documents"]) {
    await open(page, path);
    words.push(...(await english(page, path)));
  }
  check(
    words.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("documents");
