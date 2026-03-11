import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { CalendarEvent } from "@/types";

export const tasksApi = createApi({
  reducerPath: "tasksApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Calendar"],
  endpoints: (builder) => ({
    getCalendar: builder.query<{ events: CalendarEvent[] }, void>({
      query: () => "/calendar",
      providesTags: ["Calendar"],
      keepUnusedDataFor: 30,
    }),
    getCalendarMonth: builder.query<{ events: CalendarEvent[] }, string>({
      query: (month) => `/calendar?month=${month}`,
      providesTags: (result, error, month) => [{ type: "Calendar", id: month }],
      keepUnusedDataFor: 30,
    }),
  }),
});

export const {
  useGetCalendarQuery,
  useGetCalendarMonthQuery,
} = tasksApi;
