import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { WipLimitData } from "@/types";

export const wipApi = createApi({
  reducerPath: "wipApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  endpoints: (builder) => ({
    getWipLimit: builder.query<WipLimitData, string>({
      query: (date) => `/wip?date=${date}`,
      keepUnusedDataFor: 30,
    }),
  }),
});

export const { useGetWipLimitQuery } = wipApi;
