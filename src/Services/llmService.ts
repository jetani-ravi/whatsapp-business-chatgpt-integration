import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Define the supported LLM providers
export type LLMProvider = 'anthropic';

// Define the interface for LLM responses
export interface LLMResponse {
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

// Define the interface for intent detection
export interface IntentResponse {
  intent: string;
  confidence: number;
}

// Define the interface for channel preference detection
export interface ChannelPreferenceResponse {
  intent: 'voice' | 'whatsapp' | 'chat';
  confidence: number;
}

// Define the tools for the LLM in the format expected by Anthropic SDK
const tools: Anthropic.Tool[] = [
  {
    name: "avviare_chiamata_vocale",
    description: "Avvia una chiamata vocale al cliente",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "nome_cliente_del_negozio",
    description: "memorizzare il nome del cliente che viene comunicato dal cliente",
    input_schema: {
      type: "object",
      properties: {
        first_name: {
          type: "string",
          description: "il nome del cliente"
        }
      },
      required: ["first_name"]
    }
  }
];

// Define the interface for Anthropic tool usage in the response
interface AnthropicToolUse {
  id: string;
  type: string;
  name: string;
  input: Record<string, any>;
}

// Helper function to extract JSON from possibly markdown-wrapped content
const extractJsonFromText = (text: string): any => {
  try {
    // First try direct parsing
    return JSON.parse(text);
  } catch (e) {
    // If that fails, try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (innerError) {
        console.error('Error parsing extracted JSON:', innerError);
        throw innerError;
      }
    }
    
    // If no code blocks, try to find anything that looks like JSON
    const possibleJson = text.match(/{[\s\S]*?}/);
    if (possibleJson) {
      try {
        return JSON.parse(possibleJson[0]);
      } catch (innerError) {
        console.error('Error parsing possible JSON:', innerError);
        throw innerError;
      }
    }
    
    throw new Error('No valid JSON found in response');
  }
};

// Maximum number of retries for API calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Sleep function for implementing delay between retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// LLM service class
export class LLMService {
  private client: Anthropic;
  private provider: LLMProvider;
  private modelName: string;
  private temperature: number;

