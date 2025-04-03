import { Request, Response } from 'express';
import { sendMessage, sendProductRecommendations, sendWhatsAppFollowUpMessage } from '../Services/whatsappService';
import {
  initiateFollowUpCall as initiateFollowUpCallService,
  initiateVoiceCall,
} from '../Services/vapiService';
import {
  detectIntent,
  detectChannelPreferenceIntent,
  getChatGPTResponse,
} from '../Services/openaiService';
import Conversation from '../Models/conversation.model';
import SYSTEM_PROMPT from '../config/prompt.constant';
import { ChatCompletionSystemMessageParam } from 'openai/resources/chat/completions';

const MAX_CONVERSATION_HISTORY = 15;
const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === process.env['VERIFY_TOKEN']) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
};

const initiateFollowUpCall = async (req: Request, res: Response): Promise<void> => {
  const { name, phoneNumber, message } = req.body;

  
  if (!phoneNumber) {
    res.status(400).send('Phone number is required');
    return;
  }
  if (!message) {
    res.status(400).send('Follow up message is required');
    return;
  }
  let conversation = await Conversation.findOne({ phoneNumber: phoneNumber });
  const conversationSummary = getConversationSummary(conversation);
  const variableValues = {
    first_name: name,
    followup_message: message,
    previous_conversation: conversationSummary,
  };
  await initiateFollowUpCallService(phoneNumber, variableValues);
  console.log(`Follow up call initiated successfully with ${name} and ${phoneNumber}, message: ${message}, variableValues: ${JSON.stringify(
        variableValues
      )}`);
  res
    .status(200)
    .send(
      `Follow up call initiated successfully with ${name} and ${phoneNumber}, message: ${message}, variableValues: ${JSON.stringify(
        variableValues
      )} `
    );
};

const sendFollowUpMessage = async (req: Request, res: Response): Promise<void> => {

  try {
    console.log('sendFollowUpMessage____Body___2', req.body);
    const { name, phoneNumber: to } = req.body;
    const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] || '';

  if (!to) {
    res.status(400).send('Phone number is required');
    return;
  }
  if (!name) {
    res.status(400).send('Name is required');
    return;
  }
  await sendWhatsAppFollowUpMessage(phoneNumberId, to, name);
 
  console.log(`Follow up message initiated successfully with Name: ${name} and Phone Number: ${to}`);
  res
    .status(200)
    .send(
      {
        status: 'success',
        message: `Follow up message has been sent successfully with Name: ${name} and PhoneNumber: ${to} `
      }
    );
  } catch (error) {
    console.error('Error sending follow up message:', error);
    res.status(500).send({
      status: 'error',
      message: 'Error sending follow up message'
    });
  }
};

