import { baseApi } from '@/store/baseApi';
import type { BankDetails, Vendor, VendorStatus } from '@/features/vendors/types';

interface RawRef {
  _id: string;
  name: string;
  code?: string;
  email?: string;
}

interface RawVendor {
  _id: string;
  name: string;
  code: string;
  department: RawRef | string;
  createdBy: RawRef | string;
  contactPerson: string;
  phone: string;
  email: string;
  gstNumber?: string;
  panNumber?: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  bankDetails: BankDetails;
  category: string;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}

function toVendor(raw: RawVendor): Vendor {
  const department = raw.department;
  const createdBy = raw.createdBy;
  const isDeptPopulated = typeof department === 'object' && department !== null;
  const isCreatedByPopulated = typeof createdBy === 'object' && createdBy !== null;

  return {
    id: raw._id,
    name: raw.name,
    code: raw.code,
    departmentId: isDeptPopulated ? department._id : department,
    departmentName: isDeptPopulated ? department.name : '',
    createdById: isCreatedByPopulated ? createdBy._id : createdBy,
    createdByName: isCreatedByPopulated ? createdBy.name : '',
    contactPerson: raw.contactPerson,
    phone: raw.phone,
    email: raw.email,
    gstNumber: raw.gstNumber,
    panNumber: raw.panNumber,
    address: raw.address,
    state: raw.state,
    district: raw.district,
    city: raw.city,
    pincode: raw.pincode,
    bankDetails: raw.bankDetails,
    category: raw.category,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface VendorFormInput {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstNumber?: string;
  panNumber?: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  bankDetails: BankDetails;
  category: string;
  status?: VendorStatus;
}

export const vendorsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV !== 'production',
  endpoints: (builder) => ({
    getVendors: builder.query<Vendor[], void>({
      query: () => ({ url: '/vendors', method: 'GET', params: { limit: 100 } }),
      transformResponse: (raw: RawVendor[]) => raw.map(toVendor),
      providesTags: (result) => [
        ...(result ?? []).map((item) => ({ type: 'Vendor' as const, id: item.id })),
        { type: 'Vendor' as const, id: 'LIST' },
      ],
    }),

    createVendor: builder.mutation<Vendor, VendorFormInput>({
      query: (body) => ({ url: '/vendors', method: 'POST', data: body }),
      transformResponse: (raw: RawVendor) => toVendor(raw),
      invalidatesTags: [{ type: 'Vendor', id: 'LIST' }],
    }),

    updateVendor: builder.mutation<Vendor, { id: string; body: Partial<VendorFormInput> }>({
      query: ({ id, body }) => ({ url: `/vendors/${id}`, method: 'PATCH', data: body }),
      transformResponse: (raw: RawVendor) => toVendor(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Vendor', id },
        { type: 'Vendor', id: 'LIST' },
      ],
    }),

    setVendorStatus: builder.mutation<Vendor, { id: string; status: VendorStatus }>({
      query: ({ id, status }) => ({ url: `/vendors/${id}/status`, method: 'PATCH', data: { status } }),
      transformResponse: (raw: RawVendor) => toVendor(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Vendor', id },
        { type: 'Vendor', id: 'LIST' },
      ],
    }),

    deleteVendor: builder.mutation<void, string>({
      query: (id) => ({ url: `/vendors/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Vendor', id },
        { type: 'Vendor', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useSetVendorStatusMutation,
  useDeleteVendorMutation,
} = vendorsApi;
