import { baseApi } from '@/store/baseApi';
import type {
  ApprovalRoute,
  CeoQuotationStats,
  DirectorApproval,
  DirectorDecision,
  DirectorQuotationStats,
  LinkedBillSummary,
  LinkedPurchaseOrderSummary,
  Quotation,
  QuotationCurrency,
  QuotationPdfVersion,
  QuotationPriority,
  QuotationStatus,
} from '@/features/quotations/types';

interface RawRef {
  _id: string;
  name: string;
  code?: string;
  email?: string;
  status?: string;
}

interface RawLinkedPo {
  _id: string;
  poNumber: string;
  grandTotal: number;
  status: string;
  createdBy?: { name?: string } | string;
}

interface RawLinkedBill {
  _id: string;
  billCode: string;
  status: string;
  invoiceAmount: number;
  uploadedByName?: string;
  uploadedByRole?: string;
}

interface RawDirectorApproval {
  directorId: string;
  directorName: string;
  decision: DirectorApproval['decision'];
  remarks?: string;
  decidedAt: string | null;
}

interface RawQuotation {
  _id: string;
  quotationCode: string;
  vendor: RawRef | string;
  department: RawRef | string;
  createdBy: RawRef | string;
  submittedBy?: RawRef | string;
  linkedPurchaseOrder?: RawLinkedPo | null;
  linkedBill?: RawLinkedBill | null;
  quotationDate: string;
  requiredDate: string;
  amount: number;
  gst: number;
  currency: QuotationCurrency;
  paymentTerms: string;
  deliveryTerms: string;
  priority: QuotationPriority;
  description?: string;
  pdfFiles: QuotationPdfVersion[];
  remarks?: string;
  directorRemarks?: string;
  directorApprovals?: RawDirectorApproval[];
  approvalRoute?: ApprovalRoute;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
}

function toLinkedPurchaseOrder(raw?: RawLinkedPo | null): LinkedPurchaseOrderSummary | null {
  if (!raw) return null;
  const createdBy = raw.createdBy;
  return {
    id: raw._id,
    poNumber: raw.poNumber,
    grandTotal: raw.grandTotal,
    status: raw.status,
    createdByName: typeof createdBy === 'object' && createdBy !== null ? createdBy.name : undefined,
  };
}

function toLinkedBill(raw?: RawLinkedBill | null): LinkedBillSummary | null {
  if (!raw) return null;
  return {
    id: raw._id,
    billCode: raw.billCode,
    status: raw.status,
    invoiceAmount: raw.invoiceAmount,
    uploadedByName: raw.uploadedByName,
    uploadedByRole: raw.uploadedByRole,
  };
}

