import { ROLES } from '@/constants/roles';
import { BILL_STATUS, QUOTATION_STATUS, type BillStatus } from '@/constants/status';
import { Bill, type IBill } from '@/modules/bill/bill.model';
import type {
  BillDecisionInput,
  BillFinancialDecisionInput,
  BillPaymentStatusInput,
  CreateBillInput,
  UpdateBillInput,
} from '@/modules/bill/bill.validation';
import { AuditLog } from '@/modules/auditLog/auditLog.model';
import { Department } from '@/modules/department/department.model';
import { notificationService } from '@/modules/notification/notification.service';
import { PurchaseOrder } from '@/modules/purchaseOrder/purchaseOrder.model';
import { Quotation } from '@/modules/quotation/quotation.model';
import { quotationService } from '@/modules/quotation/quotation.service';
import { User } from '@/modules/user/user.model';
import { runAiVerification } from '@/services/ai/aiVerification.service';
import type { Actor } from '@/types/actor';
import { ApiError } from '@/utils/ApiError';
import { escapeRegex } from '@/utils/escapeRegex';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';
import { nextSequence, seedSequenceFromExisting } from '@/utils/sequence.model';

// ── Status groups ──────────────────────────────────────────────────────────────

/** Statuses where a Department User may still edit / re-upload the bill. */
const EDITABLE_STATUSES: BillStatus[] = [
  BILL_STATUS.DRAFT,
  BILL_STATUS.DIRECTOR_CORRECTION,
  BILL_STATUS.CORRECTION_REQUESTED,
];

const PAYMENT_TRANSITIONS: Record<string, BillStatus> = {
  [BILL_STATUS.VERIFIED]:         BILL_STATUS.PAYMENT_PENDING,
  [BILL_STATUS.PAYMENT_PENDING]:  BILL_STATUS.PAID,
  [BILL_STATUS.PAID]:             BILL_STATUS.COMPLETED,
};

// ── Role-based visibility ──────────────────────────────────────────────────────

/**
 * Scopes the bill query to what each role should see:
 *  - Department User: only their own bills (all statuses).
 *  - Director: bills waiting for their Financial Approval (AI_VERIFIED) + any they already decided.
 *  - Accounts: bills the Director has approved — never the pre-approval stages.
 *  - Payment Department: bills ready for/in payment.
 *  - Super Admin: all bills (no filter).
 */
function scopeToOwner(actor: Actor, filter: Record<string, unknown>) {
  if (actor.role === ROLES.DEPARTMENT_USER) {
    filter.createdBy = actor.id;
  } else if (actor.role === ROLES.DIRECTOR) {
    // Directors see bills in any financial-approval-relevant state
    filter.status = {
      $in: [
        BILL_STATUS.AI_VERIFIED,
        BILL_STATUS.DIRECTOR_APPROVED,
        BILL_STATUS.DIRECTOR_REJECTED,
        BILL_STATUS.DIRECTOR_CORRECTION,
      ],
    };
  } else if (actor.role === ROLES.ACCOUNTS) {
    // Accounts only sees bills after Director Financial Approval
    filter.status = {
      $nin: [
        BILL_STATUS.DRAFT,
        BILL_STATUS.SUBMITTED,
        BILL_STATUS.AI_VERIFIED,
        BILL_STATUS.DIRECTOR_REJECTED,
        BILL_STATUS.DIRECTOR_CORRECTION,
      ],
    };
  } else if (actor.role === ROLES.PAYMENT_DEPARTMENT) {
    filter.status = {
      $in: [BILL_STATUS.VERIFIED, BILL_STATUS.PAYMENT_PENDING, BILL_STATUS.PAID],
    };
  }
}

// ── Bill code generator ────────────────────────────────────────────────────────

