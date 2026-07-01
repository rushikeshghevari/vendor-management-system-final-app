import { z } from 'zod';

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name is required'),
  code: z
    .string()
    .trim()
    .min(2, 'Department code is required')
    .regex(/^[A-Z0-9-]+$/i, 'Use letters, numbers, and dashes only'),
  description: z.string().trim().min(5, 'Description is required'),
  departmentHead: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
