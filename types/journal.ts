export type Signifier = 'task' | 'appointment' | 'note' | 'memory' | 'important';
export type EntryStatus = 'open' | 'in-progress' | 'blocked' | 'done' | 'migrated' | 'killed';
export type TaskLane = 'work' | 'personal' | 'family' | 'jw' | 'petalz';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface JournalEntry {
  id: string;
  date: string;
  signifier: Signifier;
  text: string;
  status: EntryStatus;
  lane?: TaskLane | null;
  priority?: TaskPriority | null;
  waiting_on?: string | null;
  migrated_to?: string;
  migrated_from?: string;
  collection_id?: string;
  parent_id?: string | null;
  tags: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
  children?: JournalEntry[];
}

export interface NewEntry {
  date: string;
  signifier: Signifier;
  text: string;
  tags?: string[];
  parent_id?: string;
  lane?: TaskLane;
  priority?: TaskPriority;
  waiting_on?: string;
}

export interface Collection {
  id: string;
  title: string;
  icon?: string;
  created_at: string;
  entry_count?: number;
}

export interface FutureLogEntry {
  id: string;
  target_month: string;
  signifier: Signifier;
  text: string;
  migrated: boolean;
  created_at: string;
}

export interface SemanticSearchResult {
  id: string;
  text: string;
  date: string;
  signifier: string;
  collection_id: string;
  _distance: number;
}
