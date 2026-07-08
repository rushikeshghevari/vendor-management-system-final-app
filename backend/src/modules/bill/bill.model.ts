import { Schema, model, type Document, type Types } from 'mongoose';

import { BILL_STATUS, type BillStatus } from '@/constants/status';

export interface IBillFileVersion {
  version: number;
  fileName: string;
  url: string;
  uploadedAt: Date;
}

/** One entry per Accounts decision — keeps the full correction/rejection history. */
export interface IBillDecisionRecord {
  decision: BillStatus;
  remarks?: string;
  decidedBy: Types.ObjectId;
  decidedAt: Date;
}

/** Director Financial Approval decisions (Approval 2 — after 3-Way AI verification). */
export const DIRECTOR_FINANCIAL_DECISIONS = ['approved', 'rejected', 'correction_required'] as const;
export type DirectorFinancialDecision = (typeof DIRECTOR_FINANCIAL_DECISIONS)[number];

export interface IBill extends Document {
  billCode: string;
  quotation: Types.ObjectId;
  purchaseOrder?: Types.ObjectId;
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
  // Director Financial Approval (Approval 2 — after 3-Way AI, before Accounts).
  directorFinancialDecision?: DirectorFinancialDecision;
  directorFinancialBy?: Types.ObjectId;
  directorFinancialAt?: Date;
  directorFinancialRemarks?: string;
  // Accounts feedback — latest remark plus full history.
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

const billSchema = new Schema<IBill>(
  {
    billCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    quotation: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true, unique: true },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
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
    invoiceFiles: { type: [fileVersionSchema], default: [] },
    supportingDocuments: { type: [fileVersionSchema], default: [] },
    remarks: { type: String, trim: true },
    // Director Financial Approval (Approval 2 — after 3-Way AI, before Accounts).
    directorFinancialDecision: { type: String, enum: DIRECTOR_FINANCIAL_DECISIONS },
    directorFinancialBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    directorFinancialAt:       { type: Date },
    directorFinancialRemarks:  { type: String, trim: true },
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
