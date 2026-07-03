import { z } from 'zod';

import { ALL_ROLES } from '@/constants/roles';
import { paginationQuerySchema } from '@/utils/commonValidation';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const notificationListQuerySchema = paginationQuerySchema.extend({
  module:     z.string().optional(),
  isRead:     z.enum(['true', 'false']).optional(),
  isArchived: z.enum(['true', 'false']).optional(),
  priority:   z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export const broadcastSchema = z.object({
  title:         z.string().trim().min(1).max(200),
  message:       z.string().trim().min(1).max(1000),
  targetRoles:   z.array(z.enum(ALL_ROLES)).optional(),
  targetUserIds: z.array(objectId).optional(),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;
