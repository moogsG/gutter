import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BacklogTriageData } from "@/types";

export const triageApi = createApi({
  reducerPath: "triageApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Triage"],
  endpoints: (builder) => ({
    getBacklogTriage: builder.query<BacklogTriageData, string | void>({
      query: (date) => {
        const params = new URLSearchParams();
        if (date) params.set("date", date);
        const suffix = params.toString();
        return `/triage${suffix ? `?${suffix}` : ""}`;
      },
      providesTags: ["Triage"],
    }),
  }),
});

export const { useGetBacklogTriageQuery } = triageApi;
