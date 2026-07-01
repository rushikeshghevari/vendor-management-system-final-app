import { ROLES } from '@/constants/roles';
import { BILL_STATUS, QUOTATION_STATUS, type BillStatus } from '@/constants/status';
import { Bill, type IBill } from '@/modules/bill/bill.model';
import type {
  BillApprovalDecisionInput,
  BillDecisionInput,
  BillPaymentStatusInput,
  CreateBillInput,
  UpdateBillInput,
} from '@/modules/bill/bill.validation';
import { Department } from '@/modules/department/department.model';
import { notificationService } from '@/modules/notification/notification.service';
import { Quotation } from '@/modules/quotation/quotation.model';
import { quotationService } from '@/modules/quotation/quotation.service';
import { settingService } from '@/modules/setting/setting.service';
import { User } from '@/modules/user/user.model';
import type { Actor } from '@/types/actor';
import { ApiError } from '@/utils/ApiError';
import { isRosterFullyApproved } from '@/utils/approvalRoster';
import { escapeRegex } from '@/utils/escapeRegex';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';
import { nextSequence, seedSequenceFromExisting } from '@/utils/sequence.model';

export type BillApprovalRoute = 'ceo' | 'directors';

// A Department User can edit/re-upload during Draft and, mirroring Quotation, while a
// Negotiation (CEO/Director approval stage) is in progress.
const EDITABLE_STATUSES = [BILL_STATUS.DRAFT, BILL_STATUS.NEGOTIATION, BILL_STATUS.CORRECTION_REQUESTED];
// Mirrors quotation.service.ts's DECIDABLE_STATUSES exactly, for the CEO/Director stage.
const APPROVAL_DECIDABLE_STATUSES: BillStatus[] = [
  BILL_STATUS.SUBMITTED,
  BILL_STATUS.NEGOTIATION,
  BILL_STATUS.RESUBMITTED,
  BILL_STATUS.APPROVED,
  BILL_STATUS.APPROVAL_REJECTED,
];
const PAYMENT_TRANSITIONS: Record<string, BillStatus> = {
  [BILL_STATUS.VERIFIED]: BILL_STATUS.PAYMENT_PENDING,
  [BILL_STATUS.PAYMENT_PENDING]: BILL_STATUS.PAID,
  [BILL_STATUS.PAID]: BILL_STATUS.COMPLETED,
};

/** Amount <= the configured CEO Approval Limit routes to the CEO alone; above it, both
 *  Directors must approve. Identical logic to quotationService's own resolveApprovalRoute,
 *  reusing the exact same setting — never stored on the bill, always computed live. */
function resolveApprovalRoute(amount: number, ceoApprovalLimit: number): BillApprovalRoute {
  return amount <= ceoApprovalLimit ? 'ceo' : 'directors';
}

/**
 * Bill visibility, like Quotation visibility, is per-creator for Department Users.
 * Directors/CEO now review Bills the same way they review Quotations — only within their
 * own approval route, and never a Draft. Accounts only ever sees a Bill once it has cleared
 * CEO/Director approval (`approved` onward) — never Draft/Submitted/Negotiation/Resubmitted,
 * and never the upstream `approval_rejected` outcome (that's distinct from Accounts' own,
 * pre-existing `rejected` decision, which Accounts can of course still see — see bill.model.ts
 * for why these are two separate stored values). Payment Department only needs bills that
 * have cleared Accounts verification.
 */
function scopeToOwner(actor: Actor, filter: Record<string, unknown>, ceoApprovalLimit: number) {
  if (actor.role === ROLES.DEPARTMENT_USER) {
    filter.createdBy = actor.id;
  } else if (actor.role === ROLES.DIRECTOR) {
    filter.status = { $ne: BILL_STATUS.DRAFT };
    filter.invoiceAmount = { $gt: ceoApprovalLimit };
  } else if (actor.role === ROLES.CEO) {
    filter.status = { $ne: BILL_STATUS.DRAFT };
    filter.invoiceAmount = { $lte: ceoApprovalLimit };
  } else if (actor.role === ROLES.ACCOUNTS) {
    filter.status = {
      $nin: [BILL_STATUS.DRAFT, BILL_STATUS.SUBMITTED, BILL_STATUS.NEGOTIATION, BILL_STATUS.RESUBMITTED, BILL_STATUS.APPROVAL_REJECTED],
    };
  } else if (actor.role === ROLES.PAYMENT_DEPARTMENT) {
    filter.status = { $in: [BILL_STATUS.VERIFIED, BILL_STATUS.PAYMENT_PENDING, BILL_STATUS.PAID] };
  }
}

