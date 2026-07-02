import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig } from 'axios';

import { apiClient } from '@/services/apiClient';
import { normalizeApiError, type NormalizedApiError } from '@/services/apiError';

type AxiosBaseQueryArgs = Pick<AxiosRequestConfig, 'url' | 'method' | 'data' | 'params'>;

// Every backend response is wrapped as { success, message, data, pagination? }
// (see backend/src/utils/ApiResponse.ts) — unwrap it here once so every RTK Query
// endpoint receives the actual payload directly, instead of the envelope.
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, NormalizedApiError> =>
  async ({ url, method = 'GET', data, params }) => {
    try {
      // FormData (e.g. a PDF upload) must never carry the default 'application/json'
      // Content-Type — let axios/RN compute the multipart boundary on its own.
      const isFormData = data instanceof FormData;
      const result = await apiClient.request<ApiEnvelope<unknown>>({
        url,
        method,
        data,
        params,
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      });
      console.log(`[http] ${method} ${url} → ${result.status}`);
      return { data: result.data.data };
    } catch (error) {
      const normalized = normalizeApiError(error);
      console.error(`[http] ${method} ${url} → ERROR`, JSON.stringify(normalized));
      return { error: normalized };
    }
  };