const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { object, entry } = req.body;

    console.log('handleWebhook_object____', JSON.stringify(object));
    console.log('handleWebhook_entry____', JSON.stringify(entry));

    if (object !== 'whatsapp_business_account') {
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
        // Skip if this is a status update
        if (change.value?.statuses) {
          console.log('Skipping status update webhook');
          continue;
        }

        // Only process if there are messages
        if (change.field === 'messages' && change.value?.messages) {
          const { metadata, messages } = change.value;

          if (!Array.isArray(messages) || messages.length === 0) {
            continue;
          }

          for (const message of messages) {
            if (message.type === 'text') {
              const phone_number_id = metadata.phone_number_id;
              const from = message.from;
              const msg_body = message.text.body;

              console.log('handleWebhook_from____', from);
              console.log('handleWebhook_phone_number_id____', phone_number_id);

              let conversation = await Conversation.findOne({ phoneNumber: from });

              if (!conversation) {
                // First interaction - create new conversation
                conversation = await handleNewConversation(phone_number_id, from);
                conversation.from = from;
                conversation.phoneNumberId = phone_number_id;

                await initiateVoiceCall(from);
              } else {
                // Detect intent for existing conversation
                const { intent } = await detectIntent(msg_body);

                console.log('intent____', intent);

                switch (intent) {
                  case 'channel_preference':
                    // const extractedChannel = extractChannelFromMessage(msg_body);
                    await handleChannelPreference(conversation, msg_body, phone_number_id, from);
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

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

// const extractChannelFromMessage = async(message: string, from: string): Promise<string> => {
//   const systemMessage = `Extract the channel from the message : ${message}, give me only the channel name in lowercase channel name like voice, chat, whatsapp`;
//   const aiResponse = await getChatGPTResponse(systemMessage, from, systemMessage as ChatCompletionSystemMessageParam);
//   return aiResponse?.content || '';
// }

const handleNewConversation = async (phone_number_id: string, from: string) => {
  const conversation = await Conversation.create({
    phoneNumber: from,
    isFirstInteraction: true,
    lastInteractionDate: new Date(),
    status: 'active',
    preferredChannel: 'voice',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT.replace('{CUSTOMER_NAME}', '')
          .replace('{CUSTOMER_PHONE_NUMBER}', from)
          .replace('{PREVIOUS_CONVERSATION_SUMMARY}', ''),
      },
    ],
  });

  await sendMessage(
    phone_number_id,
    from,
    'Benvenuto a Roads Of Beauty! Ti chiamerò subito per una consulenza personalizzata.'
  );

  return conversation;
};

const handleChannelPreference = async (
  conversation: any,
  message: string,
  phone_number_id: string,
  from: string
) => {
  const userPreference = await detectChannelPreferenceIntent(message);
  console.log('userPreference____', userPreference);
  if (userPreference.intent === 'voice') {
    conversation.preferredChannel = 'voice';
    const customerName = getCustomerName(conversation);
    const conversationSummary = getConversationSummary(conversation);
    const variableValues = {
      first_name: customerName,
      previous_conversation: conversationSummary,
    };

    await initiateVoiceCall(from, variableValues);
    await sendMessage(phone_number_id, from, 'Ti chiamerò subito per la nostra consulenza.');
  } else if (userPreference.intent === 'whatsapp' || userPreference.intent === 'chat') {
    conversation.preferredChannel = 'whatsapp';
    const systemMessage: ChatCompletionSystemMessageParam = {
      role: 'system',
      content: SYSTEM_PROMPT.replace('{CUSTOMER_NAME}', conversation.customerName || '').replace(
        '{CUSTOMER_PHONE_NUMBER}',
        from
      ),
    };
    const aiResponse = await getChatGPTResponse(message, from, systemMessage);
    if (aiResponse?.content) {
      await sendMessage(phone_number_id, from, aiResponse.content || '');
    }
  }

  // Use findOneAndUpdate to avoid version conflicts
  await Conversation.findOneAndUpdate(
    { _id: conversation._id },
    {
      $set: {
        preferredChannel: conversation.preferredChannel,
        status: 'active',
      },
    },
    { new: true }
  );
};

const getConversationSummary = (conversation: any) => {
  if (!conversation) return '';
  return conversation.messages
    .filter((msg: any) => msg.role !== 'system')
    .map((msg: any) => `${msg.role}: ${msg.content}`)
    .join('\n');
};

const getCustomerName = (conversation: any) => {
  if (!conversation) return '';
  return conversation.customerName || '';
};

// const handleConsultationStart = async (
//   conversation: any,
//   phone_number_id: string,
//   from: string
// ) => {
//   const aiResponse = await openaiService.getChatGPTResponse(
//     "Let's start the consultation. What's your main skin type?",
//     from
//   );
//   await (
//     phone_number_id,
//     from,
//     aiResponse.content || ''
//   );
// };

const handleGeneralQuery = async (
  conversation: any,
  message: string,
  phone_number_id: string,
  from: string
) => {
  const customerName = getCustomerName(conversation);
  const conversationSummary = getConversationSummary(conversation);

  const prompt = getSystemPrompt(customerName, conversationSummary);
  const systemMessage: ChatCompletionSystemMessageParam = {
    role: 'system',
    content: prompt,
  };

  const variableValues = {
    first_name: customerName,
    previous_conversation: conversationSummary,
  };

  const recentMessages = conversation.messages
    .filter((msg: any) => msg.role !== 'system')
    .slice(-MAX_CONVERSATION_HISTORY);

  const messages = [systemMessage, ...recentMessages, { role: 'user', content: message }];

  const aiResponse = await getChatGPTResponse(message, from, systemMessage, messages);

  if (!aiResponse) return;

  if (aiResponse.tool_calls) {
    // Changed from toolCalls to tool_calls
    for (const toolCall of aiResponse.tool_calls) {
      if (toolCall.function.name === 'avviare_chiamata_vocale') {
        await sendMessage(phone_number_id, from, `Ti chiamerò subito`);
        await initiateVoiceCall(from, variableValues);
        conversation.preferredChannel = 'voice';
      } else if (toolCall.function.name === 'nome_cliente_del_negozio') {
        const args = JSON.parse(toolCall.function.arguments);
        console.log('args____', JSON.stringify(args));
        const customerName = args.first_name;
        conversation.customerName = customerName || '';
        await conversation.save();

        // Get follow-up response from GPT after saving customer name
        const followUpMessage = "Grazie! Ora che ho il tuo nome, iniziamo a trovare i prodotti per la cura della pelle perfetti per te. Qual è il tuo tipo di pelle principale? (secca/grassa/mista/sensibile)";
        const systemMessage: ChatCompletionSystemMessageParam = {
          role: 'system',
          content: getSystemPrompt(customerName, getConversationSummary(conversation))
        };
        const aiResponse = await getChatGPTResponse(followUpMessage, from, systemMessage);
        if (aiResponse?.content) {
          await sendMessage(phone_number_id, from, aiResponse.content);
        }
      }
    }
  } else {
    await sendMessage(phone_number_id, from, aiResponse.content || '');
  }

  // Prepare new messages
  const newMessages = [
    { role: 'user', content: message },
    { role: 'assistant', content: aiResponse.content || '' },
  ];

  // Keep only recent messages
  let updatedMessages = [...conversation.messages, ...newMessages];
  if (updatedMessages.length > MAX_CONVERSATION_HISTORY) {
    const systemMsg = updatedMessages.find((msg: any) => msg.role === 'system');
    const recentMessages = updatedMessages.slice(-MAX_CONVERSATION_HISTORY);
    updatedMessages = systemMsg
      ? [systemMsg, ...recentMessages.filter((msg: any) => msg.role !== 'system')]
      : recentMessages;
  }

  // Use findOneAndUpdate to avoid version conflicts
  await Conversation.findOneAndUpdate(
    { _id: conversation._id },
    {
      $set: {
        messages: updatedMessages,
        preferredChannel: conversation.preferredChannel,
        lastInteractionDate: new Date(),
      },
    },
    { new: true }
  );
};

const getSystemPrompt = (customerName: string, conversationSummary: string) => {
  const systemPrompt = SYSTEM_PROMPT.replace('{CUSTOMER_NAME}', customerName)
    .replace('{PREVIOUS_CONVERSATION_SUMMARY}', conversationSummary);

  return systemPrompt;
  // return customerName && customerName?.length > 0 ? systemPrompt : askCustomerNamePrompt;
}

const sendRecommendedProductOverWhatsApp = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('sendRecommendedProductOverWhatsApp____Body', JSON.stringify(req.body));
    const { message } = req.body;

    // Extract phone number and remove '+' if present
    let phoneNumber = message?.customer?.number;
    if (phoneNumber?.includes('+')) {
      phoneNumber = phoneNumber.replace('+', '');
    }

    // Extract recommended products from the tool calls
    const toolCall = message.toolCalls?.find(
      (call: any) => call.function.name === 'sendProductRecommendations'
    );

    // Parse the arguments string to get the product list
    const args =
      typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

    console.log('args____', JSON.stringify(args));

    let products = [];
    if (!args?.recommendedProductList) {
      console.error('No products found');
      res.status(200).send({ message: 'No recommended products found' });
      return;
    }

    console.log('args____recommendedProductList', JSON.stringify(args.recommendedProductList));

    // Handle both array and object formats for recommendedProductList
    if (Array.isArray(args.recommendedProductList)) {
      // If recommendedProductList is already an array
      products = args.recommendedProductList.map(
        (item: any) => item?.productList || item?.Items || item
      );
    } else {
      // If recommendedProductList is an object, wrap it in an array
      products = [args.recommendedProductList];
    }

    const conversation = await Conversation.findOne({ phoneNumber });
    console.log('conversation____', JSON.stringify(conversation));
    if (conversation) {
      // Convert products to string format before saving
      const serializedProducts = products.map((product: any) => JSON.stringify(product));

      // Update conversation with recommended products
      conversation.recommendedProducts = serializedProducts;
      conversation.save();
    }

    // Send recommendations via WhatsApp
    await sendProductRecommendations(
      process.env['WHATSAPP_PHONE_NUMBER_ID'] || '',
      phoneNumber,
      products
    );

    res.status(200).send({ message: 'Product link has been sent successfully' });
  } catch (error) {
    console.error('Error sending recommendations:', error);
    res.status(500).send('Error sending recommendations');
  }
};

export { verifyWebhook, handleWebhook, initiateFollowUpCall, sendRecommendedProductOverWhatsApp, sendFollowUpMessage };
