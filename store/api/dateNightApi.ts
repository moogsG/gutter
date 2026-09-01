import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { DateNightData } from "@/types";

export const dateNightApi = createApi({
  reducerPath: "dateNightApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["DateNight"],
  endpoints: (builder) => ({
    getDateNight: builder.query<DateNightData, string>({
      query: (date) => `/date-night?date=${date}`,
      providesTags: (result, error, date) => [{ type: "DateNight", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetDateNightQuery } = dateNightApi;
