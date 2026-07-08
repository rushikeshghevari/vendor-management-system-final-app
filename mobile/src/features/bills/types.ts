export const BILL_STATUSES = [
  'draft',
  'submitted',
  'ai_verified',
  'director_approved',
  'director_rejected',
  'director_correction',
  'verified',
  'correction_requested',
  'rejected',
  'payment_pending',
  'paid',
  'completed',
] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const DIRECTOR_FINANCIAL_DECISIONS = ['approved', 'rejected', 'correction_required'] as const;
export type DirectorFinancialDecision = (typeof DIRECTOR_FINANCIAL_DECISIONS)[number];

export interface DirectorBillStats {
  pendingFinancialApprovals: number;
  approvedToday: number;
  rejectedToday: number;
  correctionToday: number;
  highRiskBills: number;
}

export interface BillFileVersion {
  version: number;
  fileName: string;
  url: string;
  uploadedAt: string;
}

export const BILL_DECISIONS = ['verified', 'correction_requested', 'rejected'] as const;
export type BillDecision = (typeof BILL_DECISIONS)[number];

export interface BillDecisionRecord {
  decision: BillStatus;
  remarks?: string;
  decidedById: string;
  decidedByName: string;
  decidedAt: string;
}

export interface Bill {
  id: string;
  billCode: string;
  quotationId: string;
  quotationCode: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  departmentId: string;
  departmentName: string;
  createdById: string;
  createdByName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  taxableAmount: number;
  gstAmount: number;
  paymentTerms: string;
  dueDate: string;
  invoiceFiles: BillFileVersion[];
  supportingDocuments: BillFileVersion[];
  remarks?: string;
  accountsRemarks?: string;
  verifiedById?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  decisionHistory: BillDecisionRecord[];
  // Director Financial Approval (Approval 2 — after 3-Way AI)
  directorFinancialDecision?: DirectorFinancialDecision;
  directorFinancialBy?: string;
  directorFinancialAt?: string;
  directorFinancialRemarks?: string;
  status: BillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsBillStats {
  pendingVerification: number;
  correctionRequested: number;
  verifiedToday: number;
  rejected: number;
  total: number;
  totalVerified: number;
}

export interface PaymentBillStats {
  readyForPayment: number;
  paymentPending: number;
  paidToday: number;
  completed: number;
}
