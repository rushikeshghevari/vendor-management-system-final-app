import { ROLES } from '@/constants/roles';
import { QUOTATION_STATUS, type QuotationStatus } from '@/constants/status';
import { Department } from '@/modules/department/department.model';
import { notificationService } from '@/modules/notification/notification.service';
import { Quotation, type IQuotation } from '@/modules/quotation/quotation.model';
import type {
  CreateQuotationInput,
  DecisionInput,
  UpdateQuotationInput,
} from '@/modules/quotation/quotation.validation';
import { settingService } from '@/modules/setting/setting.service';
import { User } from '@/modules/user/user.model';
import { Vendor } from '@/modules/vendor/vendor.model';
import type { Actor } from '@/types/actor';
import { ApiError } from '@/utils/ApiError';
import { isRosterFullyApproved } from '@/utils/approvalRoster';
import { escapeRegex } from '@/utils/escapeRegex';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';
import { nextSequence, seedSequenceFromExisting } from '@/utils/sequence.model';

export type ApprovalRoute = 'ceo' | 'directors';

/** Amount <= the configured CEO Approval Limit routes to the CEO alone; above it, both
 *  Directors must approve. Always computed live against the current setting — never stored
 *  on the quotation — so a limit change can re-route an in-flight quotation by design. */
function resolveApprovalRoute(amount: number, ceoApprovalLimit: number): ApprovalRoute {
  return amount <= ceoApprovalLimit ? 'ceo' : 'directors';
}

const EDITABLE_STATUSES = [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.NEGOTIATION];
// Decisions remain possible for other Directors to weigh in on, right up until a Bill
// exists for the quotation — only Draft (not submitted yet) and Billed (final) are excluded.
const DECIDABLE_STATUSES = [
  QUOTATION_STATUS.SUBMITTED,
  QUOTATION_STATUS.NEGOTIATION,
  QUOTATION_STATUS.RESUBMITTED,
  QUOTATION_STATUS.APPROVED,
  QUOTATION_STATUS.REJECTED,
];

/**
 * Quotation visibility is per-creator, not per-department: a Department User sees and
 * manages only the quotations they personally created — not every quotation in their
 * department. Directors and the CEO each review company-wide, but only within their own
 * approval route (by amount vs the CEO Approval Limit) — a Director never sees a
 * CEO-routed quotation and vice versa, the same way Draft/Billed already stay out of view
 * for both. Visibility keeps even after a decision has been made (Approved/Rejected
 * included), so the approver can independently see and add their own entry to the History.
 */
function scopeToOwner(actor: Actor, filter: Record<string, unknown>, ceoApprovalLimit: number) {
  if (actor.role === ROLES.DEPARTMENT_USER) {
    filter.createdBy = actor.id;
  } else if (actor.role === ROLES.DIRECTOR) {
    filter.status = { $nin: [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.BILLED] };
    filter.amount = { $gt: ceoApprovalLimit };
  } else if (actor.role === ROLES.CEO) {
    filter.status = { $nin: [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.BILLED] };
    filter.amount = { $lte: ceoApprovalLimit };
  }
}

type ApproverRecord = { _id: unknown; name: string; isActive: boolean; role: string; createdAt: Date };

/**
 * Fetches every Director AND every CEO relevant to a batch of quotations in one query —
 * every active one of each (so they show as "Pending" on whichever route applies to a given
 * quotation), plus anyone deactivated who has a historical entry on one of these quotations
 * (so their past decision still shows a real name, not just an id). Reused across a whole
 * list response, never per-quotation. `mergeDirectorApprovals` below picks the right subset
 * per quotation based on that quotation's own approval route.
 */
async function fetchApproversForRoster(quotations: IQuotation[]): Promise<ApproverRecord[]> {
  const decidedIds = new Set<string>();
  quotations.forEach((quotation) => quotation.directorApprovals.forEach((entry) => decidedIds.add(entry.director.toString())));

  return User.find({
    $or: [{ role: { $in: [ROLES.DIRECTOR, ROLES.CEO] }, isActive: true }, { _id: { $in: [...decidedIds] } }],
  })
    .select('name isActive role createdAt')
    .lean();
}

