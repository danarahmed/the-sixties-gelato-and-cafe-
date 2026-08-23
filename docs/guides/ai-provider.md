# Configuring an AI Provider

AI is **optional and non-authoritative**. With no key configured, POS,
inventory, production, purchasing, and accounting all work fully. AI only
explains, forecasts, classifies, and **recommends** — it never changes money or
stock. Every suggestion needs human approval, and every AI call is audited.

## Enable

1. Choose a provider and get an API key (Anthropic or OpenAI).
2. Set server-side environment variables (never client-side):
   ```
   AI_PROVIDER=anthropic        # or openai ; empty = disabled
   ANTHROPIC_API_KEY=...         # or OPENAI_API_KEY=...
   AI_MODEL=claude-sonnet-5      # optional; provider default if empty
   ```
3. Restart the app. **AI Insights** becomes active.

## What it does

Daily/hourly sales forecasts, demand by product/flavour/channel, suggested
purchase orders and par levels, gelato/bakery production planning, expiry/
overstock/understock risk, waste prediction, unusual variance and suspicious
void/discount/refund patterns, supplier price-change and settlement anomaly
detection, menu-engineering and pricing scenarios, and natural-language questions
("Which products made the most contribution last month?").

## Guardrails (by design)

- All money/inventory/accounting math stays deterministic in app code; AI cannot
  invent financial results.
- Human approval is **required** before creating a PO, changing a price or recipe,
  adjusting inventory, posting journals, publishing a promotion, or contacting a
  supplier.
- Each insight shows: recommendation, explanation, data used, confidence,
  forecast horizon, estimated impact, suggested action, and an approve control.
- Prompts, responses, model name/version, approval, and resulting actions are
  stored in an audit trail. Only minimal, non-sensitive data is sent to the
  provider — no secrets, no unnecessary personal or financial detail.

## Disable

Clear `AI_PROVIDER` (leave it empty) and restart. Everything else keeps working.
