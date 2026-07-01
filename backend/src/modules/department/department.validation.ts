import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20),
  description: z.string().trim().max(500).optional(),
  departmentHead: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const updateDepartmentStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type UpdateDepartmentStatusInput = z.infer<typeof updateDepartmentStatusSchema>;
