import { baseApi } from '@/store/baseApi';
import type { Role } from '@/constants/roles';
import type { AppUser } from '@/features/users/types';

interface RawDepartmentRef {
  _id: string;
  name: string;
  code: string;
}

interface RawUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  department?: RawDepartmentRef | string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

function toAppUser(raw: RawUser): AppUser {
  const department = raw.department;
  const isPopulated = typeof department === 'object' && department !== null;

  return {
    id: raw._id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    role: raw.role,
    departmentId: isPopulated ? department._id : department ?? '',
    departmentName: isPopulated ? department.name : '',
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    lastLoginAt: raw.lastLoginAt,
  };
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  department?: string;
  phone?: string;
  isActive?: boolean;
}

export const usersApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV !== 'production',
  endpoints: (builder) => ({
    getUsers: builder.query<AppUser[], void>({
      query: () => ({ url: '/users', method: 'GET', params: { limit: 100 } }),
      transformResponse: (raw: RawUser[]) => raw.map(toAppUser),
      providesTags: (result) => [
        ...(result ?? []).map((item) => ({ type: 'Users' as const, id: item.id })),
        { type: 'Users' as const, id: 'LIST' },
      ],
    }),

    createUser: builder.mutation<AppUser, CreateUserInput>({
      query: (body) => ({ url: '/users', method: 'POST', data: body }),
      transformResponse: (raw: RawUser) => toAppUser(raw),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    updateUser: builder.mutation<AppUser, { id: string; body: UpdateUserInput }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PATCH', data: body }),
      transformResponse: (raw: RawUser) => toAppUser(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    setUserStatus: builder.mutation<AppUser, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({ url: `/users/${id}/status`, method: 'PATCH', data: { isActive } }),
      transformResponse: (raw: RawUser) => toAppUser(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    bulkSetUserStatus: builder.mutation<{ updated: number }, { ids: string[]; isActive: boolean }>({
      query: (body) => ({ url: '/users/bulk-status', method: 'PATCH', data: body }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    resetUserPassword: builder.mutation<void, { id: string; newPassword: string }>({
      query: ({ id, newPassword }) => ({ url: `/users/${id}/reset-password`, method: 'PATCH', data: { newPassword } }),
    }),

    changeOwnPassword: builder.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/users/me/password', method: 'PATCH', data: body }),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useSetUserStatusMutation,
  useDeleteUserMutation,
  useBulkSetUserStatusMutation,
  useResetUserPasswordMutation,
  useChangeOwnPasswordMutation,
} = usersApi;
