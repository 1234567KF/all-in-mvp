// Shared types for Extension Host ↔ WebView communication

export interface VsMessage<T = unknown> {
  type: string;
  payload: T;
  requestId?: string;
}

export interface Heading {
  id: string;
  level: number;
  text: string;
  children: Heading[];
}

export interface DiffChange {
  id: string;
  type: 'insert' | 'delete' | 'modify';
  position: {
    sectionId: string;
    line: number;
    column: number;
  };
  oldText?: string;
  newText?: string;
  elementType: 'heading' | 'paragraph' | 'table-cell' | 'code-block' | 'image' | 'list-item' | 'mermaid-block';
  accepted: boolean;
}

export interface DiffStats {
  inserted: number;
  deleted: number;
  modified: number;
}

export interface Revision {
  id: string;
  timestamp: string;
  triggerer: 'ai' | 'human';
  changes: DiffChange[];
  stats: DiffStats;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface BaseVersion {
  content: string;
  markedAt: string;
  filePath: string;
}

export interface RevisionStore {
  version: 1;
  filePath: string;
  baseVersion: BaseVersion | null;
  revisions: Revision[];
}

// Extension → WebView messages
export interface DocumentLoadedPayload {
  content: string;
  headings: Heading[];
  revisionStore: RevisionStore;
}

export interface DocumentChangedPayload {
  content: string;
  headings: Heading[];
}

export interface DiffResultPayload {
  changes: DiffChange[];
  stats: DiffStats;
}

export interface RevisionUpdatedPayload {
  revisions: Revision[];
  baseVersion: BaseVersion | null;
}
