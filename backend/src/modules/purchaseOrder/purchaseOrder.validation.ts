import { z } from 'zod';

const poItemSchema = z.object({
  itemName:    z.string().trim().min(1, 'Item name is required'),
  description: z.string().trim().optional(),
  quantity:    z.number().positive('Quantity must be > 0'),
  unitPrice:   z.number().nonnegative(),
  gstRate:     z.number().min(0).max(100).default(0),
  gstAmount:   z.number().nonnegative().default(0),
  taxAmount:   z.number().nonnegative().default(0),
  discount:    z.number().nonnegative().default(0),
  total:       z.number().nonnegative(),
});

export const createPurchaseOrderSchema = z.object({
  quotationId: z.string().trim().min(1, 'Quotation ID is required'),
  items: z.array(poItemSchema).min(1, 'At least one line item is required'),
  terms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const poListQuerySchema = z.object({
  status:   z.string().optional(),
  page:     z.coerce.number().int().positive().optional(),
  limit:    z.coerce.number().int().positive().max(100).optional(),
  search:   z.string().optional(),
  vendorId: z.string().optional(),
});
export type POListQuery = z.infer<typeof poListQuerySchema>;