/**
 * Merges one quotation's recorded `directorApprovals` with the (pre-fetched) approver
 * roster, so an approver who hasn't acted yet still shows up as "Pending" — without ever
 * persisting "pending" as a stored value. Decided entries sort newest first; Pending rows
 * sort last. Only active approvers *for this quotation's route* (plus whoever actually
 * decided on *this* quotation, even if they're a different role — e.g. a historical CEO
 * decision stays visible even if the limit later changed and this quotation now routes to
 * Directors) are included.
 */
function mergeDirectorApprovals(quotation: IQuotation, approvers: ApproverRecord[], route: ApprovalRoute) {
  const routeRole = route === 'ceo' ? ROLES.CEO : ROLES.DIRECTOR;
  const decidedByDirectorId = new Map(quotation.directorApprovals.map((entry) => [entry.director.toString(), entry]));

  const roster = approvers
    .filter((approver) => (approver.role === routeRole && approver.isActive) || decidedByDirectorId.has(String(approver._id)))
    .map((approver) => {
      const entry = decidedByDirectorId.get(String(approver._id));
      return {
        directorId: approver._id,
        directorName: approver.name,
        directorCreatedAt: approver.createdAt,
        decision: entry?.decision ?? 'pending',
        remarks: entry?.remarks,
        decidedAt: entry?.decidedAt ?? null,
      };
    });

  roster.sort((a, b) => {
    if (!a.decidedAt && !b.decidedAt) return 0;
    if (!a.decidedAt) return 1;
    if (!b.decidedAt) return -1;
    return new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime();
  });

  return roster;
}

/** Broadcasts a "review this" notification to whichever approver role the route requires
 *  on Submit/Resubmit — only the CEO if within the CEO Approval Limit, only the Directors
 *  if above it (see Part 1 of the Notification phase, now route-aware). */
/**
 * Submission is blocked outright if the resolved route has no one able to act on it — an
 * empty CEO seat or fewer than 2 active Directors would otherwise strand the quotation with
 * nobody to approve it. Returns the active approvers for `route` so the caller can reuse the
 * same fetch for the submission notification, instead of querying twice.
 */
async function ensureApproversAvailable(route: ApprovalRoute) {
  const approvers = await notificationService.findActiveUsersByRole(route === 'ceo' ? ROLES.CEO : ROLES.DIRECTOR);
  if (route === 'ceo' && approvers.length === 0) {
    throw ApiError.badRequest('No active CEO is available. Please contact the Super Admin.');
  }
  if (route === 'directors' && approvers.length < 2) {
    throw ApiError.badRequest('Two active Directors are required before submitting this quotation.');
  }
  return approvers;
}

async function notifyApproversOfSubmission(
  quotation: IQuotation & { vendor: { name?: string }; department: { name?: string }; createdBy: { _id: unknown; name?: string } },
  actor: Actor,
  approvers: Awaited<ReturnType<typeof notificationService.findActiveUsersByRole>>,
  notificationType: 'quotation_submitted' | 'quotation_resubmitted',
  title: string,
  baseMessage: string,
) {
  const message = `${baseMessage} Quotation: ${quotation.quotationCode} | Vendor: ${quotation.vendor.name ?? '—'} | Department: ${quotation.department.name ?? '—'} | Submitted By: ${quotation.createdBy.name ?? '—'} | Priority: ${quotation.priority}`;

  await notificationService.notifyUsers(approvers, {
    title,
    message,
    module: 'quotation',
    relatedRecord: String(quotation._id),
    notificationType,
    sender: actor.id,
  });
}

/**
 * Notifies the right people once an approver's decision is saved (see Part 1 of the
 * Notification phase, now route-aware). The Department User only ever hears "fully
 * Approved" once every active approver on this quotation's route has a non-pending entry
 * in `roster` — independent of the `status` field's own first-decision-wins shortcut — and
 * remaining pending Directors get nudged so nobody is left wondering whether their review
 * is still needed. The CEO route only ever has one approver, so the "still pending" branch
 * below is unreachable for it — the CEO's decision is always also the final one.
 */
