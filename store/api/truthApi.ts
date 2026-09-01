import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ProjectTruthData } from "@/types";

export const truthApi = createApi({
  reducerPath: "truthApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Truth"],
  endpoints: (builder) => ({
    getProjectTruth: builder.query<ProjectTruthData, string>({
      query: (date) => `/truth?date=${date}`,
      providesTags: (result, error, date) => [{ type: "Truth", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetProjectTruthQuery } = truthApi;
