import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { HabitsMomentumData } from "@/types";

export const habitsApi = createApi({
  reducerPath: "habitsApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Habits"],
  endpoints: (builder) => ({
    getHabitsMomentum: builder.query<HabitsMomentumData, string>({
      query: (date) => `/habits?date=${date}`,
      providesTags: (result, error, date) => [{ type: "Habits", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetHabitsMomentumQuery } = habitsApi;
