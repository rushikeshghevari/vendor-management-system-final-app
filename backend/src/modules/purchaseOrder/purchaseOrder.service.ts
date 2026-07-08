import { ROLES } from '@/constants/roles';
import { PO_STATUS, QUOTATION_STATUS } from '@/constants/status';
import { Bill } from '@/modules/bill/bill.model';
import { notificationService } from '@/modules/notification/notification.service';
import { PurchaseOrder, type IPurchaseOrder } from '@/modules/purchaseOrder/purchaseOrder.model';
import type { CreatePurchaseOrderInput, POListQuery } from '@/modules/purchaseOrder/purchaseOrder.validation';
import { Quotation } from '@/modules/quotation/quotation.model';
import { Vendor } from '@/modules/vendor/vendor.model';
import { Department } from '@/modules/department/department.model';
import { User } from '@/modules/user/user.model';
import type { Actor } from '@/types/actor';
import { ApiError } from '@/utils/ApiError';
import { escapeRegex } from '@/utils/escapeRegex';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';
import { nextSequence } from '@/utils/sequence.model';
import { runAiVerification } from '@/services/ai/aiVerification.service';

// ── Scope to role (read-only for non-Dept-Users) ─────────────────────────────
function scopeToRole(actor: Actor, filter: Record<string, unknown>): void {
  if (actor.role === ROLES.DEPARTMENT_USER) {
    filter.createdBy = actor.id;
  }
  // Directors, CEO, Accounts, Payment — see all (read-only)
  // Super Admin — sees all
}

// ── Generate PO Number: PO-<DEPT_CODE>-2026-000001 ───────────────────────────
async function generatePoNumber(deptCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`po_${deptCode.toLowerCase()}`);
  return `PO-${deptCode.toUpperCase()}-${year}-${String(seq).padStart(6, '0')}`;
}

// ── Populate helper for list and detail responses ─────────────────────────────
const POPULATE_LIST = [
  { path: 'vendor',     select: 'name code' },
  { path: 'department', select: 'name code' },
  { path: 'createdBy',  select: 'name email' },
  { path: 'bill',       select: 'billCode status invoiceAmount' },
];

const POPULATE_DETAIL = [
  { path: 'quotation',  select: 'quotationCode amount gst currency paymentTerms deliveryTerms' },
  { path: 'vendor',     select: 'name code gstNumber address state city' },
  { path: 'department', select: 'name code' },
  { path: 'createdBy',  select: 'name email' },
  { path: 'bill',       select: 'billCode status invoiceAmount invoiceNumber invoiceDate invoiceFiles decisionHistory verifiedAt verifiedBy' },
];

