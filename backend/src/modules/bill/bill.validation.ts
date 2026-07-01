import { z } from 'zod';

import { BILL_STATUS } from '@/constants/status';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

// `billCode`, `vendor`, `department`, and `createdBy` are deliberately absent — all four are
// always derived server-side from the Approved Quotation, never trusted from the body.
export const createBillSchema = z.object({
  quotation: objectId,
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required'),
  invoiceDate: z.coerce.date(),
  invoiceAmount: z.coerce.number().positive('Invoice amount must be greater than 0'),
  taxableAmount: z.coerce.number().min(0, 'Taxable amount cannot be negative'),
  gstAmount: z.coerce.number().min(0, 'GST amount cannot be negative'),
  paymentTerms: z.string().trim().min(1, 'Payment terms are required'),
  dueDate: z.coerce.date(),
  remarks: z.string().trim().max(1000).optional(),
});

export const updateBillSchema = createBillSchema.omit({ quotation: true }).partial();

export const billDecisionSchema = z
  .object({
    decision: z.enum([BILL_STATUS.VERIFIED, BILL_STATUS.CORRECTION_REQUESTED, BILL_STATUS.REJECTED]),
    remarks: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision !== BILL_STATUS.VERIFIED && !data.remarks) {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'Remarks are mandatory for Correction Requested and Rejection decisions',
      });
    }
  });

// CEO/Director approval stage — identical shape to quotation.validation.ts's decisionSchema.
export const billApprovalDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'negotiation', 'rejected']),
    remarks: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision !== 'approved' && !data.remarks) {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'Remarks are mandatory for Negotiation and Rejection decisions',
      });
    }
  });

export const billPaymentStatusSchema = z.object({
  status: z.enum([BILL_STATUS.PAYMENT_PENDING, BILL_STATUS.PAID, BILL_STATUS.COMPLETED]),
});

export const billListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(Object.values(BILL_STATUS) as [string, ...string[]]).optional(),
  department: objectId.optional(),
  vendor: objectId.optional(),
  quotation: objectId.optional(),
  search: z.string().optional(),
  // Filters the Accounts Bill List by invoice date — inclusive on both ends.
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type BillDecisionInput = z.infer<typeof billDecisionSchema>;
export type BillApprovalDecisionInput = z.infer<typeof billApprovalDecisionSchema>;
export type BillPaymentStatusInput = z.infer<typeof billPaymentStatusSchema>;
