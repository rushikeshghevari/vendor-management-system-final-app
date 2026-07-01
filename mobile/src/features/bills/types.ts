export const BILL_STATUSES = [
  'draft',
  'submitted',
  'negotiation',
  'resubmitted',
  'approved',
  'approval_rejected',
  'correction_requested',
  'verified',
  'rejected',
  'payment_pending',
  'paid',
  'completed',
] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const APPROVAL_ROUTES = ['ceo', 'directors'] as const;
export type ApprovalRoute = (typeof APPROVAL_ROUTES)[number];

export const BILL_APPROVAL_DECISIONS = ['approved', 'negotiation', 'rejected'] as const;
export type BillApprovalDecision = (typeof BILL_APPROVAL_DECISIONS)[number];

export type BillApprovalStatus = BillApprovalDecision | 'pending';

export interface BillApproval {
  approverId: string;
  approverName: string;
  role: string;
  decision: BillApprovalStatus;
  remarks?: string;
  approvedAt: string | null;
}

export interface CeoBillStats {
  pendingApprovals: number;
  approvedToday: number;
}

export interface DirectorBillStats {
  pending: number;
  negotiation: number;
  resubmitted: number;
  approvedToday: number;
  rejectedToday: number;
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
  approvalRemarks?: string;
  billApprovals: BillApproval[];
  approvalRoute: ApprovalRoute;
  billApprovedAt?: string;
  billRejectedAt?: string;
  billNegotiationAt?: string;
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
