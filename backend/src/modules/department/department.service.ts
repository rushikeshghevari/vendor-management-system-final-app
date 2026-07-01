import { Department } from '@/modules/department/department.model';
import type { CreateDepartmentInput, UpdateDepartmentInput } from '@/modules/department/department.validation';
import { ApiError } from '@/utils/ApiError';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';

export const departmentService = {
  async create(input: CreateDepartmentInput, createdBy: string) {
    return Department.create({ ...input, createdBy });
  },

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const filter = query.isActive !== undefined ? { isActive: query.isActive === 'true' } : {};

    const [items, total] = await Promise.all([
      Department.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      Department.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, pagination) };
  },

  async getById(id: string) {
    const department = await Department.findById(id);
    if (!department) throw ApiError.notFound('Department not found');
    return department;
  },

  async update(id: string, input: UpdateDepartmentInput) {
    const department = await Department.findByIdAndUpdate(id, input, {
      new: true,
      runValidators: true,
    });
    if (!department) throw ApiError.notFound('Department not found');
    return department;
  },

  async remove(id: string) {
    const department = await Department.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!department) throw ApiError.notFound('Department not found');
    return department;
  },
};
