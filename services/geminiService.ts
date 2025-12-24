import { GoogleGenAI, Part } from "@google/genai";
import { Message, ModelConfig, Turn } from "../types";

// Initialize the client
// NOTE: We are using the Gemini API to power this multi-model demo.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Reconstructs the linear chat history for a specific model from the branched turn history.
 */
export const getHistoryForModel = (modelId: string, turns: Turn[]): Message[] => {
  const history: Message[] = [];
  
  for (const turn of turns) {
    // Always add the user message from the turn
    history.push(turn.userMessage);
    
    // Check if this model participated in this turn
    const response = turn.candidates[modelId];
    if (response) {
      // Add the model's response
      history.push({
        role: 'model',
        content: response.content,
        timestamp: turn.timestamp // This timestamp is technically start time, but fine for ordering
      });
    }
    // If the model didn't participate (was deselected), it misses this turn's response
    // but typically still sees the user prompt if re-engaged. 
    // However, in this specific logic, we are building history for the NEXT prompt.
    // If a model was skipped in Turn N, history[Turn N] will contain User Message but NO Model Message.
    // Most LLMs handle consecutive user messages fine, or we can treat it as a fresh turn.
  }

  return history;
};

/**
 * Simulates a specific model's response using Gemini with a specific system instruction.
 * Supports multimodal input (images/video).
 * 
 * @param modelConfig The configuration of the model being simulated
 * @param history The chat history
 * @param onChunk Callback for streaming chunks
 * @returns Final full text
 */
export const streamModelResponse = async (
  modelConfig: ModelConfig,
  history: Message[],
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    // 1. Prepare History for Gemini Chat
    // Filter out empty text messages if they have no attachments, to prevent errors.
    const validHistory = history.filter(h => h.content.trim() !== '' || (h.attachments && h.attachments.length > 0));
    
    // Take the last few turns to avoid context overflow in this demo
    // Note: We need to be careful not to break the User-Model-User pattern if strict.
    // Gemini is generally flexible with consecutive user messages.
    const recentHistory = validHistory.slice(-20); 
    const lastUserMessage = recentHistory[recentHistory.length - 1];

    if (!lastUserMessage || lastUserMessage.role !== 'user') {
      // Fallback or error if history is malformed (e.g. ended with model message)
      // For this app structure, streamModelResponse is called *after* user input, so last msg is user.
      throw new Error("Last message must be from user");
    }

    // Previous history excluding the very last message (which is the new prompt)
    const historyParts = recentHistory.slice(0, -1).map(msg => {
      const parts: Part[] = [];
      
      // Add text part if exists
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Add attachment parts if exist
      if (msg.attachments) {
        msg.attachments.forEach(att => {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data
            }
          });
        });
      }

      return {
        role: msg.role,
        parts: parts
      };
    });

    // 2. Initialize Chat
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash', // Flash supports multimodal input
      config: {
        systemInstruction: modelConfig.systemPrompt,
        temperature: 0.7,
      },
      history: historyParts,
    });

    // 3. Prepare the new message parts
    const currentMessageParts: Part[] = [];
    if (lastUserMessage.content) {
      currentMessageParts.push({ text: lastUserMessage.content });
    }
    if (lastUserMessage.attachments) {
      lastUserMessage.attachments.forEach(att => {
        currentMessageParts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }

    // 4. Send Message Stream
    const resultStream = await chat.sendMessageStream({
      message: currentMessageParts 
    });

    let fullText = '';
    
    for await (const chunk of resultStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }

    return fullText;

  } catch (error) {
    console.error(`Error streaming response for ${modelConfig.name}:`, error);
    throw error;
  }
};
