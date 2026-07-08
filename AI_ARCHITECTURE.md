# AI Architecture — Vendor Management System

## Overview

The AI module uses **Google Gemini 2.0 Flash** to perform semantic comparison of Purchase Orders against Vendor Invoices (Bills). The pipeline combines three stages: OCR extraction, deterministic Rule Engine validation, and Gemini AI semantic analysis. Accounts Department receives a final AI recommendation before making their own decision.

---

## Pipeline Flow

```
Bill Invoice (PDF / Image)
          │
          ▼
    ┌─────────────┐
    │  OCR Stage  │  ← pdf-parse (PDF) or Gemini Vision (Image)
    └──────┬──────┘
           │  ExtractedInvoiceData
           ▼
    ┌──────────────────┐
    │  Rule Engine     │  ← 7 deterministic checks (vendor, GST, totals, dates, items)
    │  (ruleEngine.    │     Produces score 0-100, criticalMismatches[], warnings[]
    │   service.ts)    │
    └──────┬───────────┘
           │  RuleEngineResult
           ▼
    ┌──────────────────┐
    │  Gemini AI       │  ← gemini-2.0-flash via @google/genai
    │  (gemini.        │     Receives: PO JSON + Bill JSON + Rule Engine summary
    │   service.ts)    │     Returns: matchScore, risk, recommendation, differences[]
    └──────┬───────────┘
           │  GeminiVerificationOutput
           ▼
    ┌──────────────────┐
    │  Score Merge     │  Rule Engine (40%) + Gemini (60%) = final matchPercentage
    │  Diff Merge      │  Union of Rule Engine + Gemini differences (deduplicated)
    └──────┬───────────┘
           │  IAiVerification
           ▼
    ┌──────────────────┐
    │  Store on PO     │  PurchaseOrder.aiVerification (MongoDB sub-document)
    └──────┬───────────┘
           │
           ├──► AI Audit Log  (AiAuditLog collection — prompt, tokens, timing, errors)
           │
           ▼
    ┌──────────────────┐
    │  Accounts        │  ComparisonScreen: shows AiVerificationCard
    │  Decision        │     Approve (Verified) / Request Correction / Reject
    └──────┬───────────┘
           │
           ▼
    ┌──────────────────┐
    │  Audit Log       │  AuditLog collection — Accounts decision + AI snapshot
    └──────────────────┘
```

---

## Security

- **GEMINI_API_KEY lives only on the backend.**  
  Never exposed to React Native clients. All Gemini calls are server-side only.
- The key is read from `process.env.GEMINI_API_KEY` via `backend/src/config/env.ts`.
- If the key is absent the system boots normally — fallback mode (see below).

---

## Configuration

| Variable | Location | Description |
|---|---|---|
| `GEMINI_API_KEY` | `backend/.env` | Google AI Studio API key. Optional — falls back to Rule Engine only. |
| `GEMINI_MODEL` | `backend/src/config/gemini.ts` | `gemini-2.0-flash` (change here for model upgrades) |
| `GEMINI_PROMPT_VERSION` | `backend/src/config/gemini.ts` | `2.0.0` — bump when prompt changes materially |
| `GEMINI_MAX_RETRIES` | `backend/src/config/gemini.ts` | `2` — retry attempts on transient API errors |
| `GEMINI_TIMEOUT_MS` | `backend/src/config/gemini.ts` | `45000` — hard timeout per Gemini call |
| `GEMINI_MAX_OUTPUT_TOKENS` | `backend/src/config/gemini.ts` | `4096` |

**SDK:** `@google/genai` (new official SDK — replaces deprecated `@google/generative-ai`).

---

## Prompt Engineering

### Comparison Fields (20 fields)

1. Vendor Name — semantic/fuzzy match
2. Vendor GST Number — exact match (fraud indicator)
3. Vendor PAN Number — if present
4. Invoice Number
5. Invoice Date (must not pre-date PO)
6. PO Number (must appear on invoice)
7. Department Name
8. Product / Service Names — semantic match
9. Quantity — exact numeric
10. Unit Rate — within 2% tolerance
11. Tax / TDS amounts
12. GST Rate and GST Amount — critical field
13. Discount
14. Grand Total — within 5% (>15% = critical)
15. HSN / SAC Codes
16. Payment Terms
17. Delivery Terms
18. Currency
19. Required / Delivery Date
20. Purchase / PO Date

### Severity Classification

| Severity | When |
|---|---|
| `HIGH` | Fraud risk, regulatory violation, >15% financial variance |
| `MEDIUM` | Significant discrepancy requiring manual review |
| `LOW` | Minor difference within tolerance |

### Response Format (strict JSON)

```json
{
  "matchScore": 95,
  "confidence": 98,
  "risk": "LOW",
  "recommendation": "APPROVE",
  "summary": "PO and Invoice match on all critical fields. Minor unit price variance on item 2.",
  "differences": [
    {
      "field": "GST Rate (Item 2)",
      "purchaseOrder": "18%",
      "bill": "12%",
      "difference": "GST rate differs by 6 percentage points",
      "severity": "HIGH"
    }
  ]
}
```

`responseMimeType: 'application/json'` is set on every call — Gemini is instructed to return pure JSON without any markdown fencing.

---

## Score Calculation

```
finalMatchPercentage = round( (ruleEngineScore × 0.4) + (geminiMatchScore × 0.6) )
```