type ApproverRecord = { _id: unknown; name: string; isActive: boolean; role: string; createdAt: Date };

/** Mirrors quotation.service.ts's fetchApproversForRoster exactly, operating on `billApprovals`. */
async function fetchApproversForRoster(bills: IBill[]): Promise<ApproverRecord[]> {
  const decidedIds = new Set<string>();
  bills.forEach((bill) => bill.billApprovals.forEach((entry) => decidedIds.add(entry.approver.toString())));

  return User.find({
    $or: [{ role: { $in: [ROLES.DIRECTOR, ROLES.CEO] }, isActive: true }, { _id: { $in: [...decidedIds] } }],
  })
    .select('name isActive role createdAt')
    .lean();
}

/** Mirrors quotation.service.ts's mergeDirectorApprovals exactly, operating on `billApprovals`. */
function mergeBillApprovals(bill: IBill, approvers: ApproverRecord[], route: BillApprovalRoute) {
  const routeRole = route === 'ceo' ? ROLES.CEO : ROLES.DIRECTOR;
  const decidedByApproverId = new Map(bill.billApprovals.map((entry) => [entry.approver.toString(), entry]));

  const roster = approvers
    .filter((approver) => (approver.role === routeRole && approver.isActive) || decidedByApproverId.has(String(approver._id)))
    .map((approver) => {
      const entry = decidedByApproverId.get(String(approver._id));
      return {
        approverId: approver._id,
        approverName: approver.name,
        approverCreatedAt: approver.createdAt,
        role: entry?.role ?? (approver.role as Actor['role']),
        decision: entry?.decision ?? 'pending',
        remarks: entry?.remarks,
        approvedAt: entry?.approvedAt ?? null,
      };
    });

  roster.sort((a, b) => {
    if (!a.approvedAt && !b.approvedAt) return 0;
    if (!a.approvedAt) return 1;
    if (!b.approvedAt) return -1;
    return new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime();
  });

  return roster;
}

/** Mirrors quotation.service.ts's ensureApproversAvailable exactly. */
async function ensureApproversAvailable(route: BillApprovalRoute) {
  const approvers = await notificationService.findActiveUsersByRole(route === 'ceo' ? ROLES.CEO : ROLES.DIRECTOR);
  if (route === 'ceo' && approvers.length === 0) {
    throw ApiError.badRequest('No active CEO is available. Please contact the Super Admin.');
  }
  if (route === 'directors' && approvers.length < 2) {
    throw ApiError.badRequest('Two active Directors are required before submitting this bill.');
  }
  return approvers;
}

/** Mirrors quotation.service.ts's notifyApproversOfSubmission exactly, module: 'bill'. */
async function notifyApproversOfSubmission(
  bill: IBill & { vendor: { name?: string }; department: { name?: string }; createdBy: { name?: string } },
  actor: Actor,
  approvers: Awaited<ReturnType<typeof notificationService.findActiveUsersByRole>>,
  notificationType: 'bill_submitted' | 'bill_resubmitted',
  title: string,
  baseMessage: string,
) {
  const message = `${baseMessage} Bill: ${bill.billCode} | Vendor: ${bill.vendor.name ?? '—'} | Department: ${bill.department.name ?? '—'} | Submitted By: ${bill.createdBy.name ?? '—'}`;

  await notificationService.notifyUsers(approvers, {
    title,
    message,
    module: 'bill',
    relatedRecord: String(bill._id),
    notificationType,
    sender: actor.id,
  });
}