  constructor(provider: LLMProvider = 'anthropic') {
    this.provider = provider;
    this.modelName = 'claude-3-7-sonnet-20250219';
    this.temperature = 0.3;
    this.client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY']
    });
  }

  // Convert OpenAI-style messages to Anthropic messages
  private convertToAnthropicMessages(messages: any[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'system') {
        // System message will be handled separately
        return msg;
      }
      return {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      };
    }).filter(msg => msg.role !== 'system');
  }

  // Extract system message from conversation history
  private extractSystemMessage(messages: any[]): string | undefined {
    const systemMsg = messages.find(msg => msg.role === 'system');
    return systemMsg?.content;
  }

  // Get a response from the LLM with retry logic
  public async getResponse(
    message: string,
    systemMessage: string,
    conversationHistory: any[] = []
  ): Promise<LLMResponse> {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Prepare messages for Anthropic API
        let systemMessageWithTools = `${systemMessage}\n\nYou have access to the following tools:\n${JSON.stringify(tools, null, 2)}`;
        
        let messages: Anthropic.MessageParam[] = [];
        
        if (conversationHistory.length > 0) {
          // If we have conversation history, use it
          // Convert conversation history to Anthropic messages
          messages = this.convertToAnthropicMessages(conversationHistory);
          
          // Add the current message if it's not already included in the history
          const lastMessage = conversationHistory[conversationHistory.length - 1];
          if (lastMessage?.role !== 'user' || lastMessage?.content !== message) {
            messages.push({ role: 'user', content: message });
          }
        } else {
          // For new conversations, just add the user's message
          messages.push({ role: 'user', content: message });
        }

        // Call Anthropic API with tools
        const response = await this.client.messages.create({
          model: this.modelName,
          system: systemMessageWithTools,
          messages: messages,
          temperature: this.temperature,
          tools: tools,
          max_tokens: 1000
        });
        
        console.log('getResponse response____', JSON.stringify(response));
        
        // Process the response to extract content and tool calls
        let toolCalls: Array<{function: {name: string; arguments: string}}> = [];
        
        // Find the text content block (might not exist if only tool_use is returned)
        const textBlock = response.content.find(block => block.type === 'text');
        let content = textBlock ? textBlock.text : '';
        
        // Find any tool_use blocks
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
        
        if (toolUseBlocks.length > 0) {
          toolCalls = toolUseBlocks.map(block => ({
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          }));
          
          // If we only got tool use and no text content, add a default acknowledgment
          if (!content && toolUseBlocks.length > 0) {
            // For "nome_cliente_del_negozio" specifically, add a greeting with the name
            if (toolUseBlocks[0].name === 'nome_cliente_del_negozio') {
              const input = toolUseBlocks[0].input as { first_name?: string };
              if (input?.first_name) {
                content = `Ciao ${input.first_name}! Grazie per avermi fornito il tuo nome.`;
              } else {
                content = 'Grazie per avermi fornito il tuo nome.';
              }
            } else {
              content = 'Ho capito la tua richiesta.';
            }
          }
        }
        
        // Return the standardized response
        return {
          content,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        };
      } catch (error: any) {
        console.error(`Error attempt ${attempt}/${MAX_RETRIES} getting response from ${this.provider}:`, error);
        lastError = error;
        
        // Check if it's an overloaded error (529) or rate limit error
        if (error?.status === 529 || error?.status === 429) {
          const retryDelay = RETRY_DELAY_MS * attempt;
          console.log(`API overloaded or rate limited. Retrying in ${retryDelay}ms...`);
          await sleep(retryDelay);
          continue;
        }
        
        // For other errors, just throw
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error(`Failed after ${MAX_RETRIES} attempts`);
  }

  // Detect intent using the LLM with retry logic
  public async detectIntent(message: string): Promise<IntentResponse> {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const systemMessage = 'Sei un classificatore di intenti. Classifica il messaggio dell\'utente in uno di questi intenti: channel_preference, general_question. Rispondi solo in formato JSON con i campi "intent" e "confidence" (un numero tra 0 e 1).';
        
        const response = await this.client.messages.create({
          model: this.modelName,
          system: systemMessage,
          messages: [{ role: 'user', content: message }],
          temperature: 0.1,
          max_tokens: 100
        });
        
        // Find the text content block
        const textBlock = response.content.find(block => block.type === 'text');
        const content = textBlock ? textBlock.text : '';
        
        if (!content) {
          console.warn('Empty content in intent detection response');
          return {
            intent: 'general_question',
            confidence: 0.5
          };
        }
        
        try {
          const parsedResult = extractJsonFromText(content);
          return {
            intent: parsedResult.intent,
            confidence: parsedResult.confidence || 0.8
          };
        } catch (e) {
          console.error('Error parsing intent response:', e);
          console.error('Raw content:', content);
          return {
            intent: 'general_question',
            confidence: 0.5
          };
        }
      } catch (error: any) {
        console.error(`Error attempt ${attempt}/${MAX_RETRIES} detecting intent with ${this.provider}:`, error);
        lastError = error;
        
        // Check if it's an overloaded error (529) or rate limit error
        if (error?.status === 529 || error?.status === 429) {
          const retryDelay = RETRY_DELAY_MS * attempt;
          console.log(`API overloaded or rate limited. Retrying in ${retryDelay}ms...`);
          await sleep(retryDelay);
          continue;
        }
        
        // For last retry, return default
        if (attempt === MAX_RETRIES) {
          return {
            intent: 'general_question',
            confidence: 0.5
          };
        }
      }
    }
    
    // If we get here, all retries failed
    return {
      intent: 'general_question',
      confidence: 0.5
    };
  }

  // Detect channel preference using the LLM with retry logic
  public async detectChannelPreference(message: string): Promise<ChannelPreferenceResponse> {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const systemMessage = `Sei un classificatore di intenti. Classifica il messaggio dell'utente in uno di questi intenti: whatsapp, chat, voce. 
   - rileva l'intenzione dell'utente se l'utente non desidera chiamare, quindi la sua intenzione di rimanere in chat o whatsapp, rileva l'intenzione dell'utente in modo intelligente, risponde solo in formato JSON con i campi "intent" e "confidence" (un numero tra 0 e 1).`;
        
        const response = await this.client.messages.create({
          model: this.modelName,
          system: systemMessage,
          messages: [{ role: 'user', content: message }],
          temperature: 0.1,
          max_tokens: 100
        });
        
        // Find the text content block
        const textBlock = response.content.find(block => block.type === 'text');
        const content = textBlock ? textBlock.text : '';
        
        if (!content) {
          console.warn('Empty content in channel preference detection response');
          return {
            intent: 'whatsapp',
            confidence: 0.5
          };
        }
        
        try {
          const parsedResult = extractJsonFromText(content);
          return {
            intent: parsedResult.intent as 'voice' | 'whatsapp' | 'chat',
            confidence: parsedResult.confidence || 0.8
          };
        } catch (e) {
          console.error('Error parsing channel preference response:', e);
          console.error('Raw content:', content);
          return {
            intent: 'whatsapp',
            confidence: 0.5
          };
        }
      } catch (error: any) {
        console.error(`Error attempt ${attempt}/${MAX_RETRIES} detecting channel preference with ${this.provider}:`, error);
        lastError = error;
        
        // Check if it's an overloaded error (529) or rate limit error
        if (error?.status === 529 || error?.status === 429) {
          const retryDelay = RETRY_DELAY_MS * attempt;
          console.log(`API overloaded or rate limited. Retrying in ${retryDelay}ms...`);
          await sleep(retryDelay);
          continue;
        }
        
        // For last retry, return default
        if (attempt === MAX_RETRIES) {
          return {
            intent: 'whatsapp',
            confidence: 0.5
          };
        }
      }
    }
    
    // If we get here, all retries failed
    return {
      intent: 'whatsapp',
      confidence: 0.5
    };
  }

  // Clear conversation context (if needed)
  public clearConversationContext(phoneNumber: string): void {
    // This is a placeholder - in a real implementation, you might want to
    // clear conversation history from a database or cache
    console.log(`Cleared conversation context for ${phoneNumber}`);
  }
}

// Create a singleton instance with the default provider
const llmService = new LLMService(process.env['LLM_PROVIDER'] as LLMProvider || 'anthropic');

export default llmService; 