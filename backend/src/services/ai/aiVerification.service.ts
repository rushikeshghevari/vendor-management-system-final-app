import path from 'node:path';
import fs from 'node:fs';

import type { IPurchaseOrder, IAiVerification } from '@/modules/purchaseOrder/purchaseOrder.model';
import type { IBill } from '@/modules/bill/bill.model';
import { extractFromPdf, parseOcrResultFromGeminiText } from '@/services/ocr/ocr.service';
import { runRuleEngine, scoreToRisk } from '@/services/ruleEngine/ruleEngine.service';
import { verifyWithGemini, extractTextFromImage } from '@/services/ai/gemini.service';
import { AI_RECOMMENDATION, AI_RISK } from '@/constants/status';

export interface AiVerificationInput {
  po: IPurchaseOrder;
  bill: IBill & { vendorName?: string; vendorCode?: string; vendorGst?: string };
}

// ── Build PO summary for Gemini prompt ────────────────────────────────────────
function buildPoSummary(po: IPurchaseOrder): Record<string, unknown> {
  return {
    poNumber: po.poNumber,
    poDate: po.poDate,
    quotationCode: po.quotationCode,
    vendorName: po.vendorName,
    vendorGst: po.vendorGst,
    vendorAddress: po.vendorAddress,
    departmentName: po.departmentName,
    items: po.items.map((item) => ({
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      gstAmount: item.gstAmount,
      taxAmount: item.taxAmount,
      discount: item.discount,
      total: item.total,
    })),
    subtotal: po.subtotal,
    totalGst: po.totalGst,
    totalTax: po.totalTax,
    totalDiscount: po.totalDiscount,
    grandTotal: po.grandTotal,
  };
}

// ── Build Bill summary for Gemini prompt ──────────────────────────────────────
function buildBillSummary(
  bill: IBill & { vendorName?: string; vendorGst?: string },
  ocrData?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    billCode: bill.billCode,
    invoiceNumber: bill.invoiceNumber,
    invoiceDate: bill.invoiceDate,
    invoiceAmount: bill.invoiceAmount,
    taxableAmount: bill.taxableAmount,
    gstAmount: bill.gstAmount,
    vendorName: bill.vendorName ?? 'Unknown',
    vendorGst: bill.vendorGst ?? 'Unknown',
    ...(ocrData ?? {}),
  };
}

