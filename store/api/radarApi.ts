import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { FollowThroughMutationResponse, FollowThroughRadarData } from "@/types";

export const radarApi = createApi({
  reducerPath: "radarApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Radar"],
  endpoints: (builder) => ({
    getFollowThroughRadar: builder.query<FollowThroughRadarData, string | void>({
      query: (date) => {
        const params = new URLSearchParams();
        if (date) params.set("date", date);
        const suffix = params.toString();
        return `/radar${suffix ? `?${suffix}` : ""}`;
      },
      providesTags: ["Radar"],
    }),
    updateFollowThroughPromise: builder.mutation<
      FollowThroughMutationResponse,
      { promiseId: string; status: "resolved" | "dropped" }
    >({
      query: (body) => ({
        url: "/radar",
        method: "POST",
        body: {
          action: "promise-status",
          ...body,
        },
      }),
      invalidatesTags: ["Radar"],
    }),
    updateFollowThroughTask: builder.mutation<
      FollowThroughMutationResponse,
      { taskId: string; status: "open" | "in-progress" | "blocked" | "done" | "killed" }
    >({
      query: (body) => ({
        url: "/radar",
        method: "POST",
        body: {
          action: "task-status",
          ...body,
        },
      }),
      invalidatesTags: ["Radar"],
    }),
  }),
});

export const {
  useGetFollowThroughRadarQuery,
  useUpdateFollowThroughPromiseMutation,
  useUpdateFollowThroughTaskMutation,
} = radarApi;
