import { Request, Response } from 'express';
import * as whatsappService from '../Services/whatsappService';
import * as vapiService from '../Services/vapiService';
import * as openaiService from '../Services/openaiService';
import Conversation from '../Models/conversation.model';
import SYSTEM_PROMPT from '../config/prompt.constant';
import { ChatCompletionSystemMessageParam } from 'openai/resources/chat/completions';

const MAX_CONVERSATION_HISTORY = 15;
const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env['VERIFY_TOKEN']) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
};

const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { object, entry } = req.body;

    if (object !== "whatsapp_business_account") {
      console.log('Unhandled webhook object type:', object);
      res.status(200).send('OK');
      return;
    }

    if (!Array.isArray(entry) || entry.length === 0) {
      console.log('No entries in webhook payload');
      res.status(200).send('OK');
      return;
    }

    for (const entryItem of entry) {
      const changes = entryItem.changes;
      
      for (const change of changes) {
        if (change.field === "messages") {
          const { metadata, messages } = change.value;

          if (Array.isArray(messages)) {
            for (const message of messages) {
              if (message.type === "text") {
                const phone_number_id = metadata.phone_number_id;
                const from = message.from;
                const msg_body = message.text.body;

                let conversation = await Conversation.findOne({ phoneNumber: from });
                
                if (!conversation) {
                  // First interaction - create new conversation
                  conversation = await handleNewConversation(phone_number_id, from);
                } else {
                  // Detect intent for existing conversation
                  const { intent } = await openaiService.detectIntent(msg_body);
                  
                  switch (intent) {
                    case 'channel_preference':
                      await handleChannelPreference(conversation, msg_body, phone_number_id, from);
                      break;
                      
                    case 'start_consultation':
                      await handleConsultationStart(conversation, phone_number_id, from);
                      break;
                      
                    case 'general_question':
                      await handleGeneralQuery(conversation, msg_body, phone_number_id, from);
                      break;
                  }
                }
                
                conversation.lastInteractionDate = new Date();
                await conversation.save();
              }
            }
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send('Internal Server Error');
  }
};

const handleNewConversation = async (phone_number_id: string, from: string) => {
  const conversation = await Conversation.create({
    phoneNumber: from,
    isFirstInteraction: true,
    lastInteractionDate: new Date(),
    status: 'active',
    preferredChannel: 'voice',
    messages: [{
      role: 'system',
      content: SYSTEM_PROMPT
        .replace('{CUSTOMER_NAME}', '')
        .replace('{CUSTOMER_PHONE_NUMBER}', from)
    }]
  });

  await whatsappService.sendMessage(
    phone_number_id,
    from,
    "Welcome to our skincare consultation! Would you prefer to continue via voice call or chat?"
  );

  return conversation;
};

const handleChannelPreference = async (
  conversation: any,
  message: string,
  phone_number_id: string,
  from: string
) => {
  const preference = message.toLowerCase();
  if (preference.includes('voice') || preference.includes('call')) {
    conversation.preferredChannel = 'voice';
    await vapiService.initiateVoiceCall(from);
    await whatsappService.sendMessage(
      phone_number_id,
      from,
      "I'll call you right away for our consultation."
    );
  } else if (preference.includes('chat') || preference.includes('text')) {
    conversation.preferredChannel = 'chat';
    const systemMessage: ChatCompletionSystemMessageParam = {
      role: 'system',
      content: SYSTEM_PROMPT
        .replace('{CUSTOMER_NAME}', conversation.customerName || '')
        .replace('{CUSTOMER_PHONE_NUMBER}', from)
    };
    const aiResponse = await openaiService.getChatGPTResponse(message, from, systemMessage);
    await whatsappService.sendMessage(
      phone_number_id,
      from,
      aiResponse.content || ''
    );
  }
  conversation.status = 'active';
};

const handleConsultationStart = async (
  conversation: any,
  phone_number_id: string,
  from: string
) => {
  const aiResponse = await openaiService.getChatGPTResponse(
    "Let's start the consultation. What's your main skin type?",
    from
  );
  await whatsappService.sendMessage(
    phone_number_id,
    from,
    aiResponse.content || ''
  );
};

const handleGeneralQuery = async (
  conversation: any,
  message: string,
  phone_number_id: string,
  from: string
) => {
  // Create system message from conversation context with proper typing
  const systemMessage: ChatCompletionSystemMessageParam = {
    role: 'system',
    content: SYSTEM_PROMPT
      .replace('{CUSTOMER_NAME}', conversation.customerName || '')
      .replace('{CUSTOMER_PHONE_NUMBER}', from)
  };

  const aiResponse = await openaiService.getChatGPTResponse(message, from, systemMessage);
  
  if (aiResponse.toolCalls) {
    for (const toolCall of aiResponse.toolCalls) {
      if (toolCall.function.name === 'initiate_voice_call') {
        await whatsappService.sendMessage(
          phone_number_id,
          from,
          `I'll call you right away`
        );
        await vapiService.initiateVoiceCall(from);
        conversation.preferredChannel = 'voice';
      }
    }
  } else {
    await whatsappService.sendMessage(
      phone_number_id,
      from,
      aiResponse.content || ''
    );
  }
  
  // Update conversation in database with latest messages
  conversation.messages.push(
    { role: 'user', content: message },
    { role: 'assistant', content: aiResponse.content || '' }
  );

  // Keep only recent messages in the database
  if (conversation.messages.length > MAX_CONVERSATION_HISTORY) {
    const systemMsg = conversation.messages.find((msg: any) => msg.role === 'system');
    const recentMessages = conversation.messages.slice(-MAX_CONVERSATION_HISTORY);
    conversation.messages = systemMsg 
      ? [systemMsg, ...recentMessages.filter((msg: any) => msg.role !== 'system')]
      : recentMessages;
  }
};

const sendRecommendedProductOverWhatsApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, products } = req.body;
    const conversation = await Conversation.findOne({ phoneNumber });
    
    if (!conversation) {
      res.status(404).send('Conversation not found');
      return;
    }

    // Update conversation with recommended products
    conversation.recommendedProducts = products;
    await conversation.save();

    // Send recommendations via WhatsApp
    await whatsappService.sendProductRecommendations(
      process.env['WHATSAPP_PHONE_NUMBER_ID'] || '',
      phoneNumber,
      products
    );

    res.status(200).send('Recommendations sent successfully');
  } catch (error) {
    console.error('Error sending recommendations:', error);
    res.status(500).send('Error sending recommendations');
  }
};

export { verifyWebhook, handleWebhook, sendRecommendedProductOverWhatsApp };

