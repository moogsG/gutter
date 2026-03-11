export interface Task {
  id: string;
  text: string;
  project: string;
  priority: string;
  status: string;
  owner: string;
  parent_id?: string | null;
  due_date: string | null;
  blocked_by: string | null;
  jira_key: string | null;
  created_at: string;
  completed_at: string | null;
  tags: string;
  context_notes?: string;
  brand_font?: string;
  business_model?: string;
  external_business_name?: string;
  subtasks?: Task[];
}

export interface DailyLogEntry {
  id: string;
  text: string;
  project: string;
  completed_at: string;
  type: "completed" | "captured" | "note";
}

export interface WinStats {
  today: number;
  week: number;
  streak: number;
}

export interface CaptureInput {
  text: string;
  category?: "task" | "idea" | "reminder" | "note" | "chat";
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  calendar: string;
  allDay: boolean;
}

export interface MeetingPrep {
  id: string;
  eventId: string;
  title: string;
  time: string;
  calendar: string;
  occurrenceDate?: string;
  prepNotes: string | null;
  prepStatus: "none" | "preparing" | "ready";
  transcript: string | null;
  summary: string | null;
  actionItems: string[] | null;
}
