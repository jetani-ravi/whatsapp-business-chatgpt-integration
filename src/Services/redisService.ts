import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL;
const redisClient = createClient({ url: redisUrl });

// Connect to Redis
(async () => {
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  await redisClient.connect();
  console.log('Connected to Redis successfully');
})();

// Key prefix for WhatsApp conversations
const CONVERSATION_PREFIX = 'whatsapp:conversation:';

export interface WhatsAppConversationState {
  phoneNumber: string;
  lastInteraction: string; // ISO date string
  messageCount: number;
}

/**
 * Get conversation state for a phone number
 * @param phoneNumber WhatsApp phone number
 * @returns Conversation state or null if not found
 */
export const getConversationState = async (phoneNumber: string): Promise<WhatsAppConversationState | null> => {
  try {
    const key = `${CONVERSATION_PREFIX}${phoneNumber}`;
    const data = await redisClient.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data) as WhatsAppConversationState;
  } catch (error) {
    console.error('Error getting conversation state from Redis:', error);
    return null;
  }
};

/**
 * Save conversation state for a phone number
 * @param state Conversation state to save
 * @param ttl Time to live in seconds (default 7 days)
 */
export const saveConversationState = async (
  state: WhatsAppConversationState, 
  ttl: number = 60 * 24 * 60 * 60 // 7 days in seconds
): Promise<void> => {
  try {
    const key = `${CONVERSATION_PREFIX}${state.phoneNumber}`;
    await redisClient.set(key, JSON.stringify(state), { EX: ttl });
  } catch (error) {
    console.error('Error saving conversation state to Redis:', error);
  }
};

/**
 * Update the conversation state for a phone number
 * @param phoneNumber WhatsApp phone number
 * @returns Updated conversation state
 */
export const updateConversationState = async (phoneNumber: string): Promise<WhatsAppConversationState> => {
  let state = await getConversationState(phoneNumber);
  
  if (!state) {
    // New conversation
    state = {
      phoneNumber,
      lastInteraction: new Date().toISOString(),
      messageCount: 1
    };
  } else {
    // Existing conversation
    state.lastInteraction = new Date().toISOString();
    state.messageCount += 1;
  }
  
  await saveConversationState(state);
  return state;
};

/**
 * Check if this is a new conversation or continuation
 * @param phoneNumber WhatsApp phone number
 * @returns boolean indicating if this is a new conversation
 */
export const isNewConversation = async (phoneNumber: string): Promise<boolean> => {
  const state = await getConversationState(phoneNumber);
  return state === null;
};

/**
 * Delete conversation state for a phone number
 * @param phoneNumber WhatsApp phone number
 */
export const deleteConversationState = async (phoneNumber: string): Promise<void> => {
  try {
    const key = `${CONVERSATION_PREFIX}${phoneNumber}`;
    await redisClient.del(key);
  } catch (error) {
    console.error('Error deleting conversation state from Redis:', error);
  }
};

export default {
  getConversationState,
  saveConversationState,
  updateConversationState,
  isNewConversation,
  deleteConversationState
}; 