/** Mirrors quotation.service.ts's notifyOfDecision exactly, Bill-flavored copy. */
async function notifyOfBillDecision(
  bill: IBill,
  actor: Actor,
  input: BillApprovalDecisionInput,
  roster: ReturnType<typeof mergeBillApprovals>,
  decidedAt: Date,
  route: BillApprovalRoute,
) {
  const roleLabel = route === 'ceo' ? 'CEO' : 'Director';
  const approverName = roster.find((entry) => String(entry.approverId) === actor.id)?.approverName ?? `The ${roleLabel}`;
  const ownerId = bill.createdBy.toString();
  const relatedRecord = String(bill._id);

  if (input.decision === 'rejected') {
    await notificationService.notifyUser(
      { id: ownerId, role: ROLES.DEPARTMENT_USER },
      {
        title: 'Bill Rejected',
        message: `Your bill has been rejected. ${roleLabel}: ${approverName}${input.remarks ? ` | Remarks: ${input.remarks}` : ''}`,
        module: 'bill',
        relatedRecord,
        notificationType: 'bill_rejected',
        sender: actor.id,
      },
    );
    return;
  }

  if (input.decision === 'negotiation') {
    await notificationService.notifyUser(
      { id: ownerId, role: ROLES.DEPARTMENT_USER },
      {
        title: 'Bill Returned for Negotiation',
        message: `${roleLabel} ${approverName} requested changes.${input.remarks ? ` Remarks: ${input.remarks}` : ''} (${decidedAt.toLocaleString()})`,
        module: 'bill',
        relatedRecord,
        notificationType: 'bill_negotiation',
        sender: actor.id,
      },
    );
    return;
  }

  // input.decision === 'approved'
  const pendingApprovers = roster.filter((entry) => entry.decision === 'pending');

  if (pendingApprovers.length > 0) {
    const orderedRoster = [...roster].sort(
      (a, b) => new Date(a.approverCreatedAt).getTime() - new Date(b.approverCreatedAt).getTime(),
    );
    const approverIndex = orderedRoster.findIndex((entry) => String(entry.approverId) === actor.id) + 1;

    await notificationService.notifyUser(
      { id: ownerId, role: ROLES.DEPARTMENT_USER },
      {
        title: 'Bill Reviewed',
        message: `Director ${approverIndex} approved. Waiting for remaining Director.`,
        module: 'bill',
        relatedRecord,
        notificationType: 'bill_reviewed',
        sender: actor.id,
      },
    );

    await notificationService.notifyUsers(
      pendingApprovers.map((entry) => ({ id: String(entry.approverId), role: ROLES.DIRECTOR })),
      {
        title: 'Review Pending',
        message: `Director ${approverName} completed the review. Your review is still pending.`,
        module: 'bill',
        relatedRecord,
        notificationType: 'bill_review_pending',
        sender: actor.id,
      },
    );
    return;
  }

  await notificationService.notifyUser(
    { id: ownerId, role: ROLES.DEPARTMENT_USER },
    {
      title: 'Bill Approved',
      message: route === 'ceo' ? 'Bill approved by CEO. Sent to Accounts.' : 'Bill fully approved. Sent to Accounts.',
      module: 'bill',
      relatedRecord,
      notificationType: 'bill_approved',
      sender: actor.id,
    },
  );
}

/** Broadcasts "a bill needs verification" to every active Accounts user — fired once a Bill
 *  reaches the Accounts stage, whether for the first time (CEO/Director just approved it) or
 *  again after Accounts itself requested a correction and the Department User fixed it. */
async function notifyAccountsBillReady(billId: string, actor: Actor, billCode: string) {
  const accountsUsers = await notificationService.findActiveUsersByRole(ROLES.ACCOUNTS);
  await notificationService.notifyUsers(accountsUsers, {
    title: 'Bill Awaiting Verification',
    message: `Bill ${billCode} has been approved and is awaiting Accounts verification.`,
    module: 'bill',
    relatedRecord: billId,
    notificationType: 'bill_submitted',
    sender: actor.id,
  });
}

