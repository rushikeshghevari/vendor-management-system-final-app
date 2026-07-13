export const QUOTATION_STATUSES = [
  'draft',
  'submitted',
  'negotiation',
  'resubmitted',
  'approved',
  'rejected',
  'billed',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type QuotationPriority = (typeof QUOTATION_PRIORITIES)[number];

export const QUOTATION_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type QuotationCurrency = (typeof QUOTATION_CURRENCIES)[number];

export interface QuotationPdfVersion {
  version: number;
  fileName: string;
  url: string;
  uploadedAt: string;
}

export interface DirectorQuotationStats {
  pending: number;
  negotiation: number;
  resubmitted: number;
  approvedToday: number;
  rejectedToday: number;
}

export interface CeoQuotationStats {
  pendingApprovals: number;
  approvedToday: number;
}

export const APPROVAL_ROUTES = ['ceo', 'directors'] as const;
export type ApprovalRoute = (typeof APPROVAL_ROUTES)[number];

export const DIRECTOR_DECISIONS = ['approved', 'negotiation', 'rejected'] as const;
export type DirectorDecision = (typeof DIRECTOR_DECISIONS)[number];

export type DirectorApprovalStatus = DirectorDecision | 'pending';

export interface DirectorApproval {
  directorId: string;
  directorName: string;
  decision: DirectorApprovalStatus;
  remarks?: string;
  decidedAt: string | null;
}

export interface LinkedPurchaseOrderSummary {
  id: string;
  poNumber: string;
  grandTotal: number;
  status: string;
  createdByName?: string;
}

export interface LinkedBillSummary {
  id: string;
  billCode: string;
  status: string;
  invoiceAmount: number;
  uploadedByName?: string;
  uploadedByRole?: string;
}

export interface Quotation {
  id: string;
  quotationCode: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  departmentId: string;
  departmentName: string;
  createdById: string;
  createdByName: string;
  submittedByName?: string;
  linkedPurchaseOrder?: LinkedPurchaseOrderSummary | null;
  linkedBill?: LinkedBillSummary | null;
  quotationDate: string;
  requiredDate: string;
  amount: number;
  gst: number;
  currency: QuotationCurrency;
  paymentTerms: string;
  deliveryTerms: string;
  priority: QuotationPriority;
  description?: string;
  pdfFiles: QuotationPdfVersion[];
  remarks?: string;
  directorRemarks?: string;
  directorApprovals: DirectorApproval[];
  approvalRoute: ApprovalRoute;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
}
