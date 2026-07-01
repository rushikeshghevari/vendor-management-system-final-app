import { Schema, model, type Document, type Types } from 'mongoose';

import { ALL_ROLES, type Role } from '@/constants/roles';
import { BILL_STATUS, type BillStatus } from '@/constants/status';

export interface IBillFileVersion {
  version: number;
  fileName: string;
  url: string;
  uploadedAt: Date;
}

/** One entry per Accounts decision — keeps every Correction Requested/Rejected remark, not just the latest. */
export interface IBillDecisionRecord {
  decision: BillStatus;
  remarks?: string;
  decidedBy: Types.ObjectId;
  decidedAt: Date;
}

export const BILL_APPROVAL_DECISIONS = ['approved', 'negotiation', 'rejected'] as const;
export type BillApprovalDecision = (typeof BILL_APPROVAL_DECISIONS)[number];

/**
 * One independent record per CEO/Director — mirrors `quotation.model.ts`'s
 * `IDirectorApproval` exactly (never overwritten by another approver's entry, "pending" is
 * never stored). `role` is a denormalized snapshot of the approver's role at decision time —
 * Quotation doesn't store this, but it's explicitly requested for Bills (useful for Reports
 * without an extra join) and is harmless to keep.
 */
export interface IBillApproval {
  approver: Types.ObjectId;
  role: Role;
  decision: BillApprovalDecision;
  remarks?: string;
  approvedAt: Date;
}

export interface IBill extends Document {
  billCode: string;
  quotation: Types.ObjectId;
  vendor: Types.ObjectId;
  department: Types.ObjectId;
  createdBy: Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceAmount: number;
  taxableAmount: number;
  gstAmount: number;
  paymentTerms: string;
  dueDate: Date;
  invoiceFiles: IBillFileVersion[];
  supportingDocuments: IBillFileVersion[];
  remarks?: string;
  // CEO/Director feedback for Negotiation/Rejection at the approval stage — kept alongside
  // `billApprovals` the same way Quotation keeps `directorRemarks` alongside `directorApprovals`.
  approvalRemarks?: string;
  billApprovals: IBillApproval[];
  billApprovedAt?: Date;
  billRejectedAt?: Date;
  billNegotiationAt?: Date;
  // Latest Accounts feedback — kept alongside `decisionHistory` so existing Department User
  // screens (which only show the latest remark) don't need to change.
  accountsRemarks?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  decisionHistory: IBillDecisionRecord[];
  status: BillStatus;
  isDeleted: boolean;
  submittedAt?: Date;
  decisionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const fileVersionSchema = new Schema<IBillFileVersion>(
  {
    version: { type: Number, required: true },
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const decisionRecordSchema = new Schema<IBillDecisionRecord>(
  {
    decision: { type: String, enum: Object.values(BILL_STATUS), required: true },
    remarks: { type: String, trim: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    decidedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const billApprovalSchema = new Schema<IBillApproval>(
  {
    approver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ALL_ROLES, required: true },
    decision: { type: String, enum: BILL_APPROVAL_DECISIONS, required: true },
    remarks: { type: String, trim: true },
    approvedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const billSchema = new Schema<IBill>(
  {
    billCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    // One Approved Quotation -> one Bill, enforced by uniqueness plus the quotation's own
    // approved -> billed transition (see quotationService.transitionStatus in bill.service.ts).
    quotation: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true, unique: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    invoiceAmount: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    paymentTerms: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    // Never overwritten — every upload appends a new version; the last entry is the active one.
    invoiceFiles: { type: [fileVersionSchema], default: [] },
    supportingDocuments: { type: [fileVersionSchema], default: [] },
    remarks: { type: String, trim: true },
    approvalRemarks: { type: String, trim: true },
    billApprovals: { type: [billApprovalSchema], default: [] },
    billApprovedAt: { type: Date },
    billRejectedAt: { type: Date },
    billNegotiationAt: { type: Date },
    accountsRemarks: { type: String, trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    decisionHistory: { type: [decisionRecordSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(BILL_STATUS),
      default: BILL_STATUS.DRAFT,
    },
    isDeleted: { type: Boolean, default: false },
    submittedAt: { type: Date },
    decisionAt: { type: Date },
  },
  { timestamps: true },
);

billSchema.index({ department: 1, status: 1 });
billSchema.index({ vendor: 1 });
// Every Department User's list/filter query is scoped by `createdBy` (see scopeToOwner) —
// without this, that's a full collection scan on every Department User's request.
billSchema.index({ createdBy: 1, status: 1 });

export const Bill = model<IBill>('Bill', billSchema);