/**
 * Bill code = department prefix + "-BILL" + a zero-padded running number, unique per
 * department. Sourced from an atomic counter — see the matching comment on
 * `generateQuotationCode` for why count-based numbering had a real race window.
 */
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
    if (input.invoiceAmount > quotation.amount) {
      throw ApiError.badRequest('Bill amount cannot exceed the Quotation amount');
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

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    scopeToOwner(actor, filter, ceoApprovalLimit);

    const [items, total] = await Promise.all([
      Bill.find(filter)
        .populate('vendor', 'name code category status')
        .populate('department', 'name code')
        .populate('quotation', 'quotationCode status amount')
        .populate('createdBy', 'name email')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Bill.countDocuments(filter),
    ]);

    const approvers = await fetchApproversForRoster(items);
    const itemsWithApprovals = items.map((item) => {
      const route = resolveApprovalRoute(item.invoiceAmount, ceoApprovalLimit);
      return Object.assign(item.toObject(), { billApprovals: mergeBillApprovals(item, approvers, route), approvalRoute: route });
    });

    return { items: itemsWithApprovals, meta: buildPaginationMeta(total, pagination) };
  },

  async getById(id: string, actor: Actor) {
    const filter: Record<string, unknown> = { _id: id, isDeleted: { $ne: true } };
    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    scopeToOwner(actor, filter, ceoApprovalLimit);

    const bill = await Bill.findOne(filter)
      .populate('vendor')
      .populate('department', 'name code')
      .populate('quotation')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('decisionHistory.decidedBy', 'name email');

    if (!bill) throw ApiError.notFound('Bill not found');

    const route = resolveApprovalRoute(bill.invoiceAmount, ceoApprovalLimit);
    const approvers = await fetchApproversForRoster([bill]);
    return Object.assign(bill.toObject(), { billApprovals: mergeBillApprovals(bill, approvers, route), approvalRoute: route });
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
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is no longer editable');
    }
    return bill;
  },

  /** Submitted Bills now go through the same CEO/Director approval route Quotations use,
   *  before ever reaching Accounts. Requires an Invoice PDF to already be uploaded. */
  async submit(id: string, actor: Actor) {
    const draft = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: BILL_STATUS.DRAFT,
      isDeleted: { $ne: true },
    }).select('invoiceAmount invoiceFiles');
    if (!draft) throw ApiError.notFound('Bill not found, or it is not in Draft status');
    if (draft.invoiceFiles.length === 0) {
      throw ApiError.badRequest('An invoice PDF must be uploaded before submitting this bill');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const route = resolveApprovalRoute(draft.invoiceAmount, ceoApprovalLimit);
    const approvers = await ensureApproversAvailable(route);

    const bill = await Bill.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: BILL_STATUS.DRAFT, isDeleted: { $ne: true } },
      { status: BILL_STATUS.SUBMITTED, submittedAt: new Date() },
      { new: true },
    )
      .populate('vendor', 'name')
      .populate('department', 'name')
      .populate('createdBy', 'name');
    if (!bill) throw ApiError.notFound('Bill not found, or it is not in Draft status');

    await notifyApproversOfSubmission(bill, actor, approvers, 'bill_submitted', 'New Bill Submitted', 'A bill is waiting for your review.');
    return bill;
  },

  /**
   * Two distinct resubmit paths share this one method, exactly mirroring which decision the
   * Bill is leaving:
   *  - From Negotiation (a CEO/Director decision) — goes back into the approval route, so
   *    whichever role the route requires (CEO or both Directors) is notified again.
   *  - From Correction Requested (an Accounts decision, pre-existing/unchanged) — the bill
   *    already cleared CEO/Director approval, so it goes straight back to Accounts, not back
   *    through the approval route a second time.
   */
  async resubmit(id: string, actor: Actor) {
    const negotiationBill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: BILL_STATUS.NEGOTIATION,
      isDeleted: { $ne: true },
    }).select('invoiceAmount invoiceFiles');

    if (negotiationBill) {
      if (negotiationBill.invoiceFiles.length === 0) {
        throw ApiError.badRequest('An invoice PDF must be uploaded before submitting this bill');
      }

      const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
      const route = resolveApprovalRoute(negotiationBill.invoiceAmount, ceoApprovalLimit);
      const approvers = await ensureApproversAvailable(route);

      const bill = await Bill.findOneAndUpdate(
        { _id: id, createdBy: actor.id, status: BILL_STATUS.NEGOTIATION, isDeleted: { $ne: true } },
        { status: BILL_STATUS.RESUBMITTED, submittedAt: new Date() },
        { new: true },
      )
        .populate('vendor', 'name')
        .populate('department', 'name')
        .populate('createdBy', 'name');
      if (!bill) throw ApiError.notFound('Bill not found, or it is not in Negotiation status');

      await notifyApproversOfSubmission(bill, actor, approvers, 'bill_resubmitted', 'Bill Resubmitted', 'A revised bill is ready for review.');
      return bill;
    }

    const bill = await Bill.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: BILL_STATUS.CORRECTION_REQUESTED, isDeleted: { $ne: true } },
      { status: BILL_STATUS.APPROVED },
      { new: true },
    );
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is not in Negotiation or Correction Requested status');
    }

    await notifyAccountsBillReady(bill.id, actor, bill.billCode);
    return bill;
  },

  /**
   * CEO/Director-only — mirrors quotation.service.ts's decide() exactly, including the shared
   * `isRosterFullyApproved` gate: Negotiation/Rejection take effect immediately (blocking
   * decisions), but the shared `status` only becomes `approved` once every approver on this
   * route's roster (the CEO alone, or every active Director) has independently approved —
   * Accounts must never see a bill until that's true. A later Negotiation/Rejection can still
   * reopen an already-Approved bill back to the Department User, but nothing overwrites an
   * already-rejected outcome.
   */
  async decideApproval(id: string, input: BillApprovalDecisionInput, actor: Actor) {
    if (actor.role !== ROLES.DIRECTOR && actor.role !== ROLES.CEO) {
      throw ApiError.forbidden('Only a Director or the CEO can decide on a bill');
    }

    const bill = await Bill.findOne({
      _id: id,
      status: { $in: APPROVAL_DECIDABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is no longer open for a decision');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const route = resolveApprovalRoute(bill.invoiceAmount, ceoApprovalLimit);

    if (route === 'ceo' && actor.role !== ROLES.CEO) {
      throw ApiError.forbidden(`This bill is within the CEO Approval Limit (₹${ceoApprovalLimit}) — only the CEO can decide on it`);
    }
    if (route === 'directors' && actor.role !== ROLES.DIRECTOR) {
      throw ApiError.forbidden(`This bill exceeds the CEO Approval Limit (₹${ceoApprovalLimit}) — only a Director can decide on it`);
    }

    const now = new Date();
    const existingEntry = bill.billApprovals.find((entry) => entry.approver.toString() === actor.id);
    if (existingEntry) {
      existingEntry.role = actor.role;
      existingEntry.decision = input.decision;
      existingEntry.remarks = input.remarks;
      existingEntry.approvedAt = now;
    } else {
      bill.billApprovals.push({
        approver: actor.id as unknown as IBill['billApprovals'][number]['approver'],
        role: actor.role,
        decision: input.decision,
        remarks: input.remarks,
        approvedAt: now,
      });
    }

    const approvers = await fetchApproversForRoster([bill]);
    const roster = mergeBillApprovals(bill, approvers, route);

    const isBlockingDecision = input.decision === 'negotiation' || input.decision === 'rejected';
    const shouldUpdateSharedStatus =
      bill.status === BILL_STATUS.SUBMITTED || bill.status === BILL_STATUS.RESUBMITTED
        ? isBlockingDecision || isRosterFullyApproved(roster)
        : bill.status === BILL_STATUS.APPROVED && isBlockingDecision;

    if (shouldUpdateSharedStatus) {
      bill.status = input.decision === 'rejected' ? BILL_STATUS.APPROVAL_REJECTED : (input.decision as BillStatus);
      bill.approvalRemarks = input.remarks;
      bill.decisionAt = now;
      if (input.decision === 'approved') bill.billApprovedAt = now;
      if (input.decision === 'rejected') bill.billRejectedAt = now;
      if (input.decision === 'negotiation') bill.billNegotiationAt = now;
    }

    await bill.save();

    await notifyOfBillDecision(bill, actor, input, roster, now, route);

    if (shouldUpdateSharedStatus && bill.status === BILL_STATUS.APPROVED) {
      await notifyAccountsBillReady(bill.id, actor, bill.billCode);
    }

    return Object.assign(bill.toObject(), { billApprovals: roster, approvalRoute: route });
  },

  /**
   * Accounts-only. Bills can only be decided on from Approved — never Draft/Submitted/
   * Negotiation/Resubmitted (those now belong to the CEO/Director approval stage), and never
   * a second time once Verified/Rejected (those are terminal from Accounts' point of view).
   * Every decision (including repeat Correction Requested rounds) is appended to
   * `decisionHistory` so the Bill Details screen can show the full back-and-forth, not
   * just the latest remark.
   */
  async decide(id: string, input: BillDecisionInput, actor: Actor) {
    if (actor.role !== ROLES.ACCOUNTS) {
      throw ApiError.forbidden('Only Accounts can decide on a bill');
    }

    const now = new Date();
    const isVerified = input.decision === BILL_STATUS.VERIFIED;

    const bill = await Bill.findOneAndUpdate(
      { _id: id, status: BILL_STATUS.APPROVED, isDeleted: { $ne: true } },
      {
        status: input.decision,
        accountsRemarks: input.remarks,
        decisionAt: now,
        ...(isVerified ? { verifiedBy: actor.id, verifiedAt: now } : {}),
        $push: {
          decisionHistory: { decision: input.decision, remarks: input.remarks, decidedBy: actor.id, decidedAt: now },
        },
      },
      { new: true },
    );
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is not awaiting a decision');
    }

    if (isVerified) {
      const paymentUsers = await notificationService.findActiveUsersByRole(ROLES.PAYMENT_DEPARTMENT);
      await notificationService.notifyUsers(paymentUsers, {
        title: 'Bill Verified',
        message: `Bill ${bill.billCode} has been verified by Accounts and is ready for payment processing.`,
        module: 'bill',
        relatedRecord: bill.id,
        notificationType: 'bill_verified',
        sender: actor.id,
      });
      await notificationService.notifyUser(
        { id: bill.createdBy.toString(), role: ROLES.DEPARTMENT_USER },
        {
          title: 'Bill Verified',
          message: `Bill ${bill.billCode} has been verified. Sent to Payment Department.`,
          module: 'bill',
          relatedRecord: bill.id,
          notificationType: 'bill_verified',
          sender: actor.id,
        },
      );
    }

    return bill;
  },

  /** Accounts-only dashboard counters. Drafts (and every pre-Approval status) are excluded. */
  async getAccountsStats(actor: Actor) {
    if (actor.role !== ROLES.ACCOUNTS) {
      throw ApiError.forbidden('Only Accounts can view the Accounts dashboard');
    }

    const baseFilter = {
      isDeleted: { $ne: true },
      status: { $nin: [BILL_STATUS.DRAFT, BILL_STATUS.SUBMITTED, BILL_STATUS.NEGOTIATION, BILL_STATUS.RESUBMITTED, BILL_STATUS.APPROVAL_REJECTED] },
    };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingVerification, correctionRequested, verifiedToday, rejected, total, totalVerified] = await Promise.all([
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.APPROVED }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.CORRECTION_REQUESTED }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.VERIFIED, verifiedAt: { $gte: startOfToday } }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.REJECTED }),
      Bill.countDocuments(baseFilter),
      // `verifiedBy` is stamped once and never cleared, even after the bill later moves to
      // Payment Pending/Paid/Completed — so this is the true historical "ever verified" count,
      // not just bills currently sitting in the Verified status.
      Bill.countDocuments({ ...baseFilter, verifiedBy: { $exists: true } }),
    ]);

    return { pendingVerification, correctionRequested, verifiedToday, rejected, total, totalVerified };
  },

  /** Payment Department-only dashboard counters. */
  async getPaymentStats(actor: Actor) {
    if (actor.role !== ROLES.PAYMENT_DEPARTMENT) {
      throw ApiError.forbidden('Only Payment Department can view the Payment dashboard');
    }

    const baseFilter = { isDeleted: { $ne: true } };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [readyForPayment, paymentPending, paidToday, completed] = await Promise.all([
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.VERIFIED }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.PAYMENT_PENDING }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.PAID, updatedAt: { $gte: startOfToday } }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.COMPLETED }),
    ]);

    return { readyForPayment, paymentPending, paidToday, completed };
  },

  /** Director-only dashboard counters — mirrors quotation.service.ts's getDirectorStats exactly. */
  async getDirectorStats(actor: Actor) {
    if (actor.role !== ROLES.DIRECTOR) {
      throw ApiError.forbidden('Only a Director can view the Director dashboard');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const baseFilter = { isDeleted: { $ne: true }, invoiceAmount: { $gt: ceoApprovalLimit } };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pending, negotiation, resubmitted, approvedToday, rejectedToday] = await Promise.all([
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.SUBMITTED }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.NEGOTIATION }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.RESUBMITTED }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.APPROVED, billApprovedAt: { $gte: startOfToday } }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.APPROVAL_REJECTED, billRejectedAt: { $gte: startOfToday } }),
    ]);

    return { pending, negotiation, resubmitted, approvedToday, rejectedToday };
  },

  /** CEO-only dashboard counters — mirrors quotation.service.ts's getCeoStats exactly. */
  async getCeoStats(actor: Actor) {
    if (actor.role !== ROLES.CEO && actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Only the CEO or Super Admin can view the CEO dashboard stats');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const baseFilter = { isDeleted: { $ne: true }, invoiceAmount: { $lte: ceoApprovalLimit } };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingApprovals, approvedToday] = await Promise.all([
      Bill.countDocuments({ ...baseFilter, status: { $in: [BILL_STATUS.SUBMITTED, BILL_STATUS.RESUBMITTED] } }),
      Bill.countDocuments({ ...baseFilter, status: BILL_STATUS.APPROVED, billApprovedAt: { $gte: startOfToday } }),
    ]);

    return { pendingApprovals, approvedToday };
  },

  /**
   * Payment Department-only — backend support for the future Payment module; no mobile UI yet.
   * `suppressNotifications` exists so the new Payment module (which now owns the full
   * Created/Processing/Paid/Completed/Failed notification flow itself) can reuse this bridge
   * purely to keep `Bill.status` in sync, without this function's own legacy notification
   * firing a second, duplicate message to the same Department User. Default (`false`) keeps
   * every other caller — including the standalone `/bills/:id/payment-status` route — behaved
   * exactly as before.
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
    if (!requiredCurrentStatus) {
      throw ApiError.badRequest('Invalid payment status transition');
    }

    const bill = await Bill.findOneAndUpdate(
      { _id: id, status: requiredCurrentStatus, isDeleted: { $ne: true } },
      { status: input.status },
      { new: true },
    );
    if (!bill) {
      throw ApiError.conflict(`Bill cannot transition to "${input.status}" from its current status`);
    }

    if (options.suppressNotifications) {
      return bill;
    }

    const PAYMENT_NOTIFICATION_TYPES: Partial<Record<BillStatus, 'payment_pending' | 'payment_paid' | 'payment_completed'>> = {
      [BILL_STATUS.PAYMENT_PENDING]: 'payment_pending',
      [BILL_STATUS.PAID]: 'payment_paid',
      [BILL_STATUS.COMPLETED]: 'payment_completed',
    };
    const PAYMENT_NOTIFICATION_TITLES: Partial<Record<BillStatus, string>> = {
      [BILL_STATUS.PAYMENT_PENDING]: 'Payment Pending',
      [BILL_STATUS.PAID]: 'Payment Paid',
      [BILL_STATUS.COMPLETED]: 'Payment Completed',
    };
    const notificationType = PAYMENT_NOTIFICATION_TYPES[input.status];
    if (notificationType) {
      await notificationService.notifyUser(
        { id: bill.createdBy.toString(), role: ROLES.DEPARTMENT_USER },
        {
          title: PAYMENT_NOTIFICATION_TITLES[input.status]!,
          message: `Bill ${bill.billCode} payment status updated to "${PAYMENT_NOTIFICATION_TITLES[input.status]}".`,
          module: 'bill',
          relatedRecord: bill.id,
          notificationType,
          sender: actor.id,
        },
      );
    }

    return bill;
  },

  /** Appends a new invoice PDF version — never overwrites or removes earlier versions. */
  async uploadInvoice(id: string, fileName: string, url: string, actor: Actor) {
    const bill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: { $in: EDITABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is no longer editable');
    }

    const version = bill.invoiceFiles.length + 1;
    bill.invoiceFiles.push({ version, fileName, url, uploadedAt: new Date() });
    await bill.save();
    return bill;
  },

  /** Appends a new supporting document version — optional, never overwrites earlier versions. */
  async uploadSupportingDocument(id: string, fileName: string, url: string, actor: Actor) {
    const bill = await Bill.findOne({
      _id: id,
      createdBy: actor.id,
      status: { $in: EDITABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!bill) {
      throw ApiError.notFound('Bill not found, or it is no longer editable');
    }

    const version = bill.supportingDocuments.length + 1;
    bill.supportingDocuments.push({ version, fileName, url, uploadedAt: new Date() });
    await bill.save();
    return bill;
  },

  /** Soft delete — Draft only. Reverts the quotation back to Approved so it can be re-billed. */
  async remove(id: string, actor: Actor) {
    const bill = await Bill.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: BILL_STATUS.DRAFT, isDeleted: { $ne: true } },
      { isDeleted: true },
      { new: true },
    );
    if (!bill) {
      throw ApiError.notFound('Bill not found, or only a Draft bill can be deleted');
    }

    await quotationService.transitionStatus(bill.quotation.toString(), [QUOTATION_STATUS.BILLED], QUOTATION_STATUS.APPROVED);

    return bill;
  },
};
