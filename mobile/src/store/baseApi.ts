import { createApi } from '@reduxjs/toolkit/query/react';

import { axiosBaseQuery } from '@/store/axiosBaseQuery';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Auth', 'User', 'Department', 'Users', 'Vendor', 'Quotation', 'Bill', 'Notification', 'Setting', 'Payment'],
  endpoints: () => ({}),
});
