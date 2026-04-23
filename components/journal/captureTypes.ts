export type ProcessMode = "organize" | "talk" | "both";
export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  result?: {
    entriesCreated?: number;
    conversationalSaved?: boolean;
    savedAs?: string | null;
  };
}

export interface ConversationState {
  messages: Message[];
}
