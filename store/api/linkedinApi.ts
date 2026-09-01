import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { LinkedInBoardData } from "@/types";

export const linkedinApi = createApi({
  reducerPath: "linkedinApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["LinkedIn"],
  endpoints: (builder) => ({
    getLinkedInBoard: builder.query<LinkedInBoardData, string>({
      query: (date) => `/linkedin?date=${date}`,
      providesTags: (result, error, date) => [{ type: "LinkedIn", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetLinkedInBoardQuery } = linkedinApi;
