import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';

import type { IAiDifference } from '@/modules/purchaseOrder/purchaseOrder.model';
import type { AI_RECOMMENDATION, AI_RISK } from '@/constants/status';

// ── Type defs ──────────────────────────────────────────────────────────────────
export interface GeminiVerificationOutput {
  matchPercentage: number;
  risk: typeof AI_RISK[keyof typeof AI_RISK];
  recommendation: typeof AI_RECOMMENDATION[keyof typeof AI_RECOMMENDATION];
  confidence: number;
  summary: string;
  differences: IAiDifference[];
}

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

// ── JSON extraction from Gemini response ──────────────────────────────────────
function extractJson(text: string): string {
  // Gemini sometimes wraps JSON in ```json ... ``` fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return (fenceMatch[1] ?? '').trim();
  // Or starts with { ... }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text.trim();
}

function validateOutput(raw: unknown): GeminiVerificationOutput {
  if (typeof raw !== 'object' || raw === null) throw new Error('Gemini returned non-object');

  const obj = raw as Record<string, unknown>;

  const matchPercentage = typeof obj.matchPercentage === 'number' ? obj.matchPercentage : 0;
  const risk = ['LOW', 'MEDIUM', 'HIGH'].includes(String(obj.risk)) ? String(obj.risk) as GeminiVerificationOutput['risk'] : 'HIGH';
  const recommendation = ['APPROVE', 'MANUAL_REVIEW', 'REJECT'].includes(String(obj.recommendation))
    ? String(obj.recommendation) as GeminiVerificationOutput['recommendation']
    : 'MANUAL_REVIEW';
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : 50;
  const summary = typeof obj.summary === 'string' ? obj.summary : 'AI analysis complete.';
  const differences: IAiDifference[] = Array.isArray(obj.differences)
    ? (obj.differences as IAiDifference[]).filter(
        (d) => d && typeof d.field === 'string',
      )
    : [];

  return { matchPercentage, risk, recommendation, confidence, summary, differences };
}

// ── Compare PO and Bill JSON via Gemini ───────────────────────────────────────
export async function verifyWithGemini(
  poJson: Record<string, unknown>,
  billJson: Record<string, unknown>,
  ruleEngineSummary: string,
): Promise<GeminiVerificationOutput> {
  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are an enterprise ERP accounts verification AI. Compare the Purchase Order and Invoice Bill below.

RULE ENGINE PRE-ANALYSIS:
${ruleEngineSummary}

PURCHASE ORDER:
${JSON.stringify(poJson, null, 2)}

INVOICE BILL:
${JSON.stringify(billJson, null, 2)}

TASK: Perform a detailed comparison and return STRICT JSON ONLY (no markdown, no explanation outside JSON):

{
  "matchPercentage": <0-100 integer>,
  "risk": "<LOW|MEDIUM|HIGH>",
  "recommendation": "<APPROVE|MANUAL_REVIEW|REJECT>",
  "confidence": <0-100 integer>,
  "summary": "<one paragraph summary for Accounts Department>",
  "differences": [
    {
      "field": "<field name>",
      "purchaseOrder": <PO value>,
      "bill": <Bill value>,
      "difference": "<description of difference>"
    }
  ]
}

RISK RULES:
- matchPercentage 95-100 → risk LOW
- matchPercentage 75-94  → risk MEDIUM
- matchPercentage < 75   → risk HIGH

RECOMMENDATION RULES:
- LOW risk and no critical issues → APPROVE
- MEDIUM risk or minor discrepancies → MANUAL_REVIEW
- HIGH risk or critical mismatches (vendor fraud, GST mismatch, large price differences) → REJECT

COMPARISON CHECKLIST (check all):
1. PO Number on Invoice vs PO Number
2. Vendor Name match
3. Vendor GST number match
4. Department
5. Item names, quantities, unit prices
6. GST amounts, tax amounts, discounts
7. Grand Total
8. Invoice date vs PO date (invoice should not pre-date PO)
9. Duplicate invoice risk
10. Arithmetic correctness (quantity × price = line total)
`;

  let result: GenerateContentResult;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    throw new Error(`Gemini API call failed: ${String(err)}`);
  }

  const rawText = result.response.text();
  const jsonStr = extractJson(rawText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${rawText.slice(0, 200)}`);
  }

  return validateOutput(parsed);
}

// ── Vision: extract text from an image file ───────────────────────────────────
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    {
      inlineData: { data: imageBase64, mimeType },
    },
    'Extract all text from this invoice image. Include invoice number, date, vendor details, PO number, all line items with quantities and prices, GST/tax amounts, and grand total. Return as structured text.',
  ]);

  return result.response.text();
}