async function notifyOfDecision(
  quotation: IQuotation,
  actor: Actor,
  input: DecisionInput,
  roster: ReturnType<typeof mergeDirectorApprovals>,
  decidedAt: Date,
  route: ApprovalRoute,
) {
  const roleLabel = route === 'ceo' ? 'CEO' : 'Director';
  const approverName = roster.find((entry) => String(entry.directorId) === actor.id)?.directorName ?? `The ${roleLabel}`;
  const ownerId = quotation.createdBy.toString();
  const relatedRecord = String(quotation._id);

  if (input.decision === QUOTATION_STATUS.REJECTED) {
    await notificationService.notifyUser(
      { id: ownerId, role: ROLES.DEPARTMENT_USER },
      {
        title: 'Quotation Rejected',
        message: `Your quotation has been rejected. ${roleLabel}: ${approverName}${input.remarks ? ` | Remarks: ${input.remarks}` : ''}`,
        module: 'quotation',
        relatedRecord,
        notificationType: 'quotation_rejected',
        sender: actor.id,
      },
    );
    return;
  }

  if (input.decision === QUOTATION_STATUS.NEGOTIATION) {
    await notificationService.notifyUser(
      { id: ownerId, role: ROLES.DEPARTMENT_USER },
      {
        title: 'Quotation Returned for Negotiation',
        message: `${roleLabel} ${approverName} requested changes.${input.remarks ? ` Remarks: ${input.remarks}` : ''} (${decidedAt.toLocaleString()})`,
        module: 'quotation',
        relatedRecord,
        notificationType: 'quotation_negotiation',
        sender: actor.id,
      },
    );
    return;
  }

  // input.decision === 'approved'
  const pendingDirectors = roster.filter((entry) => entry.decision === 'pending');

  if (pendingDirectors.length > 0) {
    // Ordinal label ("Director 1"/"Director 2") is assigned by a stable, explicit field —
    // the approver's account `createdAt` — never by ObjectId string order or decision order,
    // so it stays consistent regardless of which Director happens to decide first.
    const orderedRoster = [...roster].sort(
      (a, b) => new Date(a.directorCreatedAt).getTime() - new Date(b.directorCreatedAt).getTime(),
    );
    const approverIndex = orderedRoster.findIndex((entry) => String(entry.directorId) === actor.id) + 1;

    await notificationService.notifyUser(
      { id: ownerId, role: ROLES.DEPARTMENT_USER },
      {
        title: 'Quotation Reviewed',
        message: `Director ${approverIndex} approved. Waiting for remaining Director.`,
        module: 'quotation',
        relatedRecord,
        notificationType: 'quotation_reviewed',
        sender: actor.id,
      },
    );

    await notificationService.notifyUsers(
      pendingDirectors.map((entry) => ({ id: String(entry.directorId), role: ROLES.DIRECTOR })),
      {
        title: 'Review Pending',
        message: `Director ${approverName} completed the review. Your review is still pending.`,
        module: 'quotation',
        relatedRecord,
        notificationType: 'review_pending',
        sender: actor.id,
      },
    );
    return;
  }

  await notificationService.notifyUser(
    { id: ownerId, role: ROLES.DEPARTMENT_USER },
    {
      title: 'Quotation Approved',
      message: route === 'ceo' ? 'Quotation approved by CEO.' : 'Quotation fully approved.',
      module: 'quotation',
      relatedRecord,
      notificationType: 'quotation_approved',
      sender: actor.id,
    },
  );
}

/**
 * Quotation code = department prefix + "-QTN" + a zero-padded running number, unique per
 * department. Sourced from an atomic counter (`nextSequence`) rather than counting existing
 * documents, so two Department Users submitting at the same instant can never be handed the
 * same code — the previous count-based approach had a genuine (if rare) race window between
 * counting and inserting.
 */
