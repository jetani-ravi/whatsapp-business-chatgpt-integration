import axios from 'axios';

const VOICEFLOW_API_URL = 'https://general-runtime.voiceflow.com/state/user';
const VOICEFLOW_API_KEY = process.env['VOICEFLOW_API_KEY']

/**
 * Interact with VoiceFlow API to get responses
 * @param userId Unique user identifier
 * @param message User's message
 * @returns VoiceFlow response array
 */
export const getVoiceFlowResponse = async (userId: string, message: string) => {
  try {
    // For first interaction, use launch action
    const isFirstInteraction = !message;
    
    const requestBody = isFirstInteraction 
      ? {
          action: {
            type: 'launch'
          },
          config: {
            tts: false,
            stripSSML: true,
            stopAll: false,
            excludeTypes: [
              'block',
              'debug',
              'flow'
            ]
          }
        }
      : {
          action: {
            type: 'text',
            payload: message
          },
          config: {
            tts: false,
            stripSSML: true,
            stopAll: false,
            excludeTypes: [
              'block',
              'debug',
              'flow'
            ]
          }
        };

    const response = await axios.post(
      `${VOICEFLOW_API_URL}/${userId}/interact?logs=off`,
      requestBody,
      {
        headers: {
          'Authorization': VOICEFLOW_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error interacting with VoiceFlow:', error.message);
    throw new Error('Failed to get response from VoiceFlow');
  }
};

/**
 * Format VoiceFlow responses into a single message
 * WhatsApp has a character limit of approximately 4096 characters
 * @param responses Array of VoiceFlow response objects
 * @returns Formatted message string
 */
export const formatVoiceFlowResponses = (responses: any[]): string => {
  if (!responses || !responses.length) {
    return 'Sorry, I couldn\'t process your request.';
  }

  // Extract messages from VoiceFlow responses
  const messages = responses
    .filter(response => response.type === 'text')
    .map(response => response.payload.message);

  // Check total length
  const joinedMessages = messages.join('\n\n');
  
  // If message is too long for WhatsApp (4096 chars), we'll need to truncate
  const MAX_WHATSAPP_LENGTH = 4000; // A little buffer from the actual 4096 limit
  
  if (joinedMessages.length <= MAX_WHATSAPP_LENGTH) {
    return joinedMessages;
  }
  
  // Find a good breaking point to truncate
  let truncatedMessage = joinedMessages.substring(0, MAX_WHATSAPP_LENGTH);
  
  // Try to find a proper break point (end of sentence or paragraph)
  const lastPeriod = truncatedMessage.lastIndexOf('.');
  const lastNewline = truncatedMessage.lastIndexOf('\n');
  
  let breakPoint = Math.max(lastPeriod, lastNewline);
  if (breakPoint < MAX_WHATSAPP_LENGTH * 0.7) {
    // If the break point is too early in the message, just use the max length
    breakPoint = MAX_WHATSAPP_LENGTH;
  }
  
  truncatedMessage = truncatedMessage.substring(0, breakPoint + 1);
  return truncatedMessage + '\n\n[Message was truncated due to length limits]';
};

export default {
  getVoiceFlowResponse,
  formatVoiceFlowResponses
}; 