// ── Resolve actual file path from stored URL ───────────────────────────────────
function resolveFilePath(url: string): string {
  // URL like /uploads/bills/filename.pdf → <cwd>/uploads/bills/filename.pdf
  const relative = url.startsWith('/') ? url.slice(1) : url;
  return path.join(process.cwd(), relative);
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
export async function runAiVerification(input: AiVerificationInput): Promise<IAiVerification> {
  const { po, bill } = input;

  // ── Step 1: OCR on the latest invoice file ──────────────────────────────────
  let ocrResult: Awaited<ReturnType<typeof extractFromPdf>> | undefined;
  const latestInvoice = bill.invoiceFiles[bill.invoiceFiles.length - 1];

  if (latestInvoice) {
    const filePath = resolveFilePath(latestInvoice.url);
    const ext = path.extname(latestInvoice.fileName).toLowerCase();

    try {
      if (ext === '.pdf') {
        ocrResult = await extractFromPdf(filePath);
      } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        // Use Gemini Vision for images
        const imageBuffer = fs.readFileSync(filePath);
        const base64 = imageBuffer.toString('base64');
        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.png': 'image/png', '.webp': 'image/webp',
        };
        const geminiText = await extractTextFromImage(base64, mimeMap[ext] ?? 'image/jpeg');
        const extractedData = await parseOcrResultFromGeminiText(geminiText);
        ocrResult = { rawText: geminiText, extractedData, source: 'gemini-vision' };
      }
    } catch (err) {
      // OCR failure is non-fatal — we proceed without extracted data
      console.warn('[AI Verification] OCR failed, proceeding without extracted data:', err);
    }
  }

  // ── Step 2: Rule Engine (fast, deterministic comparison) ───────────────────
  const ruleResult = runRuleEngine(po, bill, ocrResult?.extractedData);

  // ── Step 3: AI (Gemini) ─────────────────────────────────────────────────────
  // If rule engine finds no differences, call Gemini only for a summary.
  // If differences exist, call Gemini for full analysis + recommendation.
  const geminiApiKey = process.env.GEMINI_API_KEY;
  let finalResult: IAiVerification;

  const poJson = buildPoSummary(po);
  const billJson = buildBillSummary(bill, ocrResult?.extractedData as unknown as Record<string, unknown>);

  const ruleEngineSummary = [
    `Rule Engine Score: ${ruleResult.score}/100`,
    `Critical Mismatches: ${ruleResult.criticalMismatches.join(', ') || 'None'}`,
    `Warnings: ${ruleResult.warnings.join(', ') || 'None'}`,
    `Differences found: ${ruleResult.differences.length}`,
  ].join('\n');

  if (geminiApiKey) {
    try {
      const geminiOutput = await verifyWithGemini(poJson, billJson, ruleEngineSummary);

      // Merge: use the higher of rule engine and Gemini scores for final match %
      const finalMatchPct = Math.round(
        (ruleResult.score * 0.4) + (geminiOutput.matchPercentage * 0.6),
      );

      // Merge differences: rule engine + Gemini deduplicated by field
      const allDiffs = [...ruleResult.differences];
      for (const gDiff of geminiOutput.differences) {
        const alreadyExists = allDiffs.some(
          (d) => d.field.toLowerCase() === gDiff.field.toLowerCase(),
        );
        if (!alreadyExists) allDiffs.push(gDiff);
      }

      finalResult = {
        matchPercentage: finalMatchPct,
        risk: geminiOutput.risk,
        recommendation: geminiOutput.recommendation,
        confidence: geminiOutput.confidence,
        summary: geminiOutput.summary,
        differences: allDiffs,
        ruleEngineScore: ruleResult.score,
        verifiedAt: new Date(),
        ocrExtractedData: ocrResult?.extractedData as unknown as Record<string, unknown>,
      };
    } catch (err) {
      // Gemini failure → fall back to rule engine only
      console.warn('[AI Verification] Gemini API failed, using rule engine only:', err);
      finalResult = buildRuleEngineOnlyResult(ruleResult, ocrResult?.extractedData as unknown as Record<string, unknown>);
    }
  } else {
    // No Gemini key → rule engine only
    finalResult = buildRuleEngineOnlyResult(ruleResult, ocrResult?.extractedData as unknown as Record<string, unknown>);
  }

  return finalResult;
}

function buildRuleEngineOnlyResult(
  ruleResult: ReturnType<typeof runRuleEngine>,
  ocrData?: Record<string, unknown>,
): IAiVerification {
  const risk = scoreToRisk(ruleResult.score);
  let recommendation: IAiVerification['recommendation'];

  if (ruleResult.score >= 95 && ruleResult.criticalMismatches.length === 0) {
    recommendation = AI_RECOMMENDATION.APPROVE;
  } else if (ruleResult.score >= 75 && ruleResult.criticalMismatches.length === 0) {
    recommendation = AI_RECOMMENDATION.MANUAL_REVIEW;
  } else {
    recommendation = ruleResult.criticalMismatches.length > 0
      ? AI_RECOMMENDATION.REJECT
      : AI_RECOMMENDATION.MANUAL_REVIEW;
  }

  const summaryParts: string[] = [];
  if (ruleResult.criticalMismatches.length > 0) {
    summaryParts.push(`Critical issues: ${ruleResult.criticalMismatches.join(', ')}.`);
  }
  if (ruleResult.warnings.length > 0) {
    summaryParts.push(`Warnings: ${ruleResult.warnings.join(', ')}.`);
  }
  if (summaryParts.length === 0) {
    summaryParts.push('Rule engine analysis complete. No significant differences detected.');
  }

  return {
    matchPercentage: ruleResult.score,
    risk: AI_RISK[risk],
    recommendation,
    confidence: 75,
    summary: summaryParts.join(' '),
    differences: ruleResult.differences,
    ruleEngineScore: ruleResult.score,
    verifiedAt: new Date(),
    ocrExtractedData: ocrData,
  };
}