async function generateQuotationCode(departmentId: string): Promise<string> {
  const department = await Department.findById(departmentId).select('code');
  if (!department) throw ApiError.badRequest('Department not found for this quotation');

  const prefix = (department.code.match(/^[A-Za-z]+/)?.[0] ?? 'QTN').toUpperCase();
  const codePrefix = `${prefix}-QTN`;
  const counterKey = `quotation:${codePrefix}`;

  await seedSequenceFromExisting(counterKey, async () => {
    const existingCodes = await Quotation.find({ quotationCode: new RegExp(`^${codePrefix}\\d+$`) })
      .select('quotationCode')
      .lean();
    return existingCodes.reduce((max, item) => {
      const num = parseInt(item.quotationCode.slice(codePrefix.length), 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
  });

  const sequence = await nextSequence(counterKey);
  return `${codePrefix}${String(sequence).padStart(3, '0')}`;
}

export const quotationService = {
  async create(input: CreateQuotationInput, actor: Actor) {
    if (actor.role !== ROLES.DEPARTMENT_USER || !actor.department) {
      throw ApiError.forbidden('Only a Department User can create a quotation');
    }

    const vendor = await Vendor.findById(input.vendor);
    if (!vendor) throw ApiError.badRequest('Vendor not found');
    if (vendor.createdBy.toString() !== actor.id) {
      throw ApiError.forbidden('You can only create a quotation for a vendor you registered');
    }
    if (vendor.status !== 'active') {
      throw ApiError.badRequest('Only an Active vendor can be selected for a quotation');
    }

    const quotationCode = await generateQuotationCode(actor.department);

    return Quotation.create({
      ...input,
      quotationCode,
      department: actor.department,
      createdBy: actor.id,
      status: QUOTATION_STATUS.DRAFT,
    });
  },

  async list(query: Record<string, unknown>, actor: Actor) {
    const pagination = parsePagination(query);
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };

    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.vendor) filter.vendor = query.vendor;
    if (query.search) {
      filter.quotationCode = new RegExp(escapeRegex(String(query.search).trim()), 'i');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    scopeToOwner(actor, filter, ceoApprovalLimit);

    const [items, total] = await Promise.all([
      Quotation.find(filter)
        .populate('vendor', 'name code category status')
        .populate('department', 'name code')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Quotation.countDocuments(filter),
    ]);

    const approvers = await fetchApproversForRoster(items);
    const itemsWithApprovals = items.map((item) => {
      const route = resolveApprovalRoute(item.amount, ceoApprovalLimit);
      return Object.assign(item.toObject(), { directorApprovals: mergeDirectorApprovals(item, approvers, route), approvalRoute: route });
    });

    return { items: itemsWithApprovals, meta: buildPaginationMeta(total, pagination) };
  },

  async getById(id: string, actor: Actor) {
    const filter: Record<string, unknown> = { _id: id, isDeleted: { $ne: true } };
    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    scopeToOwner(actor, filter, ceoApprovalLimit);

    const quotation = await Quotation.findOne(filter)
      .populate('vendor')
      .populate('department', 'name code')
      .populate('createdBy', 'name email');

    if (!quotation) throw ApiError.notFound('Quotation not found');

    const route = resolveApprovalRoute(quotation.amount, ceoApprovalLimit);
    const approvers = await fetchApproversForRoster([quotation]);
    return Object.assign(quotation.toObject(), { directorApprovals: mergeDirectorApprovals(quotation, approvers, route), approvalRoute: route });
  },

  async update(id: string, input: UpdateQuotationInput, actor: Actor) {
    if (actor.role !== ROLES.DEPARTMENT_USER) {
      throw ApiError.forbidden('Only a Department User can edit a quotation');
    }

    const quotation = await Quotation.findOneAndUpdate(
      {
        _id: id,
        createdBy: actor.id,
        status: { $in: EDITABLE_STATUSES },
        isDeleted: { $ne: true },
      },
      input,
      { new: true, runValidators: true },
    );
    if (!quotation) {
      throw ApiError.notFound('Quotation not found, or it is no longer editable');
    }
    return quotation;
  },

  async submit(id: string, actor: Actor) {
    const draft = await Quotation.findOne({
      _id: id,
      createdBy: actor.id,
      status: QUOTATION_STATUS.DRAFT,
      isDeleted: { $ne: true },
    }).select('amount');
    if (!draft) throw ApiError.notFound('Quotation not found, or it is not in Draft status');

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const route = resolveApprovalRoute(draft.amount, ceoApprovalLimit);
    const approvers = await ensureApproversAvailable(route);

    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: QUOTATION_STATUS.DRAFT, isDeleted: { $ne: true } },
      { status: QUOTATION_STATUS.SUBMITTED, submittedAt: new Date() },
      { new: true },
    )
      .populate('vendor', 'name')
      .populate('department', 'name')
      .populate('createdBy', 'name');
    if (!quotation) throw ApiError.notFound('Quotation not found, or it is not in Draft status');

    await notifyApproversOfSubmission(quotation, actor, approvers, 'quotation_submitted', 'New Quotation Submitted', 'A quotation is waiting for your review.');
    return quotation;
  },

  /** After a Department User edits/re-uploads following a Negotiation decision. */
  async resubmit(id: string, actor: Actor) {
    const negotiation = await Quotation.findOne({
      _id: id,
      createdBy: actor.id,
      status: QUOTATION_STATUS.NEGOTIATION,
      isDeleted: { $ne: true },
    }).select('amount');
    if (!negotiation) throw ApiError.notFound('Quotation not found, or it is not in Negotiation status');

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const route = resolveApprovalRoute(negotiation.amount, ceoApprovalLimit);
    const approvers = await ensureApproversAvailable(route);

    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: QUOTATION_STATUS.NEGOTIATION, isDeleted: { $ne: true } },
      { status: QUOTATION_STATUS.RESUBMITTED, submittedAt: new Date() },
      { new: true },
    )
      .populate('vendor', 'name')
      .populate('department', 'name')
      .populate('createdBy', 'name');
    if (!quotation) throw ApiError.notFound('Quotation not found, or it is not in Negotiation status');

    await notifyApproversOfSubmission(quotation, actor, approvers, 'quotation_resubmitted', 'Quotation Resubmitted', 'A revised quotation is ready for review.');
    return quotation;
  },

  /**
   * Director-only. Multiple Directors act independently — none of them are required to
   * approve before the workflow continues. Every Director's own decision is independently
   * recorded in `directorApprovals`. If this Director already has an entry, only that entry
   * is updated in place (they can revise their own decision later); another Director's entry
   * is never touched.
   *
   * The shared `status`/`directorRemarks`/`decisionAt` fields only move once the decision is
   * conclusive for the *whole* route, not just for this one approver:
   *  - Negotiation/Rejection are blocking decisions — even a single approver's call takes
   *    effect immediately (there is no reason to wait for a second Director to also reject).
   *  - Approval requires every approver currently on this route's roster (the CEO alone, or
   *    every active Director) to have independently approved — see `isRosterFullyApproved`.
   *    Accounts/downstream consumers must never see "approved" until that's true.
   * A later Director's Negotiation/Rejection can still reopen an already-Approved quotation
   * back to the Department User. Rejected is a hard stop: once any Director has rejected, no
   * later Approve can un-reject it.
   */
  async decide(id: string, input: DecisionInput, actor: Actor) {
    if (actor.role !== ROLES.DIRECTOR && actor.role !== ROLES.CEO) {
      throw ApiError.forbidden('Only a Director or the CEO can decide on a quotation');
    }

    const quotation = await Quotation.findOne({
      _id: id,
      status: { $in: DECIDABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!quotation) {
      throw ApiError.notFound('Quotation not found, or it is no longer open for a decision');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const route = resolveApprovalRoute(quotation.amount, ceoApprovalLimit);

    if (route === 'ceo' && actor.role !== ROLES.CEO) {
      throw ApiError.forbidden(`This quotation is within the CEO Approval Limit (₹${ceoApprovalLimit}) — only the CEO can decide on it`);
    }
    if (route === 'directors' && actor.role !== ROLES.DIRECTOR) {
      throw ApiError.forbidden(`This quotation exceeds the CEO Approval Limit (₹${ceoApprovalLimit}) — only a Director can decide on it`);
    }

    const now = new Date();
    const existingEntry = quotation.directorApprovals.find((entry) => entry.director.toString() === actor.id);
    if (existingEntry) {
      existingEntry.decision = input.decision;
      existingEntry.remarks = input.remarks;
      existingEntry.decidedAt = now;
    } else {
      quotation.directorApprovals.push({
        director: actor.id as unknown as IQuotation['directorApprovals'][number]['director'],
        decision: input.decision,
        remarks: input.remarks,
        decidedAt: now,
      });
    }

    const approvers = await fetchApproversForRoster([quotation]);
    const roster = mergeDirectorApprovals(quotation, approvers, route);

    const isBlockingDecision = input.decision === QUOTATION_STATUS.NEGOTIATION || input.decision === QUOTATION_STATUS.REJECTED;
    const shouldUpdateSharedStatus =
      quotation.status === QUOTATION_STATUS.SUBMITTED || quotation.status === QUOTATION_STATUS.RESUBMITTED
        ? isBlockingDecision || isRosterFullyApproved(roster)
        : quotation.status === QUOTATION_STATUS.APPROVED && isBlockingDecision;

    if (shouldUpdateSharedStatus) {
      quotation.status = input.decision;
      quotation.directorRemarks = input.remarks;
      quotation.decisionAt = now;
    }

    await quotation.save();

    await notifyOfDecision(quotation, actor, input, roster, now, route);

    return Object.assign(quotation.toObject(), { directorApprovals: roster, approvalRoute: route });
  },

  /** Appends a new PDF version — never overwrites or removes earlier versions. */
  async uploadPdf(id: string, fileName: string, url: string, actor: Actor) {
    const quotation = await Quotation.findOne({
      _id: id,
      createdBy: actor.id,
      status: { $in: EDITABLE_STATUSES },
      isDeleted: { $ne: true },
    });
    if (!quotation) {
      throw ApiError.notFound('Quotation not found, or it is no longer editable');
    }

    const version = quotation.pdfFiles.length + 1;
    quotation.pdfFiles.push({ version, fileName, url, uploadedAt: new Date() });
    await quotation.save();
    return quotation;
  },

  /** Soft delete — Draft only, per the Draft business rules. */
  async remove(id: string, actor: Actor) {
    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, createdBy: actor.id, status: QUOTATION_STATUS.DRAFT, isDeleted: { $ne: true } },
      { isDeleted: true },
      { new: true },
    );
    if (!quotation) {
      throw ApiError.notFound('Quotation not found, or only a Draft quotation can be deleted');
    }
    return quotation;
  },

  /** Cross-module workflow helper kept for the future Negotiation/Approval/Bill modules. */
  async transitionStatus(
    id: string,
    fromStatuses: QuotationStatus[],
    toStatus: QuotationStatus,
    extraFields: Record<string, unknown> = {},
  ) {
    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, status: { $in: fromStatuses } },
      { status: toStatus, ...extraFields },
      { new: true },
    );

    if (!quotation) {
      throw ApiError.conflict(`Quotation cannot transition to "${toStatus}" from its current status`);
    }

    return quotation;
  },

  async findByIdOrThrow(id: string) {
    const quotation = await Quotation.findById(id);
    if (!quotation) throw ApiError.notFound('Quotation not found');
    return quotation;
  },

  /**
   * Director-only dashboard counters. "Approved Today"/"Rejected Today" need quotations
   * outside the Director's normal list scope (which only ever shows Submitted/Negotiation/
   * Resubmitted) — this is a dedicated aggregate, not a change to that visibility rule.
   * `amount > ceoApprovalLimit` is applied everywhere here so a CEO-routed quotation never
   * inflates a Director's counters, mirroring the same filter in `scopeToOwner`.
   */
  async getDirectorStats(actor: Actor) {
    if (actor.role !== ROLES.DIRECTOR) {
      throw ApiError.forbidden('Only a Director can view the Director dashboard');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const baseFilter = { isDeleted: { $ne: true }, amount: { $gt: ceoApprovalLimit } };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pending, negotiation, resubmitted, approvedToday, rejectedToday] = await Promise.all([
      Quotation.countDocuments({ ...baseFilter, status: QUOTATION_STATUS.SUBMITTED }),
      Quotation.countDocuments({ ...baseFilter, status: QUOTATION_STATUS.NEGOTIATION }),
      Quotation.countDocuments({ ...baseFilter, status: QUOTATION_STATUS.RESUBMITTED }),
      Quotation.countDocuments({ ...baseFilter, status: QUOTATION_STATUS.APPROVED, decisionAt: { $gte: startOfToday } }),
      Quotation.countDocuments({ ...baseFilter, status: QUOTATION_STATUS.REJECTED, decisionAt: { $gte: startOfToday } }),
    ]);

    return { pending, negotiation, resubmitted, approvedToday, rejectedToday };
  },

  /** CEO-only dashboard counters — mirrors `getDirectorStats`, filtered to the CEO's own
   *  approval route (`amount <= ceoApprovalLimit`). "Pending CEO Approvals" covers both a
   *  fresh Submit and a post-negotiation Resubmit, since both await the CEO's review. */
  async getCeoStats(actor: Actor) {
    if (actor.role !== ROLES.CEO && actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Only the CEO or Super Admin can view the CEO dashboard stats');
    }

    const ceoApprovalLimit = await settingService.getCeoApprovalLimit();
    const baseFilter = { isDeleted: { $ne: true }, amount: { $lte: ceoApprovalLimit } };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingApprovals, approvedToday] = await Promise.all([
      Quotation.countDocuments({ ...baseFilter, status: { $in: [QUOTATION_STATUS.SUBMITTED, QUOTATION_STATUS.RESUBMITTED] } }),
      Quotation.countDocuments({ ...baseFilter, status: QUOTATION_STATUS.APPROVED, decisionAt: { $gte: startOfToday } }),
    ]);

    return { pendingApprovals, approvedToday };
  },
};
