import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ProjectRunwayData } from "@/types";

export const projectRunwayApi = createApi({
  reducerPath: "projectRunwayApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["ProjectRunway"],
  endpoints: (builder) => ({
    getProjectRunway: builder.query<ProjectRunwayData, string>({
      query: (date) => `/project-runway?date=${date}`,
      providesTags: (result, error, date) => [{ type: "ProjectRunway", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetProjectRunwayQuery } = projectRunwayApi;
