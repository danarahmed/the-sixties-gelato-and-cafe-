"use server";

/**
 * Server actions — the LIVE write path. Every mutation goes through the tested
 * domain core (unit conversion, landed cost, moving-average valuation, channel
 * aware recipe expansion) and writes real, append-only ledger movements,
 * orders, and balanced double-entry journals to Supabase. Scoped to the demo
 * business by RLS until Supabase Auth is wired.
 */
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { IQD, Money } from "@domain/money/money.js";
import { Quantity, UnitSystem, type UnitDefinition, type Dimension } from "@domain/units/units.js";
import { landedUnitCost } from "@domain/costing/wac.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";
import { getDefaultLocationId } from "@/lib/db/read";
import { loadCatalog, expandForSale } from "@/lib/db/catalog";

const biz = DEMO_BUSINESS_ID;
type Result = { ok: boolean; error?: string; id?: string };

function db() {
  const c = getSupabase();
  if (!c) throw new Error("Database is not configured");
  return c;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** value rounded to the business currency (IQD, 0 dp). */
function money(v: Decimal | number | string): number {
  return Number(Money.of(v.toString(), IQD).quantize().toDecimalValue().toString());
}

// ---------------------------------------------------------------------------
// Items & stock
// ---------------------------------------------------------------------------
export interface CreateItemInput {
  name: string;
  nameAr?: string;
  nameCkb?: string;
  itemType: string; // ingredient|packaging|consumable|finished_good|resale
  baseUnit: string;
  dimension: Dimension;
  minLevelBase?: number | null;
  openingQty?: number | null;
  openingUnitCost?: number | null;
}

export async function createItemAction(input: CreateItemInput): Promise<Result> {
  try {
    const c = db();
    if (!input.name?.trim()) return { ok: false, error: "Name is required" };
    const { data, error } = await c
      .from("item")
      .insert({
        business_id: biz,
        name: input.name.trim(),
        name_ar: input.nameAr?.trim() || null,
        name_ckb: input.nameCkb?.trim() || null,
        item_type: input.itemType,
        base_unit_code: input.baseUnit.trim(),
        dimension: input.dimension,
        min_level_base: input.minLevelBase ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    const itemId = String(data.id);

    const qty = Number(input.openingQty ?? 0);
    if (qty > 0) {
      const locationId = await getDefaultLocationId();
      if (!locationId) return { ok: false, error: "No location configured" };
      const unitCost = Number(input.openingUnitCost ?? 0);
      const value = money(new Decimal(qty).times(unitCost));
      const mv = await c.from("inventory_movement").insert({
        business_id: biz,
        item_id: itemId,
        location_id: locationId,
        type: "opening_balance",
        base_quantity_signed: qty,
        unit_cost: unitCost,
        value,
        reason: "Opening balance",
      });
      if (mv.error) return { ok: false, error: mv.error.message };
    }
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, id: itemId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface AdjustStockInput {
  itemId: string;
  deltaBase: number; // signed
  type: string; // count_adjustment|manual_correction|waste|spoilage|opening_balance
  unitCost?: number | null;
  reason?: string;
}

export async function adjustStockAction(input: AdjustStockInput): Promise<Result> {
  try {
    const c = db();
    if (!input.deltaBase || Number(input.deltaBase) === 0)
      return { ok: false, error: "Quantity change cannot be zero" };
    const locationId = await getDefaultLocationId();
    if (!locationId) return { ok: false, error: "No location configured" };
    const qty = Number(input.deltaBase);
    const unitCost = input.unitCost != null ? Number(input.unitCost) : null;
    const value = unitCost != null ? money(new Decimal(Math.abs(qty)).times(unitCost)) : null;
    const { error } = await c.from("inventory_movement").insert({
      business_id: biz,
      item_id: input.itemId,
      location_id: locationId,
      type: input.type,
      base_quantity_signed: qty,
      unit_cost: unitCost,
      value,
      reason: input.reason?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Suppliers & purchasing
// ---------------------------------------------------------------------------
export async function createSupplierAction(input: {
  name: string;
  contact?: string;
  phone?: string;
}): Promise<Result> {
  try {
    const c = db();
    if (!input.name?.trim()) return { ok: false, error: "Name is required" };
    const { data, error } = await c
      .from("supplier")
      .insert({
        business_id: biz,
        name: input.name.trim(),
        contact: input.contact?.trim() || null,
        phone: input.phone?.trim() || null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/purchasing");
    return { ok: true, id: String(data.id) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ReceiveLineInput {
  itemId: string;
  baseUnit: string;
  dimension: Dimension;
  receivedQty: number; // in receivedUnit
  receivedUnit: string;
  unitFactorToBase: number; // factor for receivedUnit → base
  goodsValue: number; // total for the line
}

export interface ReceivePurchaseInput {
  supplierId?: string | null;
  supplierName?: string | null;
  freight?: number;
  other?: number;
  rebate?: number;
  lines: ReceiveLineInput[];
}

export async function receivePurchaseAction(input: ReceivePurchaseInput): Promise<Result> {
  try {
    const c = db();
    const lines = (input.lines ?? []).filter((l) => l.itemId && Number(l.receivedQty) > 0);
    if (lines.length === 0) return { ok: false, error: "Add at least one line with a quantity" };
    const locationId = await getDefaultLocationId();
    if (!locationId) return { ok: false, error: "No location configured" };

    const freight = Money.of(String(input.freight ?? 0), IQD);
    const other = Money.of(String(input.other ?? 0), IQD);
    const rebate = Money.of(String(input.rebate ?? 0), IQD);
    const goodsTotal = lines.reduce((s, l) => s + Number(l.goodsValue), 0);

    // Create the goods receipt header (supplier name kept in note for the demo).
    const grR = await c
      .from("goods_receipt")
      .insert({
        business_id: biz,
        location_id: locationId,
        freight_total: money(input.freight ?? 0),
        other_landed_total: money(input.other ?? 0),
        rebate_total: money(input.rebate ?? 0),
        note: input.supplierName?.trim() || null,
      })
      .select("id")
      .single();
    if (grR.error) return { ok: false, error: grR.error.message };
    const receiptId = String(grR.data.id);

    for (const l of lines) {
      // Convert received qty → base units with an explicit factor.
      const base: UnitDefinition = { code: l.baseUnit, dimension: l.dimension, factorToBase: "1", label: l.baseUnit };
      const recv: UnitDefinition = {
        code: l.receivedUnit,
        dimension: l.dimension,
        factorToBase: String(l.unitFactorToBase || 1),
        label: l.receivedUnit,
      };
      const sys = new UnitSystem(l.baseUnit, l.receivedUnit === l.baseUnit ? [base] : [base, recv]);
      const baseQty = Quantity.of(l.receivedQty, l.receivedUnit).toBase(sys).value;

      // Allocate landed cost proportionally by goods value.
      const share = goodsTotal > 0 ? Number(l.goodsValue) / goodsTotal : 0;
      const { landedValue, unitCost } = landedUnitCost({
        quantityBase: baseQty,
        goodsValue: Money.of(String(l.goodsValue), IQD),
        allocatedFreight: freight.multiply(share),
        allocatedOther: other.multiply(share),
        allocatedRebate: rebate.multiply(share),
      });

      const mvR = await c
        .from("inventory_movement")
        .insert({
          business_id: biz,
          item_id: l.itemId,
          location_id: locationId,
          type: "purchase_receipt",
          base_quantity_signed: Number(baseQty.toString()),
          unit_cost: Number(unitCost.toDecimalValue().toString()),
          value: money(landedValue.toDecimalValue()),
          reference_type: "goods_receipt",
          reference_id: receiptId,
          reason: "Goods received",
        })
        .select("id")
        .single();
      if (mvR.error) return { ok: false, error: mvR.error.message };

      const glR = await c.from("goods_receipt_line").insert({
        goods_receipt_id: receiptId,
        item_id: l.itemId,
        received_qty: Number(l.receivedQty),
        received_unit_code: l.receivedUnit,
        goods_value: money(l.goodsValue),
        movement_id: String(mvR.data.id),
      });
      if (glR.error) return { ok: false, error: glR.error.message };
    }
    revalidatePath("/purchasing");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, id: receiptId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Products + recipe + prices
// ---------------------------------------------------------------------------
export interface RecipeLineInput {
  itemId: string;
  quantity: number;
  unitCode: string;
  channels?: SalesChannel[]; // empty/undefined = all channels
}

export interface CreateProductInput {
  name: string;
  nameAr?: string;
  nameCkb?: string;
  prices: Partial<Record<SalesChannel, number>>;
  recipeLines: RecipeLineInput[];
}

export async function createProductAction(input: CreateProductInput): Promise<Result> {
  try {
    const c = db();
    if (!input.name?.trim()) return { ok: false, error: "Product name is required" };
    const lines = (input.recipeLines ?? []).filter((l) => l.itemId && Number(l.quantity) > 0);

    const prodR = await c
      .from("product")
      .insert({
        business_id: biz,
        name: input.name.trim(),
        name_ar: input.nameAr?.trim() || null,
        name_ckb: input.nameCkb?.trim() || null,
      })
      .select("id")
      .single();
    if (prodR.error) return { ok: false, error: prodR.error.message };
    const productId = String(prodR.data.id);

    const varR = await c
      .from("product_variant")
      .insert({ product_id: productId, name: input.name.trim() })
      .select("id")
      .single();
    if (varR.error) return { ok: false, error: varR.error.message };
    const variantId = String(varR.data.id);

    const recR = await c
      .from("recipe")
      .insert({ business_id: biz, name: input.name.trim() })
      .select("id")
      .single();
    if (recR.error) return { ok: false, error: recR.error.message };
    const recipeId = String(recR.data.id);

    const verR = await c
      .from("recipe_version")
      .insert({ recipe_id: recipeId, version_no: 1, effective_from: today() })
      .select("id")
      .single();
    if (verR.error) return { ok: false, error: verR.error.message };
    const versionId = String(verR.data.id);

    if (lines.length > 0) {
      const lineRows = lines.map((l) => ({
        recipe_version_id: versionId,
        component_type: "item" as const,
        item_id: l.itemId,
        quantity: Number(l.quantity),
        unit_code: l.unitCode,
        applies_to_channels: l.channels && l.channels.length > 0 ? l.channels : null,
      }));
      const lineR = await c.from("recipe_line").insert(lineRows);
      if (lineR.error) return { ok: false, error: lineR.error.message };
    }

    const vrR = await c
      .from("variant_recipe")
      .insert({ product_variant_id: variantId, recipe_id: recipeId });
    if (vrR.error) return { ok: false, error: vrR.error.message };

    const priceRows = Object.entries(input.prices ?? {})
      .filter(([, v]) => Number(v) > 0)
      .map(([channel, price]) => ({
        business_id: biz,
        product_variant_id: variantId,
        channel,
        price: Number(price),
        effective_from: today(),
      }));
    if (priceRows.length > 0) {
      const priceR = await c.from("channel_price").insert(priceRows);
      if (priceR.error) return { ok: false, error: priceR.error.message };
    }

    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/reports");
    return { ok: true, id: productId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// POS: record a live sale → order, lines, tender, ledger movements, journal
// ---------------------------------------------------------------------------
export interface SaleLineInput {
  variantId: string;
  qty: number;
}
export interface RecordSaleInput {
  channel: SalesChannel;
  tender: "cash" | "card" | "platform_paid";
  lines: SaleLineInput[];
}

export async function recordSaleAction(
  input: RecordSaleInput,
): Promise<Result & { net?: number; cogs?: number }> {
  try {
    const c = db();
    const cart = (input.lines ?? []).filter((l) => l.variantId && Number(l.qty) > 0);
    if (cart.length === 0) return { ok: false, error: "Cart is empty" };
    const locationId = await getDefaultLocationId();
    if (!locationId) return { ok: false, error: "No location configured" };
    const cat = await loadCatalog();
    if (!cat) return { ok: false, error: "Catalog unavailable" };

    const variantById = new Map(cat.variants.map((v) => [v.variantId, v]));
    const deductions = new Map<string, { qty: Decimal; unitCost: Money }>();
    const orderLines: {
      product_variant_id: string;
      quantity: number;
      unit_price: number;
      line_discount: number;
      line_net: number;
      cogs_amount: number;
    }[] = [];
    let net = Money.zero(IQD);
    let cogs = Money.zero(IQD);

    for (const line of cart) {
      const v = variantById.get(line.variantId);
      if (!v) return { ok: false, error: "Unknown product in cart" };
      const price = v.priceByChannel[input.channel];
      if (price == null) return { ok: false, error: `No ${input.channel} price for ${v.productName}` };
      const lineNet = Money.of(String(price), IQD).multiply(line.qty);
      net = net.add(lineNet);

      let lineCogs = Money.zero(IQD);
      if (v.recipeId) {
        for (const d of expandForSale(cat, v.recipeId, input.channel, line.qty)) {
          const prev = deductions.get(d.itemId);
          deductions.set(d.itemId, {
            qty: (prev?.qty ?? new Decimal(0)).plus(d.baseQuantity),
            unitCost: d.unitCost,
          });
          lineCogs = lineCogs.add(d.unitCost.multiply(d.baseQuantity));
        }
      }
      cogs = cogs.add(lineCogs);
      orderLines.push({
        product_variant_id: line.variantId,
        quantity: line.qty,
        unit_price: Number(price),
        line_discount: 0,
        line_net: money(lineNet.toDecimalValue()),
        cogs_amount: money(lineCogs.toDecimalValue()),
      });
    }

    const netN = money(net.toDecimalValue());
    const cogsN = money(cogs.toDecimalValue());

    // 1) Order header
    const ordR = await c
      .from("sales_order")
      .insert({
        business_id: biz,
        location_id: locationId,
        channel: input.channel,
        status: "completed",
        idempotency_key: crypto.randomUUID(),
        gross_amount: netN,
        discount_amount: 0,
        net_amount: netN,
        cogs_amount: cogsN,
      })
      .select("id")
      .single();
    if (ordR.error) return { ok: false, error: ordR.error.message };
    const orderId = String(ordR.data.id);

    // 2) Order lines
    const olR = await c
      .from("sales_order_line")
      .insert(orderLines.map((l) => ({ ...l, sales_order_id: orderId })));
    if (olR.error) return { ok: false, error: olR.error.message };

    // 3) Tender
    await c.from("sales_tender").insert({
      sales_order_id: orderId,
      tender_type: input.tender,
      amount: netN,
    });

    // 4) Ledger movements (append-only sale consumption)
    if (deductions.size > 0) {
      const movements = [...deductions.entries()].map(([itemId, d]) => ({
        business_id: biz,
        item_id: itemId,
        location_id: locationId,
        type: "sale_consumption",
        base_quantity_signed: -Number(d.qty.toString()),
        unit_cost: Number(d.unitCost.toDecimalValue().toString()),
        value: money(d.unitCost.multiply(d.qty).toDecimalValue()),
        reference_type: "sales_order",
        reference_id: orderId,
        reason: "Sale",
      }));
      const mvR = await c.from("inventory_movement").insert(movements);
      if (mvR.error) return { ok: false, error: mvR.error.message };
    }

    // 5) Double-entry journal (best-effort; the sale itself is already recorded)
    await postSalesJournal(c, orderId, input.tender, netN, cogsN);

    revalidatePath("/pos");
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    revalidatePath("/accounting");
    revalidatePath("/reports");
    return { ok: true, id: orderId, net: netN, cogs: cogsN };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Post Dr cash/receivable, Cr revenue; Dr COGS, Cr inventory. Balanced array insert. */
async function postSalesJournal(
  c: ReturnType<typeof getSupabase> & object,
  orderId: string,
  tender: string,
  net: number,
  cogs: number,
): Promise<void> {
  try {
    const accR = await c.from("gl_account").select("id,code").eq("business_id", biz);
    if (accR.error || !accR.data) return;
    const byCode = new Map<string, string>();
    for (const a of accR.data) byCode.set(String(a.code), String(a.id));
    const cashCode = tender === "platform_paid" ? "1100" : "1000";
    const need = [cashCode, "4000", "5000", "1200"];
    if (need.some((code) => !byCode.has(code))) return;

    const jeR = await c
      .from("journal_entry")
      .insert({
        business_id: biz,
        description: `Sale ${orderId.slice(0, 8)}`,
        reference_type: "sales_order",
        reference_id: orderId,
      })
      .select("id")
      .single();
    if (jeR.error || !jeR.data) return;
    const entryId = String(jeR.data.id);

    const lines: { journal_entry_id: string; account_id: string; debit: number; credit: number }[] = [
      { journal_entry_id: entryId, account_id: byCode.get(cashCode)!, debit: net, credit: 0 },
      { journal_entry_id: entryId, account_id: byCode.get("4000")!, debit: 0, credit: net },
    ];
    if (cogs > 0) {
      lines.push({ journal_entry_id: entryId, account_id: byCode.get("5000")!, debit: cogs, credit: 0 });
      lines.push({ journal_entry_id: entryId, account_id: byCode.get("1200")!, debit: 0, credit: cogs });
    }
    // Single array insert = one transaction so the deferred balance check passes.
    await c.from("journal_line").insert(lines);
  } catch {
    // Journal is secondary; ignore failures.
  }
}

// ---------------------------------------------------------------------------
// Stock count → variance → adjustment movements
// ---------------------------------------------------------------------------
export interface CountLineInput {
  itemId: string;
  expectedBase: number;
  countedBase: number;
}
export async function submitCountAction(input: {
  lines: CountLineInput[];
}): Promise<Result & { adjusted?: number }> {
  try {
    const c = db();
    const lines = (input.lines ?? []).filter((l) => l.itemId);
    if (lines.length === 0) return { ok: false, error: "Nothing to count" };
    const locationId = await getDefaultLocationId();
    if (!locationId) return { ok: false, error: "No location configured" };

    const scR = await c
      .from("stock_count")
      .insert({ business_id: biz, location_id: locationId, count_type: "cycle", status: "approved", is_blind: true })
      .select("id")
      .single();
    if (scR.error) return { ok: false, error: scR.error.message };
    const countId = String(scR.data.id);

    // current WAC per item for valuing adjustments
    const cat = await loadCatalog();
    let adjusted = 0;
    for (const l of lines) {
      const delta = Number(l.countedBase) - Number(l.expectedBase);
      let movementId: string | null = null;
      if (delta !== 0) {
        const wac = cat?.wacByItem.get(l.itemId);
        const unitCost = wac && wac.quantityBase.greaterThan(0)
          ? Number(wac.totalValue.divide(wac.quantityBase).toDecimalValue().toString())
          : null;
        const value = unitCost != null ? money(new Decimal(Math.abs(delta)).times(unitCost)) : null;
        const mvR = await c
          .from("inventory_movement")
          .insert({
            business_id: biz,
            item_id: l.itemId,
            location_id: locationId,
            type: "count_adjustment",
            base_quantity_signed: delta,
            unit_cost: unitCost,
            value,
            reference_type: "stock_count",
            reference_id: countId,
            reason: "Count variance",
          })
          .select("id")
          .single();
        if (mvR.error) return { ok: false, error: mvR.error.message };
        movementId = String(mvR.data.id);
        adjusted += 1;
      }
      const lnR = await c.from("stock_count_line").insert({
        stock_count_id: countId,
        item_id: l.itemId,
        expected_base: Number(l.expectedBase),
        counted_base: Number(l.countedBase),
        adjustment_movement_id: movementId,
      });
      if (lnR.error) return { ok: false, error: lnR.error.message };
    }
    revalidatePath("/count");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, id: countId, adjusted };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
