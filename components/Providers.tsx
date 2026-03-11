"use client";

import { Provider } from "react-redux";
import { store } from "@/store/store";
import { ProjectProvider } from "@/lib/ProjectContext";
import { NotificationProvider } from "@/lib/NotificationContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ProjectProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </ProjectProvider>
    </Provider>
  );
}
