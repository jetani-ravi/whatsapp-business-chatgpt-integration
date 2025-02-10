import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

const MAX_CONVERSATION_HISTORY = 15; // Maximum number of messages to keep in history

interface ConversationContext {
  messages: ChatCompletionMessageParam[];
  phoneNumber: string;
}

// Store conversation contexts in memory (consider using Redis for production)
const conversationContexts = new Map<string, ConversationContext>();

export const getChatGPTResponse = async (
  message: string, 
  phoneNumber: string, 
  systemMessage?: ChatCompletionSystemMessageParam
) => {
  try {
    // Get or initialize conversation context
    let context = conversationContexts.get(phoneNumber);
    if (!context) {
      context = {
        messages: systemMessage ? [systemMessage] : [],
        phoneNumber
      };
      conversationContexts.set(phoneNumber, context);
    }

    // Add user message to context
    context.messages.push({
      role: 'user',
      content: message,
    });

    // Trim conversation history if it exceeds the limit
    // Keep system message (if exists) and last MAX_CONVERSATION_HISTORY messages
    if (context.messages.length > MAX_CONVERSATION_HISTORY) {
      const systemMsg = context.messages.find(msg => msg.role === 'system');
      const recentMessages = context.messages.slice(-MAX_CONVERSATION_HISTORY);
      context.messages = systemMsg 
        ? [systemMsg, ...recentMessages.filter(msg => msg.role !== 'system')]
        : recentMessages;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: context.messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'initiate_voice_call',
            description: 'Initiate a voice call to the customer',
          }
        }
      ],
      temperature: 0.4,
    });

    const assistantResponse = completion.choices[0]?.message;
    
    if (assistantResponse) {
      // Store assistant's response in context
      context.messages.push(assistantResponse);
      
      // Handle tool calls if any
      if (assistantResponse.tool_calls) {
        // Add tool response messages for each tool call
        for (const toolCall of assistantResponse.tool_calls) {
          context.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Call initiated successfully', // Or appropriate response based on the tool call
          });
        }

        // Make another API call to get the final response
        const finalCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: context.messages,
          temperature: 0.4,
        });

        const finalResponse = finalCompletion.choices[0]?.message;
        if (finalResponse) {
          context.messages.push(finalResponse);
          return {
            content: finalResponse.content,
            toolCalls: assistantResponse.tool_calls
          };
        }
      }

      return {
        content: assistantResponse.content,
        toolCalls: null
      };
    }

    return {
      content: 'I apologize, but I am facing issues while responding',
      toolCalls: null
    };
  } catch (error) {
    console.error('Error in getChatGPTResponse:', error);
    return {
      content: 'Sorry, I encountered an error while processing your request.',
      toolCalls: null
    };
  }
};

export const clearConversationContext = (phoneNumber: string) => {
  conversationContexts.delete(phoneNumber);
};

export const detectIntent = async (message: string): Promise<{
  intent: 'start_consultation' | 'channel_preference' | 'general_question',
  confidence: number
}> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an intent classifier. Classify the user message into one of these intents: start_consultation, channel_preference, general_question. Respond with JSON only."
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