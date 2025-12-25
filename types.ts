
export interface Attachment {
  type: 'image' | 'video';
  mimeType: string;
  url: string; // Base64 Data URL for display
  data: string; // Raw Base64 string for API
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  timestamp: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  color: string;
  avatar: string;
  description: string;
  systemPrompt: string;
}

export interface ModelResponse {
  modelId: string;
  content: string;
  status: 'loading' | 'streaming' | 'complete' | 'error';
}

export interface Turn {
  id: string;
  timestamp: number;
  userMessage: Message;
  candidates: Record<string, ModelResponse>;
  selectedModelIds: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
}