export const purchaseOrderService = {

  async create(input: CreatePurchaseOrderInput, actor: Actor): Promise<IPurchaseOrder> {
    if (actor.role !== ROLES.DEPARTMENT_USER && actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Only Department Users can generate Purchase Orders');
    }

    // Fetch quotation (must be approved)
    const quotation = await Quotation.findById(input.quotationId)
      .populate<{ vendor: { _id: import('mongoose').Types.ObjectId; name: string; gstNumber?: string; address: string; state: string; city: string } }>('vendor')
      .lean();

    if (!quotation || quotation.isDeleted) throw ApiError.notFound('Quotation not found');
    if (quotation.status !== QUOTATION_STATUS.APPROVED && quotation.status !== QUOTATION_STATUS.BILLED) {
      throw ApiError.badRequest('Purchase Order can only be generated for Approved Quotations');
    }

    // Enforce one PO per quotation
    const existing = await PurchaseOrder.findOne({ quotation: input.quotationId, isDeleted: false });
    if (existing) throw ApiError.conflict('A Purchase Order already exists for this Quotation');

    // Fetch department for PO code
    const department = await Department.findById(actor.department ?? quotation.department).lean();
    if (!department) throw ApiError.notFound('Department not found');

    const deptCode = (department as { code?: string; name?: string }).code ?? 'DEPT';
    const poNumber = await generatePoNumber(deptCode);

    const vendor = quotation.vendor as { _id: import('mongoose').Types.ObjectId; name: string; gstNumber?: string; address: string; state: string; city: string };

    // Compute totals
    const subtotal      = input.items.reduce((s, i) => s + (i.unitPrice * i.quantity - i.discount), 0);
    const totalGst      = input.items.reduce((s, i) => s + i.gstAmount, 0);
    const totalTax      = input.items.reduce((s, i) => s + i.taxAmount, 0);
    const totalDiscount = input.items.reduce((s, i) => s + i.discount, 0);
    const grandTotal    = subtotal + totalGst + totalTax;

    const po = await PurchaseOrder.create({
      poNumber,
      poDate: new Date(),
      quotation: input.quotationId,
      quotationCode: quotation.quotationCode,
      vendor: vendor._id,
      vendorName: vendor.name,
      vendorGst: vendor.gstNumber ?? 'N/A',
      vendorAddress: `${vendor.address}, ${vendor.city ?? ''}, ${vendor.state ?? ''}`.trim(),
      department: actor.department ?? quotation.department,
      departmentName: (department as { name: string }).name,
      createdBy: actor.id,
      items: input.items,
      subtotal,
      totalGst,
      totalTax,
      totalDiscount,
      grandTotal,
      terms: input.terms,
      notes: input.notes,
      status: PO_STATUS.GENERATED,
    });

    // Notify Super Admins
    try {
      const superAdmins = await notificationService.findActiveUsersByRole(ROLES.SUPER_ADMIN);
      if (superAdmins.length > 0) {
        await notificationService.notifyUsers(superAdmins, {
          title: 'Purchase Order Generated',
          message: `PO ${poNumber} generated against Quotation ${quotation.quotationCode}`,
          module: 'purchase_order',
          relatedRecord: String(po._id),
          notificationType: 'po_generated',
        });
      }
    } catch { /* non-fatal */ }

    return po;
  },

  async list(query: POListQuery, actor: Actor): Promise<{ items: IPurchaseOrder[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { isDeleted: false };

    scopeToRole(actor, filter);

    if (query.status) filter.status = query.status;
    if (query.vendorId) filter.vendor = query.vendorId;
    if (query.search) {
      const re = escapeRegex(query.search);
      filter.$or = [
        { poNumber: { $regex: re, $options: 'i' } },
        { quotationCode: { $regex: re, $options: 'i' } },
        { vendorName: { $regex: re, $options: 'i' } },
      ];
    }

    const total = await PurchaseOrder.countDocuments(filter);
    const items = await PurchaseOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_LIST)
      .lean();

    return { items: items as IPurchaseOrder[], meta: buildPaginationMeta(total, { page, limit, skip }) };
  },

  async getById(id: string, _actor: Actor): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findOne({ _id: id, isDeleted: false })
      .populate(POPULATE_DETAIL)
      .lean();

    if (!po) throw ApiError.notFound('Purchase Order not found');
    return po as IPurchaseOrder;
  },

  async getByQuotation(quotationId: string, _actor: Actor): Promise<IPurchaseOrder | null> {
    return PurchaseOrder.findOne({ quotation: quotationId, isDeleted: false })
      .populate(POPULATE_DETAIL)
      .lean() as Promise<IPurchaseOrder | null>;
  },

  async triggerAiVerification(id: string, actor: Actor): Promise<IPurchaseOrder> {
    const po = await PurchaseOrder.findOne({ _id: id, isDeleted: false });
    if (!po) throw ApiError.notFound('Purchase Order not found');

    if (![ROLES.ACCOUNTS, ROLES.SUPER_ADMIN].includes(actor.role as never)) {
      throw ApiError.forbidden('Only Accounts or Super Admin can trigger AI verification');
    }

    if (!po.bill) {
      throw ApiError.badRequest('No Bill is linked to this Purchase Order yet');
    }

    // Fetch the linked bill with vendor data
    const bill = await Bill.findById(po.bill)
      .populate<{ vendor: { name: string; gstNumber?: string } }>('vendor', 'name gstNumber')
      .lean();

    if (!bill) throw ApiError.notFound('Linked Bill not found');

    const billWithVendor = {
      ...bill,
      vendorName: (bill.vendor as unknown as { name: string })?.name ?? '',
      vendorGst: (bill.vendor as unknown as { gstNumber?: string })?.gstNumber ?? '',
    };

    // Update PO status to AI verification pending
    po.status = PO_STATUS.AI_VERIFICATION_PENDING;
    await po.save();

    // Run verification (async — can take a few seconds for Gemini)
    const aiResult = await runAiVerification({
      po,
      bill: billWithVendor as unknown as Parameters<typeof runAiVerification>[0]['bill'],
      actor,
    });

    // Store results on PO
    po.aiVerification = aiResult;
    po.status = PO_STATUS.AI_VERIFIED;
    await po.save();

    // Notify Accounts users
    try {
      const accountsUsers = await notificationService.findActiveUsersByRole(ROLES.ACCOUNTS);
      await notificationService.notifyUsers(accountsUsers, {
        title: 'AI Verification Complete',
        message: `PO ${po.poNumber}: ${aiResult.matchPercentage}% match — ${aiResult.recommendation}`,
        module: 'purchase_order',
        relatedRecord: String(po._id),
        notificationType: 'po_ai_verified',
      });
    } catch { /* non-fatal */ }

    return po.toObject() as IPurchaseOrder;
  },

  async getStats(actor: Actor): Promise<{
    generated: number;
    billUploaded: number;
    aiVerificationPending: number;
    aiVerified: number;
    accountsVerified: number;
    paymentPending: number;
    paid: number;
    closed: number;
    total: number;
  }> {
    const baseFilter: Record<string, unknown> = { isDeleted: false };
    scopeToRole(actor, baseFilter);

    const [
      generated, billUploaded, aiVerificationPending, aiVerified,
      accountsVerified, paymentPending, paid, closed, total,
    ] = await Promise.all([
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.GENERATED }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.BILL_UPLOADED }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.AI_VERIFICATION_PENDING }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.AI_VERIFIED }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.ACCOUNTS_VERIFIED }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.PAYMENT_PENDING }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.PAID }),
      PurchaseOrder.countDocuments({ ...baseFilter, status: PO_STATUS.CLOSED }),
      PurchaseOrder.countDocuments(baseFilter),
    ]);

    return { generated, billUploaded, aiVerificationPending, aiVerified, accountsVerified, paymentPending, paid, closed, total };
  },
};
