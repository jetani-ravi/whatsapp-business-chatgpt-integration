import axios from 'axios';

const VAPI_API_URL = 'https://api.vapi.ai/call';
const VAPI_API_KEY = process.env['VAPI_API_KEY'];
const VAPI_ASSISTANT_ID = process.env['VAPI_ASSISTANT_ID'];
// const VAPI_FOLLOW_UP_ASSISTANT_ID = process.env['VAPI_FOLLOW_UP_ASSISTANT_ID'];
const VAPI_PHONE_NUMBER_ID = process.env['VAPI_PHONE_NUMBER_ID'];

export const initiateVoiceCall = async (customerNumber: string, variableValues = {
  first_name: '',
  previous_conversation: '',
  recommended_products: ''
}): Promise<void> => {

  console.log('initiateVoiceCall', customerNumber, variableValues);
  try {
    if (!customerNumber.startsWith('+')) {
      customerNumber = `+${customerNumber}`;
    }

    const body = {
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
        variableValues: {
          ...variableValues,
          first_name: variableValues.first_name || '',
          previous_conversation: variableValues.previous_conversation || '',
          recommended_products: variableValues.recommended_products || ''
        },
        firstMessageMode: "assistant-speaks-first",
        transportConfigurations: [
          {
            provider: "twilio",
            timeout: 60
          }
        ]
      }
    };
    if (variableValues && Object.keys(variableValues).length > 0) {
      body.assistantOverrides.variableValues = {
        ...body.assistantOverrides.variableValues,
        ...variableValues
      };
    }
    console.log('Initiating voice call...', VAPI_API_URL, VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, customerNumber);
    console.log('VAPI BODY', JSON.stringify(body));
    await axios.post(
      VAPI_API_URL,
      body,
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
  initiateVoiceCall,
};
