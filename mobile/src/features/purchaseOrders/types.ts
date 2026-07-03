export const PO_STATUSES = [
  'generated',
  'bill_uploaded',
  'ai_verification_pending',
  'ai_verified',
  'accounts_verified',
  'payment_pending',
  'paid',
  'closed',
] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

export const AI_RISKS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type AiRisk = (typeof AI_RISKS)[number];

export const AI_RECOMMENDATIONS = ['APPROVE', 'MANUAL_REVIEW', 'REJECT'] as const;
export type AiRecommendation = (typeof AI_RECOMMENDATIONS)[number];

export interface PurchaseOrderItem {
  itemName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  taxAmount: number;
  discount: number;
  total: number;
}

export interface AiDifference {
  field: string;
  purchaseOrder: unknown;
  bill: unknown;
  difference: string;
}

export interface AiVerification {
  matchPercentage: number;
  risk: AiRisk;
  recommendation: AiRecommendation;
  confidence: number;
  summary: string;
  differences: AiDifference[];
  ruleEngineScore: number;
  verifiedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  quotationId: string;
  quotationCode: string;
  vendorId: string;
  vendorName: string;
  vendorGst: string;
  vendorAddress: string;
  departmentId: string;
  departmentName: string;
  createdById: string;
  createdByName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  totalGst: number;
  totalTax: number;
  totalDiscount: number;
  grandTotal: number;
  terms?: string;
  notes?: string;
  status: PurchaseOrderStatus;
  billId?: string;
  billCode?: string;
  billStatus?: string;
  billInvoiceAmount?: number;
  aiVerification?: AiVerification;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderItem {
  itemName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  taxAmount: number;
  discount: number;
  total: number;
}

export interface CreatePurchaseOrderRequest {
  quotationId: string;
  items: CreatePurchaseOrderItem[];
  terms?: string;
  notes?: string;
}

export interface PurchaseOrderStats {
  generated: number;
  billUploaded: number;
  aiVerificationPending: number;
  aiVerified: number;
  accountsVerified: number;
  paymentPending: number;
  paid: number;
  closed: number;
  total: number;
}

export interface AuditLog {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNumber?: string;
  billId: string;
  billCode?: string;
  quotationId: string;
  aiRecommendation: AiRecommendation;
  aiConfidence: number;
  matchPercentage: number;
  risk: AiRisk;
  differenceCount: number;
  differences: AiDifference[];
  accountsDecision: 'verified' | 'correction_requested' | 'rejected';
  reason?: string;
  decidedById: string;
  decidedByName: string;
  decidedByRole: string;
  decidedAt: string;
  createdAt: string;
}
