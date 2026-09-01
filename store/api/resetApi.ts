import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { EveningResetData } from "@/types";

export const resetApi = createApi({
  reducerPath: "resetApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["EveningReset"],
  endpoints: (builder) => ({
    getEveningReset: builder.query<EveningResetData, string>({
      query: (date) => `/reset?date=${date}`,
      providesTags: (result, error, date) => [{ type: "EveningReset", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetEveningResetQuery } = resetApi;
