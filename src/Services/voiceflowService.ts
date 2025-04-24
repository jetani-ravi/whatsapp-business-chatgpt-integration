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
 * @param responses Array of VoiceFlow response objects
 * @returns Formatted message string
 */
export const formatVoiceFlowResponses = (responses: any[]): string => {
  if (!responses || !responses.length) {
    return 'Sorry, I couldn\'t process your request.';
  }

  return responses
    .filter(response => response.type === 'text')
    .map(response => response.payload.message)
    .join('\n\n');
};

export default {
  getVoiceFlowResponse,
  formatVoiceFlowResponses
}; 