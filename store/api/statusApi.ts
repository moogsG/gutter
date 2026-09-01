import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { StatusBoardData } from "@/types";

export const statusApi = createApi({
  reducerPath: "statusApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Status"],
  endpoints: (builder) => ({
    getStatusBoard: builder.query<StatusBoardData, string>({
      query: (date) => `/status?date=${date}`,
      providesTags: (result, error, date) => [{ type: "Status", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetStatusBoardQuery } = statusApi;