async function generateBillCode(departmentId: string): Promise<string> {
  const department = await Department.findById(departmentId).select('code');
  if (!department) throw ApiError.badRequest('Department not found for this bill');

  const prefix = (department.code.match(/^[A-Za-z]+/)?.[0] ?? 'BILL').toUpperCase();
  const codePrefix = `${prefix}-BILL`;
  const counterKey = `bill:${codePrefix}`;

  await seedSequenceFromExisting(counterKey, async () => {
    const existingCodes = await Bill.find({ billCode: new RegExp(`^${codePrefix}\\d+$`) })
      .select('billCode')
      .lean();
    return existingCodes.reduce((max, item) => {
      const num = parseInt(item.billCode.slice(codePrefix.length), 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
  });

  const sequence = await nextSequence(counterKey);
  return `${codePrefix}${String(sequence).padStart(3, '0')}`;
}

// ── Background AI pipeline ─────────────────────────────────────────────────────

/**
 * Runs the 3-way AI verification pipeline for a submitted bill.
 * Executed in the background — bill.submit() does NOT await this.
 *
 * Flow:
 *  1. Find the linked PO and Quotation.
 *  2. Run AI (OCR → Rule Engine → Gemini 3-way).
 *  3. Store results on the PO.
 *  4. Transition bill to AI_VERIFIED.
 *  5. Notify all Directors — "Bill Financial Approval Required".
 *  6. If AI risk is HIGH → send additional "High Risk Alert" notification.
 */
async function runAiPipelineForBill(bill: IBill, actor: Actor): Promise<void> {
  const billId = String(bill._id);

  try {
    // Find linked PO
    const po = await PurchaseOrder.findOne({ quotation: bill.quotation, isDeleted: false });
    if (!po) {
      console.warn(`[Bill AI] No PO found for bill ${bill.billCode} — skipping AI`);
      return;
    }

    // Find Quotation for 3-way comparison
    const quotation = await Quotation.findById(bill.quotation);

    // Populate vendor on the bill for the AI service
    const billWithVendor = await Bill.findById(billId)
      .populate<{ vendor: { name: string; gstNumber?: string } }>('vendor', 'name gstNumber')
      .lean();
    if (!billWithVendor) return;

    const enrichedBill = {
      ...billWithVendor,
      vendorName: (billWithVendor.vendor as unknown as { name: string })?.name ?? '',
      vendorGst:  (billWithVendor.vendor as unknown as { gstNumber?: string })?.gstNumber ?? '',
    };

    // Run AI (sets PO status to ai_verification_pending, then ai_verified)
    const { PO_STATUS } = await import('@/constants/status');
    po.status = PO_STATUS.AI_VERIFICATION_PENDING;
    await po.save();

    const aiResult = await runAiVerification({
      po,
      bill: enrichedBill as unknown as Parameters<typeof runAiVerification>[0]['bill'],
      quotation: quotation ?? undefined,
      actor,
    });

    // Store AI results on PO
    po.aiVerification = aiResult;
    po.status = PO_STATUS.AI_VERIFIED;
    po.bill = bill._id as unknown as typeof po.bill;
    await po.save();

    // Transition bill to AI_VERIFIED
    await Bill.findByIdAndUpdate(billId, { status: BILL_STATUS.AI_VERIFIED });

    // Notify all active Directors — Financial Approval Required
    const directors = await notificationService.findActiveUsersByRole(ROLES.DIRECTOR);
    if (directors.length > 0) {
      await notificationService.notifyUsers(directors, {
        title: 'Bill Financial Approval Required',
        message: `Bill ${bill.billCode} has passed AI verification (${aiResult.matchPercentage}% match, Risk: ${aiResult.risk}). Your financial approval is required.`,
        module: 'bill',
        relatedRecord: billId,
        notificationType: 'bill_financial_approval_required',
        sender: actor.id,
      });
    }

    // Extra HIGH-risk alert to Directors + Super Admins
    if (aiResult.risk === 'HIGH') {
      const superAdmins = await notificationService.findActiveUsersByRole(ROLES.SUPER_ADMIN);
      const alertRecipients = [...directors, ...superAdmins];
      if (alertRecipients.length > 0) {
        await notificationService.notifyUsers(alertRecipients, {
          title: 'High Risk Bill Alert',
          message: `Bill ${bill.billCode} flagged HIGH RISK by AI. Recommendation: ${aiResult.recommendation}. Immediate review required.`,
          module: 'bill',
          relatedRecord: billId,
          notificationType: 'ai_high_risk_alert',
          sender: actor.id,
        });
      }
    }

    // Notify bill owner of AI completion
    await notificationService.notifyUser(
      { id: bill.createdBy.toString(), role: ROLES.DEPARTMENT_USER },
      {
        title: 'Bill AI Verification Complete',
        message: `Bill ${bill.billCode} has been verified by AI (${aiResult.matchPercentage}% match). Awaiting Director Financial Approval.`,
        module: 'bill',
        relatedRecord: billId,
        notificationType: 'bill_ai_verified',
        sender: actor.id,
      },
    );
  } catch (err) {
    console.error(`[Bill AI] Pipeline failed for bill ${bill.billCode}:`, err);
    // Even on failure, attempt to revert bill to a visible error state
    try {
      await Bill.findByIdAndUpdate(billId, { status: BILL_STATUS.SUBMITTED });
    } catch { /* non-fatal */ }
  }
}

// ── billService ────────────────────────────────────────────────────────────────

export const billService = {
  /** A Bill can only be created from an Approved Quotation the creator owns; one Bill per Quotation. */
  async create(input: CreateBillInput, actor: Actor) {
    if (actor.role !== ROLES.DEPARTMENT_USER || !actor.department) {
      throw ApiError.forbidden('Only a Department User can create a bill');
    }

    const quotation = await Quotation.findById(input.quotation);
    if (!quotation || quotation.isDeleted) throw ApiError.badRequest('Quotation not found');
    if (quotation.createdBy.toString() !== actor.id) {
      throw ApiError.forbidden('You can only create a bill for a quotation you created');
    }
    if (quotation.status !== QUOTATION_STATUS.APPROVED) {
      throw ApiError.badRequest('A bill can only be created for an Approved quotation');
    }

    // Amount validation — PO is the legal document once generated
    const linkedPo = await PurchaseOrder.findOne({ quotation: quotation.id, isDeleted: false });
    if (linkedPo) {
      const agg = await Bill.aggregate<{ total: number }>([
        { $match: { quotation: quotation._id, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$invoiceAmount' } } },
      ]);
      const alreadyBilled = agg[0]?.total ?? 0;
      const remaining = linkedPo.grandTotal - alreadyBilled;
      if (input.invoiceAmount > remaining) {
        throw ApiError.badRequest(
          `Bill amount (₹${input.invoiceAmount.toLocaleString('en-IN')}) exceeds remaining PO balance ` +
          `(₹${remaining.toLocaleString('en-IN')} of ₹${linkedPo.grandTotal.toLocaleString('en-IN')})`,
        );
      }
    } else {
      const quotationGstTotal = Math.round(quotation.amount * (1 + (quotation.gst ?? 0) / 100));
      if (input.invoiceAmount > quotationGstTotal) {
        throw ApiError.badRequest(
          `Bill amount (₹${input.invoiceAmount.toLocaleString('en-IN')}) exceeds Quotation total ` +
          `including GST (₹${quotationGstTotal.toLocaleString('en-IN')})`,
        );
      }
    }

    const existingBill = await Bill.findOne({ quotation: quotation.id, isDeleted: { $ne: true } });
    if (existingBill) throw ApiError.conflict('Bill already created for this quotation.');

    const billCode = await generateBillCode(actor.department);

    const bill = await Bill.create({
      ...input,
      billCode,
      vendor: quotation.vendor,
      department: actor.department,
      createdBy: actor.id,
      status: BILL_STATUS.DRAFT,
    });

    await quotationService.transitionStatus(quotation.id, [QUOTATION_STATUS.APPROVED], QUOTATION_STATUS.BILLED);

    return bill;
  },

  async list(query: Record<string, unknown>, actor: Actor) {
    const pagination = parsePagination(query);
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };

    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.vendor) filter.vendor = query.vendor;
    if (query.quotation) filter.quotation = query.quotation;
    if (query.search) {
      filter.billCode = new RegExp(escapeRegex(String(query.search).trim()), 'i');
    }
    if (query.dateFrom || query.dateTo) {
      const invoiceDate: Record<string, Date> = {};
      if (query.dateFrom) invoiceDate.$gte = query.dateFrom as Date;
      if (query.dateTo) invoiceDate.$lte = query.dateTo as Date;
      filter.invoiceDate = invoiceDate;
    }

    scopeToOwner(actor, filter);

    const [items, total] = await Promise.all([
      Bill.find(filter)
        .populate('vendor', 'name code category status')
        .populate('department', 'name code')
        .populate('quotation', 'quotationCode status amount gst')
        .populate('createdBy', 'name email')
        .populate('verifiedBy', 'name email')
        .populate('directorFinancialBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Bill.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, pagination) };
  },

  async getById(id: string, actor: Actor) {
    const filter: Record<string, unknown> = { _id: id, isDeleted: { $ne: true } };
    scopeToOwner(actor, filter);

    const bill = await Bill.findOne(filter)
      .populate('vendor')
      .populate('department', 'name code')
      .populate('quotation')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('directorFinancialBy', 'name email')
      .populate('decisionHistory.decidedBy', 'name email');

    if (!bill) throw ApiError.notFound('Bill not found');
    return bill;
  },

  async update(id: string, input: UpdateBillInput, actor: Actor) {
    if (actor.role !== ROLES.DEPARTMENT_USER) {
      throw ApiError.forbidden('Only a Department User can edit a bill');
    }

    const bill = await Bill.findOneAndUpdate(
      {
        _id: id,
        createdBy: actor.id,
        status: { $in: EDITABLE_STATUSES },
        isDeleted: { $ne: true },
      },
      input,
      { new: true, runValidators: true },
    );
    if (!bill) throw ApiError.notFound('Bill not found, or it is no longer editable');
    return bill;
  },

  /**
   * Department User submits a Draft (or Director-Correction) bill for AI verification.
   * Requires an invoice PDF to be uploaded first.
   *
   * The bill immediately enters SUBMITTED status and the AI pipeline fires in the background.
   * This endpoint returns fast — AI completes asynchronously and transitions to AI_VERIFIED.
   */
  async submit(id: string, actor: Actor) {
    if (actor.role !== ROLES.DEPARTMENT_USER) {
      throw ApiError.forbidden('Only a Department User can submit a bill');
    }

    const bill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: BILL_STATUS.DRAFT,
      isDeleted: { $ne: true },
    });
    if (!bill) throw ApiError.notFound('Bill not found, or it is not in Draft status');
    if (bill.invoiceFiles.length === 0) {
      throw ApiError.badRequest('An invoice PDF must be uploaded before submitting this bill');
    }

    bill.status = BILL_STATUS.SUBMITTED;
    bill.submittedAt = new Date();
    await bill.save();

    // Fire AI pipeline in background — does NOT block this response
    runAiPipelineForBill(bill, actor).catch((err) =>
      console.error('[Bill Submit] Background AI pipeline error:', err),
    );

    return bill;
  },

  /**
   * Re-submit from DIRECTOR_CORRECTION — same validation, restarts the full AI pipeline.
   * Re-submit from CORRECTION_REQUESTED (Accounts) — skips AI, goes directly back to Accounts.
   */
  async resubmit(id: string, actor: Actor) {
    if (actor.role !== ROLES.DEPARTMENT_USER) {
      throw ApiError.forbidden('Only a Department User can resubmit a bill');
    }

    // From Director Correction → re-run AI pipeline
    const correctionBill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: BILL_STATUS.DIRECTOR_CORRECTION,
      isDeleted: { $ne: true },
    });

    if (correctionBill) {
      if (correctionBill.invoiceFiles.length === 0) {
        throw ApiError.badRequest('An invoice PDF must be uploaded before resubmitting');
      }
      correctionBill.status = BILL_STATUS.SUBMITTED;
      correctionBill.submittedAt = new Date();
      await correctionBill.save();

      runAiPipelineForBill(correctionBill, actor).catch((err) =>
        console.error('[Bill Resubmit] Background AI pipeline error:', err),
      );

      return correctionBill;
    }

    // From Accounts Correction → skip AI, go back to Director Approved (Accounts sees it again)
    const accountsCorrectionBill = await Bill.findOneAndUpdate(
      {
        _id: id,
        createdBy: actor.id,
        status: BILL_STATUS.CORRECTION_REQUESTED,
        isDeleted: { $ne: true },
      },
      { status: BILL_STATUS.DIRECTOR_APPROVED },
      { new: true },
    );
    if (!accountsCorrectionBill) {
      throw ApiError.notFound('Bill not found or not in a resubmittable status');
    }

    // Notify Accounts that the bill is back for verification
    const accountsUsers = await notificationService.findActiveUsersByRole(ROLES.ACCOUNTS);
    await notificationService.notifyUsers(accountsUsers, {
      title: 'Bill Resubmitted for Verification',
      message: `Bill ${accountsCorrectionBill.billCode} has been resubmitted and is ready for Accounts verification.`,
      module: 'bill',
      relatedRecord: String(accountsCorrectionBill._id),
      notificationType: 'bill_submitted',
      sender: actor.id,
    });

    return accountsCorrectionBill;
  },

  /**
   * Director-only — Financial Approval (Approval 2).
   * Triggered after 3-Way AI verification. Decisions: approved, rejected, correction_required.
   * Only one Director needs to act (not a full roster like Quotation dual-Director approval).
   */
  async decideFinancialApproval(id: string, input: BillFinancialDecisionInput, actor: Actor) {
    if (actor.role !== ROLES.DIRECTOR) {
      throw ApiError.forbidden('Only a Director can make a financial approval decision on a bill');
    }

    const bill = await Bill.findOne({
      _id: id,
      status: BILL_STATUS.AI_VERIFIED,
      isDeleted: { $ne: true },
    });
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is not awaiting Director Financial Approval');
    }

    const now = new Date();
    const newStatus: BillStatus =
      input.decision === 'approved'            ? BILL_STATUS.DIRECTOR_APPROVED  :
      input.decision === 'rejected'            ? BILL_STATUS.DIRECTOR_REJECTED  :
      /* correction_required */                  BILL_STATUS.DIRECTOR_CORRECTION;

    bill.directorFinancialDecision = input.decision;
    bill.directorFinancialBy       = actor.id as unknown as IBill['directorFinancialBy'];
    bill.directorFinancialAt       = now;
    bill.directorFinancialRemarks  = input.remarks;
    bill.status                    = newStatus;
    bill.decisionAt                = now;
    await bill.save();

    const ownerId = bill.createdBy.toString();
    const relatedRecord = String(bill._id);

    if (input.decision === 'approved') {
      // Notify Accounts — bill is ready for verification
      const accountsUsers = await notificationService.findActiveUsersByRole(ROLES.ACCOUNTS);
      await notificationService.notifyUsers(accountsUsers, {
        title: 'Bill Ready for Verification',
        message: `Bill ${bill.billCode} has been financially approved by Director. Please verify.`,
        module: 'bill',
        relatedRecord,
        notificationType: 'bill_financial_approved',
        sender: actor.id,
      });
      // Notify Department User
      await notificationService.notifyUser(
        { id: ownerId, role: ROLES.DEPARTMENT_USER },
        {
          title: 'Bill Financially Approved',
          message: `Your bill ${bill.billCode} has been approved by the Director and sent to Accounts for verification.`,
          module: 'bill',
          relatedRecord,
          notificationType: 'bill_financial_approved',
          sender: actor.id,
        },
      );
    } else if (input.decision === 'rejected') {
      await notificationService.notifyUser(
        { id: ownerId, role: ROLES.DEPARTMENT_USER },
        {
          title: 'Bill Financially Rejected',
          message: `Your bill ${bill.billCode} has been rejected by the Director.${input.remarks ? ` Reason: ${input.remarks}` : ''}`,
          module: 'bill',
          relatedRecord,
          notificationType: 'bill_financial_rejected',
          sender: actor.id,
        },
      );
    } else {
      // correction_required
      await notificationService.notifyUser(
        { id: ownerId, role: ROLES.DEPARTMENT_USER },
        {
          title: 'Bill Correction Required',
          message: `Director has requested corrections on bill ${bill.billCode}.${input.remarks ? ` Remarks: ${input.remarks}` : ''} Please update and resubmit.`,
          module: 'bill',
          relatedRecord,
          notificationType: 'bill_director_correction_required',
          sender: actor.id,
        },
      );
    }

    return bill;
  },

  /**
   * Accounts-only — 3-way verification decision.
   * Bill must be DIRECTOR_APPROVED before Accounts can act.
   * Every decision is recorded in `decisionHistory` for full audit trail.
   */
  async decide(id: string, input: BillDecisionInput, actor: Actor) {
    if (actor.role !== ROLES.ACCOUNTS) {
      throw ApiError.forbidden('Only Accounts can decide on a bill');
    }

    const now = new Date();
    const isVerified = input.decision === BILL_STATUS.VERIFIED;

    const bill = await Bill.findOneAndUpdate(
      { _id: id, status: BILL_STATUS.DIRECTOR_APPROVED, isDeleted: { $ne: true } },
      {
        status: input.decision,
        accountsRemarks: input.remarks,
        decisionAt: now,
        ...(isVerified ? { verifiedBy: actor.id, verifiedAt: now } : {}),
        $push: {
          decisionHistory: {
            decision: input.decision,
            remarks: input.remarks,
            decidedBy: actor.id,
            decidedAt: now,
          },
        },
      },
      { new: true },
    );
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is not awaiting Accounts verification');
    }

    // Write audit log
    const po = await PurchaseOrder.findOne({ quotation: bill.quotation, isDeleted: false });
    if (po) {
      const decidedByUser = await User.findById(actor.id).select('name').lean();
      await AuditLog.create({
        purchaseOrder:              po._id,
        bill:                       bill._id,
        quotation:                  bill.quotation,
        aiRecommendation:           po.aiVerification?.recommendation ?? 'MANUAL_REVIEW',
        aiConfidence:               po.aiVerification?.confidence     ?? 0,
        matchPercentage:            po.aiVerification?.matchPercentage ?? 0,
        quotationMatch:             po.aiVerification?.quotationMatch,
        purchaseOrderMatch:         po.aiVerification?.purchaseOrderMatch,
        risk:                       po.aiVerification?.risk            ?? 'HIGH',
        differenceCount:            po.aiVerification?.differences.length ?? 0,
        differences:                po.aiVerification?.differences     ?? [],
        directorFinancialDecision:  bill.directorFinancialDecision,
        directorFinancialBy:        bill.directorFinancialBy,
        directorFinancialRemarks:   bill.directorFinancialRemarks,
        directorFinancialAt:        bill.directorFinancialAt,
        accountsDecision:           input.decision,
        reason:                     input.remarks,
        decidedBy:                  actor.id,
        decidedByName:              (decidedByUser as { name?: string } | null)?.name ?? 'Accounts',
        decidedByRole:              actor.role,
        decidedAt:                  now,
      }).catch((err) => console.error('[Bill Decide] Audit log write failed:', err));
    }

    if (isVerified) {
      const paymentUsers = await notificationService.findActiveUsersByRole(ROLES.PAYMENT_DEPARTMENT);
      await notificationService.notifyUsers(paymentUsers, {
        title: 'Bill Verified — Ready for Payment',
        message: `Bill ${bill.billCode} has been verified by Accounts and is ready for payment.`,
        module: 'bill',
        relatedRecord: bill.id,
        notificationType: 'bill_verified',
        sender: actor.id,
      });
      await notificationService.notifyUser(
        { id: bill.createdBy.toString(), role: ROLES.DEPARTMENT_USER },
        {
          title: 'Bill Verified',
          message: `Bill ${bill.billCode} verified by Accounts. Sent to Payment Department.`,
          module: 'bill',
          relatedRecord: bill.id,
          notificationType: 'bill_verified',
          sender: actor.id,
        },
      );
    }

    return bill;
  },

  // ── Dashboard stats ──────────────────────────────────────────────────────────

  /** Accounts dashboard — only bills that cleared Director Financial Approval. */
  async getAccountsStats(actor: Actor) {
    if (actor.role !== ROLES.ACCOUNTS) {
      throw ApiError.forbidden('Only Accounts can view this dashboard');
    }

    const base = {
      isDeleted: { $ne: true },
      status: {
        $nin: [
          BILL_STATUS.DRAFT,
          BILL_STATUS.SUBMITTED,
          BILL_STATUS.AI_VERIFIED,
          BILL_STATUS.DIRECTOR_REJECTED,
          BILL_STATUS.DIRECTOR_CORRECTION,
        ],
      },
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingVerification, correctionRequested, verifiedToday, rejected, total, totalVerified] =
      await Promise.all([
        Bill.countDocuments({ ...base, status: BILL_STATUS.DIRECTOR_APPROVED }),
        Bill.countDocuments({ ...base, status: BILL_STATUS.CORRECTION_REQUESTED }),
        Bill.countDocuments({ ...base, status: BILL_STATUS.VERIFIED, verifiedAt: { $gte: today } }),
        Bill.countDocuments({ ...base, status: BILL_STATUS.REJECTED }),
        Bill.countDocuments(base),
        Bill.countDocuments({ ...base, verifiedBy: { $exists: true } }),
      ]);

    return { pendingVerification, correctionRequested, verifiedToday, rejected, total, totalVerified };
  },

  /** Payment Department dashboard. */
  async getPaymentStats(actor: Actor) {
    if (actor.role !== ROLES.PAYMENT_DEPARTMENT) {
      throw ApiError.forbidden('Only Payment Department can view this dashboard');
    }

    const base = { isDeleted: { $ne: true } };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [readyForPayment, paymentPending, paidToday, completed] = await Promise.all([
      Bill.countDocuments({ ...base, status: BILL_STATUS.VERIFIED }),
      Bill.countDocuments({ ...base, status: BILL_STATUS.PAYMENT_PENDING }),
      Bill.countDocuments({ ...base, status: BILL_STATUS.PAID, updatedAt: { $gte: today } }),
      Bill.countDocuments({ ...base, status: BILL_STATUS.COMPLETED }),
    ]);

    return { readyForPayment, paymentPending, paidToday, completed };
  },

  /** Director dashboard — bills awaiting Financial Approval, plus today's decisions. */
  async getDirectorStats(actor: Actor) {
    if (actor.role !== ROLES.DIRECTOR) {
      throw ApiError.forbidden('Only a Director can view this dashboard');
    }

    const base = { isDeleted: { $ne: true } };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingFinancialApprovals, approvedToday, rejectedToday, correctionToday, highRiskBills] =
      await Promise.all([
        Bill.countDocuments({ ...base, status: BILL_STATUS.AI_VERIFIED }),
        Bill.countDocuments({ ...base, status: BILL_STATUS.DIRECTOR_APPROVED, directorFinancialAt: { $gte: today } }),
        Bill.countDocuments({ ...base, status: BILL_STATUS.DIRECTOR_REJECTED, directorFinancialAt: { $gte: today } }),
        Bill.countDocuments({ ...base, status: BILL_STATUS.DIRECTOR_CORRECTION, directorFinancialAt: { $gte: today } }),
        // High-risk AI-verified bills
        Bill.countDocuments({ ...base, status: BILL_STATUS.AI_VERIFIED }),
      ]);

    return { pendingFinancialApprovals, approvedToday, rejectedToday, correctionToday, highRiskBills };
  },

  /**
   * Payment Department — update bill payment status.
   * Requires bill.status === VERIFIED (i.e. Director approved + Accounts verified).
   */
  async updatePaymentStatus(
    id: string,
    input: BillPaymentStatusInput,
    actor: Actor,
    options: { suppressNotifications?: boolean } = {},
  ) {
    if (actor.role !== ROLES.PAYMENT_DEPARTMENT) {
      throw ApiError.forbidden('Only Payment Department can update a bill payment status');
    }

    const requiredCurrentStatus = (Object.entries(PAYMENT_TRANSITIONS) as [BillStatus, BillStatus][]).find(
      ([, next]) => next === input.status,
    )?.[0];
    if (!requiredCurrentStatus) throw ApiError.badRequest('Invalid payment status transition');

    const bill = await Bill.findOneAndUpdate(
      { _id: id, status: requiredCurrentStatus, isDeleted: { $ne: true } },
      { status: input.status },
      { new: true },
    );
    if (!bill) {
      throw ApiError.conflict(`Bill cannot transition to "${input.status}" from its current status`);
    }

    if (!options.suppressNotifications) {
      const NOTIFICATION_TYPES: Partial<Record<BillStatus, 'payment_pending' | 'payment_paid' | 'payment_completed'>> = {
        [BILL_STATUS.PAYMENT_PENDING]: 'payment_pending',
        [BILL_STATUS.PAID]:            'payment_paid',
        [BILL_STATUS.COMPLETED]:       'payment_completed',
      };
      const NOTIFICATION_TITLES: Partial<Record<BillStatus, string>> = {
        [BILL_STATUS.PAYMENT_PENDING]: 'Payment Pending',
        [BILL_STATUS.PAID]:            'Payment Paid',
        [BILL_STATUS.COMPLETED]:       'Payment Completed',
      };
      const notificationType = NOTIFICATION_TYPES[input.status];
      if (notificationType) {
        await notificationService.notifyUser(
          { id: bill.createdBy.toString(), role: ROLES.DEPARTMENT_USER },
          {
            title: NOTIFICATION_TITLES[input.status]!,
            message: `Bill ${bill.billCode} payment status updated to "${NOTIFICATION_TITLES[input.status]}".`,
            module: 'bill',
            relatedRecord: bill.id,
            notificationType,
            sender: actor.id,
          },
        );
      }
    }

    return bill;
  },

  async uploadInvoice(id: string, fileName: string, url: string, actor: Actor) {
    const bill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: { $in: EDITABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!bill) throw ApiError.notFound('Bill not found, or it is no longer editable');

    const version = bill.invoiceFiles.length + 1;
    bill.invoiceFiles.push({ version, fileName, url, uploadedAt: new Date() });
    await bill.save();
    return bill;
  },

  async uploadSupportingDocument(id: string, fileName: string, url: string, actor: Actor) {
    const bill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: { $in: EDITABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!bill) throw ApiError.notFound('Bill not found, or it is no longer editable');

    const version = bill.supportingDocuments.length + 1;
    bill.supportingDocuments.push({ version, fileName, url, uploadedAt: new Date() });
    await bill.save();
    return bill;
  },

  async remove(id: string, actor: Actor) {
    const bill = await Bill.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: BILL_STATUS.DRAFT, isDeleted: { $ne: true } },
      { isDeleted: true },
      { new: true },
    );
    if (!bill) throw ApiError.notFound('Bill not found, or only a Draft bill can be deleted');

    await quotationService.transitionStatus(
      bill.quotation.toString(),
      [QUOTATION_STATUS.BILLED],
      QUOTATION_STATUS.APPROVED,
    );

    return bill;
  },
};
