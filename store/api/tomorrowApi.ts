import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { TomorrowLaunchpadData } from "@/types";

export const tomorrowApi = createApi({
  reducerPath: "tomorrowApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["TomorrowLaunchpad"],
  endpoints: (builder) => ({
    getTomorrowLaunchpad: builder.query<TomorrowLaunchpadData, string>({
      query: (date) => `/tomorrow?date=${date}`,
      providesTags: (result, error, date) => [{ type: "TomorrowLaunchpad", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetTomorrowLaunchpadQuery } = tomorrowApi;
