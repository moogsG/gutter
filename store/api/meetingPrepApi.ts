import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { MeetingPrep } from "@/types";

export const meetingPrepApi = createApi({
  reducerPath: "meetingPrepApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["MeetingPrep"],
  endpoints: (builder) => ({
    getMeetingPrep: builder.query<{ meetings: MeetingPrep[] }, void>({
      query: () => "/meeting-prep",
      providesTags: ["MeetingPrep"],
    }),
    requestPrep: builder.mutation<{ ok: boolean; id: string }, {
      eventId: string;
      title: string;
      time: string;
      calendar: string;
      context?: string;
    }>({
      query: (body) => ({
        url: "/meeting-prep/prepare",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MeetingPrep"],
    }),
    uploadTranscript: builder.mutation<{ ok: boolean; id: string }, {
      eventId: string;
      title: string;
      time: string;
      calendar: string;
      transcript: string;
    }>({
      query: (body) => ({
        url: "/meeting-prep/transcript",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MeetingPrep"],
    }),
  }),
});

export const {
  useGetMeetingPrepQuery,
  useRequestPrepMutation,
  useUploadTranscriptMutation,
} = meetingPrepApi;
