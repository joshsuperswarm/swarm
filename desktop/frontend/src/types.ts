export interface RepoSummary {
  root: string;
  name: string;
  file_count: number;
}

export interface FileMeta {
  relpath: string;
  size: number;
  mtime: number;
  is_binary: boolean;
}

export interface FileToken {
  relpath: string;
  bytes: number;
  tokens: number;
  is_binary: boolean;
}

export interface TokenReport {
  files: FileToken[];
  total_tokens: number;
  total_bytes: number;
  encoding: string;
  model_context_window: number;
  may_exceed_context: boolean;
}

export interface ImageAttachment {
  data: string; // base64 data URL
  type: string; // MIME type
  name: string; // file name
}

export interface Citation {
  url: string;
  domain: string;
  title?: string | null;
  index?: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  includedFiles?: string[]; // Files included in this message (for user messages)
  images?: ImageAttachment[]; // Image attachments
  citations?: Citation[]; // NEW: parsed web citations
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  apiMessages: ChatMessage[];
  isStreaming: boolean;
  activeRequestId: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  droppedImages: ImageAttachment[];
  filesAlreadySent: boolean;
  titlePending?: boolean;
  titleStatus?: 'generating' | 'success' | 'error' | 'fallback';
}