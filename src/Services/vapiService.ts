import axios from 'axios';

const VAPI_API_URL = 'https://api.vapi.ai/call';
const VAPI_API_KEY = process.env['VAPI_API_KEY'];
const VAPI_ASSISTANT_ID = process.env['VAPI_ASSISTANT_ID'];
const VAPI_PHONE_NUMBER_ID = process.env['VAPI_PHONE_NUMBER_ID'];

export const initiateVoiceCall = async (customerNumber: string): Promise<void> => {
  try {
    if(!customerNumber.startsWith('+')) {
        customerNumber = `+${customerNumber}`;
    }
    console.info('Initiating voice call...', VAPI_API_URL, VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, customerNumber);
    await axios.post(
      VAPI_API_URL,
      {
        assistantId: VAPI_ASSISTANT_ID,
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        customer: {
          number: customerNumber,
          numberE164CheckEnabled: true
        },
        assistantOverrides: {
        voicemailDetection: {
            provider: "twilio",
            enabled: true,
            voicemailDetectionTypes: [
                "machine_end_beep",
                "machine_end_silence"
            ],
            machineDetectionTimeout: 10,
            machineDetectionSpeechThreshold: 1500,
            machineDetectionSpeechEndThreshold: 500,
            machineDetectionSilenceTimeout: 5000
        },
        firstMessageMode: "assistant-speaks-first",
        transportConfigurations: [
            {
                provider: "twilio",
                timeout: 60
            }
        ]
    }
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error initiating voice call:', error);
    throw error;
  }
}; 

export default {
  initiateVoiceCall
};