The Rule Engine provides fast, precise arithmetic checks. Gemini adds semantic context and business reasoning. The weighted average balances both.

---

## Rate Limits & Performance

| Feature | Implementation |
|---|---|
| Singleton client | `getGeminiClient()` creates one `GoogleGenAI` instance, reused across requests |
| In-memory cache | 5-minute TTL keyed on `{poNumber}|{invoiceNumber}|{billCode}` — prevents duplicate calls |
| Retry policy | 2 retries with exponential back-off (1s, 2s) on transient API errors |
| Timeout | 45-second hard timeout via `Promise.race` — prevents hung requests |
| Token limit | 4096 output tokens — more than sufficient for PO/Bill JSON comparison |

---

## Fallback Behavior

If `GEMINI_API_KEY` is absent **or** Gemini returns an error:

1. The Rule Engine result alone is used (score, differences, risk).
2. `aiProvider` is set to `'rule_engine_only'` on the stored `IAiVerification`.
3. `usedFallback: true` is written to `AiAuditLog`.
4. The system **never crashes** — Accounts still sees a complete verification result.
5. A startup warning is printed:  
   `[AI] GEMINI_API_KEY is not set. Running in Rule Engine only mode.`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing API key | Rule Engine fallback, warning at startup |
| Gemini API timeout (>45s) | Rule Engine fallback, error logged, `errorMessage` written to AiAuditLog |
| Gemini returns invalid JSON | Retry up to 2 times; if all fail → Rule Engine fallback |
| OCR fails to read invoice | Proceeds without OCR data — Rule Engine runs without line-item checks |
| AI Audit Log write fails | Caught silently — verification result is NOT affected |

---

## AI Audit Log

Every AI verification run writes an `AiAuditLog` document:

| Field | Description |
|---|---|
| `purchaseOrder` | Reference to PO |
| `bill` | Reference to Bill |
| `triggeredBy` | User who triggered verification |
| `promptSnapshot` | First 8000 chars of the prompt sent to Gemini |
| `rawResponse` | First 5000 chars of Gemini's raw response |
| `executionTimeMs` | Total wall-clock time for the pipeline |
| `inputTokens` | Tokens consumed by the prompt |
| `outputTokens` | Tokens in Gemini's response |
| `totalTokens` | Combined token count |
| `matchPercentage` | Final weighted score |
| `risk` | `LOW` / `MEDIUM` / `HIGH` |
| `recommendation` | `APPROVE` / `MANUAL_REVIEW` / `REJECT` |
| `modelVersion` | e.g. `gemini-2.0-flash` |
| `promptVersion` | Semver of the prompt template, e.g. `2.0.0` |
| `success` | `true` if Gemini ran, `false` if fallback was used |
| `errorMessage` | Populated only on Gemini failure |
| `usedFallback` | `true` when Rule Engine only mode was used |

**API endpoints:**
- `GET /api/v1/ai-audit-logs` — Super Admin: full list with pagination
- `GET /api/v1/ai-audit-logs/po/:purchaseOrderId` — Accounts + Super Admin: logs for a specific PO

---

## Mobile Integration

### Accounts Screen (`ComparisonScreen`)

Shows `AiVerificationCard` with:
- Match % ring (color-coded: green ≥85%, amber ≥65%, red <65%)
- Risk badge: `LOW` / `MEDIUM` / `HIGH`
- Recommendation badge: `APPROVE` / `MANUAL_REVIEW` / `REJECT`
- Confidence %
- Metrics row: Rule Engine score | Differences count | Confidence
- Gemini metadata row (only when `aiProvider === 'gemini'`): Execution time | Model | Tokens
- AI summary paragraph
- Differences list with severity dots and badges
- Disclaimer: "AI assists. Accounts makes the final decision."

### Director Screen (`QuotationApprovalScreen`)

Shows a linked PO AI verification section with three states:

1. **AI results available** — full `AiVerificationCard` embedded below the approval buttons
2. **PO exists but AI pending** — amber card with pipeline stage indicators
3. **No PO yet** — slate card explaining when AI runs, with visual pipeline

---

## File Map

```
backend/
  src/
    config/
      gemini.ts                          ← Singleton client, model constants
    services/
      ai/
        gemini.service.ts                ← @google/genai, prompt, retry, cache, vision
        aiVerification.service.ts        ← Orchestrator: OCR → Rule Engine → Gemini → AiAuditLog
      ocr/
        ocr.service.ts                   ← pdf-parse + Gemini Vision OCR
      ruleEngine/
        ruleEngine.service.ts            ← 7 deterministic checks
    modules/
      purchaseOrder/
        purchaseOrder.model.ts           ← IAiVerification + IAiDifference (extended)
      aiAuditLog/
        aiAuditLog.model.ts              ← AI-specific audit log schema
        aiAuditLog.service.ts            ← CRUD
        aiAuditLog.controller.ts         ← REST handlers
        aiAuditLog.routes.ts             ← GET /ai-audit-logs, GET /ai-audit-logs/po/:id

mobile/
  src/
    features/
      purchaseOrders/
        types.ts                         ← AiVerification + AiTokenUsage (extended)
      aiVerification/
        components/
          AiVerificationCard.tsx         ← Full card: score, risk, rec, tokens, diffs
      quotations/
        screens/
          QuotationApprovalScreen.tsx    ← Live AI section (linked PO data)
```
