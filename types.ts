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

// Represents the response from a single model in a turn
export interface ModelResponse {
  modelId: string;
  content: string;
  status: 'loading' | 'streaming' | 'complete' | 'error';
}

// Represents a single turn of conversation
export interface Turn {
  id: string;
  timestamp: number;
  userMessage: Message;
  // Responses from all models that participated in this turn
  candidates: Record<string, ModelResponse>;
  // Which models are selected to continue to the next turn
  selectedModelIds: string[];
}
