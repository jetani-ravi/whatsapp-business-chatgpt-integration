import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

interface ConversationContext {
  messages: ChatCompletionMessageParam[];
  phoneNumber: string;
}

// Store conversation contexts in memory (consider using Redis for production)
const conversationContexts = new Map<string, ConversationContext>();

export const getChatGPTResponse = async (
  message: string, 
  _phoneNumber: string,
  systemMessage: ChatCompletionSystemMessageParam,
  conversationHistory: Array<any> = []
) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: conversationHistory.length > 0 ? conversationHistory : [
        systemMessage,
        { role: 'user', content: message }
      ],
      tools: [{
        type: "function",
        function: {
          name: "avviare_chiamata_vocale",
          description: "Avvia una chiamata vocale al cliente",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      }]
    });

    // Ensure we always return a message, even if it's null
    return response?.choices[0]?.message;
  } catch (error) {
    console.error('Error getting ChatGPT response:', error);
    throw error;
  }
};

export const clearConversationContext = (phoneNumber: string) => {
  conversationContexts.delete(phoneNumber);
};

export const detectIntent = async (message: string): Promise<{
  intent: 'channel_preference' | 'general_question',
  confidence: number
}> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "Sei un classificatore di intenti. Classifica il messaggio dell'utente in uno di questi intenti: channel_preference, general_question. Rispondi solo in formato JSON."
      },
      {
        role: "user",
        content: message
      }
    ],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response?.choices[0]?.message?.content || '{}');
};
export default {
  getChatGPTResponse,
  clearConversationContext,
  detectIntent
};