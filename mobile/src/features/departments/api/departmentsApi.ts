import { baseApi } from '@/store/baseApi';
import type { Department } from '@/features/departments/types';

interface RawDepartment {
  _id: string;
  name: string;
  code: string;
  description?: string;
  departmentHead?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function toDepartment(raw: RawDepartment): Department {
  return {
    id: raw._id,
    name: raw.name,
    code: raw.code,
    description: raw.description ?? '',
    departmentHead: raw.departmentHead,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface DepartmentInput {
  name: string;
  code: string;
  description?: string;
  departmentHead?: string;
  isActive?: boolean;
}

export const departmentsApi = baseApi.injectEndpoints({
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
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useSetDepartmentStatusMutation,
  useDeleteDepartmentMutation,
} = departmentsApi;
