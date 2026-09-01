import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { SchoolBoardData } from "@/types";

export const schoolApi = createApi({
  reducerPath: "schoolApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["School"],
  endpoints: (builder) => ({
    getSchool: builder.query<SchoolBoardData, string>({
      query: (date) => `/school?date=${date}`,
      providesTags: (result, error, date) => [{ type: "School", id: date }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetSchoolQuery } = schoolApi;