function toQuotation(raw: RawQuotation): Quotation {
  const vendor = raw.vendor;
  const department = raw.department;
  const createdBy = raw.createdBy;
  const submittedBy = raw.submittedBy;
  const isVendorPopulated = typeof vendor === 'object' && vendor !== null;
  const isDeptPopulated = typeof department === 'object' && department !== null;
  const isCreatedByPopulated = typeof createdBy === 'object' && createdBy !== null;
  const isSubmittedByPopulated = typeof submittedBy === 'object' && submittedBy !== null;

  return {
    id: raw._id,
    quotationCode: raw.quotationCode,
    vendorId: isVendorPopulated ? vendor._id : vendor,
    vendorName: isVendorPopulated ? vendor.name : '',
    vendorCode: isVendorPopulated ? (vendor.code ?? '') : '',
    departmentId: isDeptPopulated ? department._id : department,
    departmentName: isDeptPopulated ? department.name : '',
    createdById: isCreatedByPopulated ? createdBy._id : createdBy,
    createdByName: isCreatedByPopulated ? createdBy.name : '',
    submittedByName: isSubmittedByPopulated ? submittedBy.name : (isCreatedByPopulated ? createdBy.name : undefined),
    linkedPurchaseOrder: toLinkedPurchaseOrder(raw.linkedPurchaseOrder),
    linkedBill: toLinkedBill(raw.linkedBill),
    quotationDate: raw.quotationDate,
    requiredDate: raw.requiredDate,
    amount: raw.amount,
    gst: raw.gst,
    currency: raw.currency,
    paymentTerms: raw.paymentTerms,
    deliveryTerms: raw.deliveryTerms,
    priority: raw.priority,
    description: raw.description,
    pdfFiles: raw.pdfFiles ?? [],
    remarks: raw.remarks,
    directorRemarks: raw.directorRemarks,
    directorApprovals: raw.directorApprovals ?? [],
    // submit/resubmit's raw response doesn't carry the roster/route enrichment (only
    // list/getById/decide do) — harmless placeholder, overwritten by the refetch those
    // mutations already trigger via invalidatesTags.
    approvalRoute: raw.approvalRoute ?? 'directors',
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface QuotationFormInput {
  vendor: string;
  quotationDate: string;
  requiredDate: string;
  amount: number;
  gst: number;
  currency: QuotationCurrency;
  paymentTerms: string;
  deliveryTerms: string;
  priority: QuotationPriority;
  description?: string;
  remarks?: string;
}

export const quotationsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV !== 'production',
  endpoints: (builder) => ({
    getQuotations: builder.query<Quotation[], void>({
      query: () => ({ url: '/quotations', method: 'GET', params: { limit: 100 } }),
      transformResponse: (raw: RawQuotation[]) => raw.map(toQuotation),
      providesTags: (result) => [
        ...(result ?? []).map((item) => ({ type: 'Quotation' as const, id: item.id })),
        { type: 'Quotation' as const, id: 'LIST' },
      ],
    }),

    // Single-quotation fetch — carries linkedPurchaseOrder/linkedBill/submittedBy that the
    // list endpoint doesn't enrich (would be an N+1 lookup per row at list scale). Used by
    // the approval screen instead of the old list+find pattern for those extra fields.
    getQuotationById: builder.query<Quotation, string>({
      query: (id) => ({ url: `/quotations/${id}`, method: 'GET' }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      providesTags: (_result, _error, id) => [{ type: 'Quotation', id }],
    }),

    getDirectorQuotationStats: builder.query<DirectorQuotationStats, void>({
      query: () => ({ url: '/quotations/stats/director', method: 'GET' }),
      providesTags: [{ type: 'Quotation', id: 'DIRECTOR_STATS' }],
    }),

    getCeoQuotationStats: builder.query<CeoQuotationStats, void>({
      query: () => ({ url: '/quotations/stats/ceo', method: 'GET' }),
      providesTags: [{ type: 'Quotation', id: 'CEO_STATS' }],
    }),

    // Every Director acts independently — see quotation.service.ts `decide()`. This never
    // requires every Director to approve; it just appends/updates this Director's own
    // entry in `directorApprovals` without touching another Director's record.
    decideQuotation: builder.mutation<Quotation, { id: string; decision: DirectorDecision; remarks?: string }>({
      query: ({ id, decision, remarks }) => ({ url: `/quotations/${id}/decision`, method: 'PATCH', data: { decision, remarks } }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Quotation', id },
        { type: 'Quotation', id: 'LIST' },
        { type: 'Quotation', id: 'DIRECTOR_STATS' },
        { type: 'Quotation', id: 'CEO_STATS' },
      ],
    }),

    createQuotation: builder.mutation<Quotation, QuotationFormInput>({
      query: (body) => ({ url: '/quotations', method: 'POST', data: body }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      invalidatesTags: [{ type: 'Quotation', id: 'LIST' }],
    }),

    updateQuotation: builder.mutation<Quotation, { id: string; body: Partial<QuotationFormInput> }>({
      query: ({ id, body }) => ({ url: `/quotations/${id}`, method: 'PATCH', data: body }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Quotation', id },
        { type: 'Quotation', id: 'LIST' },
      ],
    }),

    // Submitting/resubmitting notifies whichever role the amount routes to (CEO or both
    // Directors), which changes that role's dashboard counts — both stats tags invalidate
    // unconditionally since the route can change live (see resolveApprovalRoute) and the
    // mobile client doesn't independently know which one applies.
    submitQuotation: builder.mutation<Quotation, string>({
      query: (id) => ({ url: `/quotations/${id}/submit`, method: 'PATCH' }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Quotation', id },
        { type: 'Quotation', id: 'LIST' },
        { type: 'Quotation', id: 'DIRECTOR_STATS' },
        { type: 'Quotation', id: 'CEO_STATS' },
      ],
    }),

    resubmitQuotation: builder.mutation<Quotation, string>({
      query: (id) => ({ url: `/quotations/${id}/resubmit`, method: 'PATCH' }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Quotation', id },
        { type: 'Quotation', id: 'LIST' },
        { type: 'Quotation', id: 'DIRECTOR_STATS' },
        { type: 'Quotation', id: 'CEO_STATS' },
      ],
    }),

    deleteQuotation: builder.mutation<void, string>({
      query: (id) => ({ url: `/quotations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Quotation', id },
        { type: 'Quotation', id: 'LIST' },
      ],
    }),

    // FormData flows through BaseQuery's own multipart handling — still a normal
    // RTK Query mutation, never a manual axios call outside the RTK Query cache.
    uploadQuotationPdf: builder.mutation<Quotation, { id: string; formData: FormData }>({
      query: ({ id, formData }) => ({ url: `/quotations/${id}/pdf`, method: 'POST', data: formData }),
      transformResponse: (raw: RawQuotation) => toQuotation(raw),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Quotation', id },
        { type: 'Quotation', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetQuotationsQuery,
  useGetQuotationByIdQuery,
  useGetDirectorQuotationStatsQuery,
  useGetCeoQuotationStatsQuery,
  useDecideQuotationMutation,
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
  useSubmitQuotationMutation,
  useResubmitQuotationMutation,
  useDeleteQuotationMutation,
  useUploadQuotationPdfMutation,
} = quotationsApi;
