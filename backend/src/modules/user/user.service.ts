import { ROLES } from '@/constants/roles';
import { User } from '@/modules/user/user.model';
import type { CreateUserInput, UpdateUserInput } from '@/modules/user/user.validation';
import { ApiError } from '@/utils/ApiError';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';

export const userService = {
  async create(input: CreateUserInput) {
    const existing = await User.findOne({ email: input.email });
    if (existing) throw ApiError.conflict('A user with this email already exists');

    const payload = { ...input };
    if (payload.role !== ROLES.DEPARTMENT_USER) payload.department = undefined;
    if (payload.role === ROLES.CEO) await assertNoActiveCeo();

    const user = await User.create(payload);
    return user.toObject({ transform: stripPassword });
  },

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.department) filter.department = query.department;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

    const [items, total] = await Promise.all([
      User.find(filter)
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      User.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, pagination) };
  },

  async getById(id: string) {
    const user = await User.findById(id).populate('department', 'name code');
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async update(id: string, input: UpdateUserInput) {
    const existing = await User.findById(id).select('role isActive');
    if (!existing) throw ApiError.notFound('User not found');

    const payload = { ...input };
    const nextRole = payload.role ?? existing.role;
    if (nextRole !== ROLES.DEPARTMENT_USER) payload.department = undefined;

    const nextIsActive = payload.isActive ?? existing.isActive;
    if (nextRole === ROLES.CEO && nextIsActive) await assertNoActiveCeo(id);

    const user = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async setStatus(id: string, isActive: boolean) {
    if (!isActive) await assertNotSuperAdmin(id);
    if (isActive) {
      const target = await User.findById(id).select('role');
      if (target?.role === ROLES.CEO) await assertNoActiveCeo(id);
    }
    const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async deactivate(id: string) {
    await assertNotSuperAdmin(id);
    const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(id).select('+password');
    if (!user) throw ApiError.notFound('User not found');

    const matches = await user.comparePassword(currentPassword);
    if (!matches) throw ApiError.badRequest('Current password is incorrect');

    user.password = newPassword;
    await user.save();
  },

  /** Admin-initiated reset — sets a new password directly, no current password required. */
  async resetPassword(id: string, newPassword: string) {
    const user = await User.findById(id);
    if (!user) throw ApiError.notFound('User not found');

    user.password = newPassword;
    await user.save();
  },
};

function stripPassword(_doc: unknown, ret: Record<string, unknown>) {
  delete ret.password;
  return ret;
}

async function assertNotSuperAdmin(id: string): Promise<void> {
  const user = await User.findById(id).select('role');
  if (user?.role === ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('The primary Super Admin account cannot be deleted');
  }
}

/** Only one CEO may be active at a time — `excludeId` lets editing/reactivating the existing CEO not self-conflict. */
async function assertNoActiveCeo(excludeId?: string): Promise<void> {
  const filter: Record<string, unknown> = { role: ROLES.CEO, isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await User.findOne(filter).select('_id');
  if (existing) {
    throw ApiError.conflict('An active CEO already exists. Deactivate the existing CEO before creating a new one.');
  }
}
