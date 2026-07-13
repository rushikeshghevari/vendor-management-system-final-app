import { baseApi } from '@/store/baseApi';
import type { Department, DepartmentAnalytics } from '@/features/departments/types';

interface RawHod {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
}

export interface RawDepartment {
  _id: string;
  name: string;
  code: string;
  description?: string;
  departmentHead?: string;
  hod?: RawHod;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  vendorCount?: number;
  quotationCount?: number;
  purchaseOrderCount?: number;
  billCount?: number;
}

export function toDepartment(raw: RawDepartment): Department {
  return {
    id: raw._id,
    name: raw.name,
    code: raw.code,
    description: raw.description ?? '',
    departmentHead: raw.departmentHead,
    hod: raw.hod
      ? { id: raw.hod._id, name: raw.hod.name, email: raw.hod.email, phone: raw.hod.phone, isActive: raw.hod.isActive }
      : undefined,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    userCount: raw.userCount,
    vendorCount: raw.vendorCount,
    quotationCount: raw.quotationCount,
    purchaseOrderCount: raw.purchaseOrderCount,
    billCount: raw.billCount,
  };
}

export interface DepartmentInput {
  name: string;
  code: string;
  description?: string;
  departmentHead?: string;
  isActive?: boolean;
  createHod?: boolean;
  hod?: { name: string; email: string; password: string; phone?: string };
  hodId?: string;
}

export const departmentsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV !== 'production',
  endpoints: (builder) => ({
    getDepartments: builder.query<Department[], void>({
      query: () => ({ url: '/departments', method: 'GET', params: { limit: 100 } }),
      transformResponse: (raw: RawDepartment[]) => raw.map(toDepartment),
      providesTags: (result) => [
        ...(result ?? []).map((item) => ({ type: 'Department' as const, id: item.id })),
        { type: 'Department' as const, id: 'LIST' },
      ],
    }),

    createDepartment: builder.mutation<Department, DepartmentInput>({
      query: (body) => ({ url: '/departments', method: 'POST', data: body }),
      transformResponse: (raw: RawDepartment) => toDepartment(raw),
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),

    updateDepartment: builder.mutation<Department, { id: string; body: DepartmentInput }>({
      query: ({ id, body }) => ({ url: `/departments/${id}`, method: 'PATCH', data: body }),
      transformResponse: (raw: RawDepartment) => toDepartment(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
      ],
    }),

    setDepartmentStatus: builder.mutation<Department, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({ url: `/departments/${id}/status`, method: 'PATCH', data: { isActive } }),
      transformResponse: (raw: RawDepartment) => toDepartment(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
      ],
    }),

    deleteDepartment: builder.mutation<void, string>({
      query: (id) => ({ url: `/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
      ],
    }),

    transferHod: builder.mutation<Department, { id: string; newHodId: string; demoteOldHod?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/departments/${id}/transfer-hod`, method: 'PUT', data: body }),
      transformResponse: (raw: RawDepartment) => toDepartment(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    getDepartmentAnalytics: builder.query<DepartmentAnalytics, string>({
      query: (id) => ({ url: `/departments/${id}/analytics`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'Department', id: `${id}-ANALYTICS` }],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useSetDepartmentStatusMutation,
  useDeleteDepartmentMutation,
  useTransferHodMutation,
  useGetDepartmentAnalyticsQuery,
} = departmentsApi;
