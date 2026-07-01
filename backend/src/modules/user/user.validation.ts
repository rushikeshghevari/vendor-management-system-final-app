import { z } from 'zod';

import { ALL_ROLES, ROLES } from '@/constants/roles';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(128),
    role: z.enum(ALL_ROLES),
    department: objectId.optional(),
    phone: z.string().trim().max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === ROLES.DEPARTMENT_USER && !data.department) {
      ctx.addIssue({
        code: 'custom',
        path: ['department'],
        message: 'Department is required for department_user role',
      });
    }
  });

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(ALL_ROLES).optional(),
  department: objectId.optional(),
  phone: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128),
});

/** Admin-initiated reset — unlike `changePasswordSchema`, no current password is required. */
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: z.enum(ALL_ROLES).optional(),
  department: objectId.optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
