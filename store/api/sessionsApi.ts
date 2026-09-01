import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { SessionActivityBoardData } from "@/types";

export const sessionsApi = createApi({
  reducerPath: "sessionsApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Sessions"],
  endpoints: (builder) => ({
    getSessionActivityBoard: builder.query<SessionActivityBoardData, string>({
      query: (date) => `/sessions?date=${date}`,
      providesTags: (result, error, date) => [{ type: "Sessions", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetSessionActivityBoardQuery } = sessionsApi;
