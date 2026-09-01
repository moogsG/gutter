import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ChoreBoardData } from "@/types";

export const choresApi = createApi({
  reducerPath: "choresApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Chores"],
  endpoints: (builder) => ({
    getChoreBoard: builder.query<ChoreBoardData, void>({
      query: () => "/chores",
      providesTags: ["Chores"],
      keepUnusedDataFor: 60,
    }),
    updateChoreBoard: builder.mutation<
      ChoreBoardData,
      { action: "complete" | "pick" | "reset" | "reopen"; selection?: string }
    >({
      query: (body) => ({
        url: "/chores",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Chores"],
    }),
  }),
});

export const { useGetChoreBoardQuery, useUpdateChoreBoardMutation } = choresApi;
