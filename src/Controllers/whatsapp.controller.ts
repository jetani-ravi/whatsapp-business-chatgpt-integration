import { Request, Response } from 'express';
import {
  sendMessage,
  sendProductRecommendations,
  sendWhatsAppFollowUpMessage,
} from '../Services/whatsappService';
import {
  initiateVoiceCall,
} from '../Services/vapiService';
import llmService from '../Services/llmService';
import Conversation from '../Models/conversation.model';
import SYSTEM_PROMPT from '../config/prompt.constant';

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
  const conversationSummary = await getConversationSummary(conversation);
  const variableValues = {
    first_name: name,
    followup_message: message,
    previous_conversation: conversationSummary,
  };
  // await initiateFollowUpCallService(phoneNumber, variableValues);
  console.log(
    `Follow up call initiated successfully with ${name} and ${phoneNumber}, message: ${message}, variableValues: ${JSON.stringify(
      variableValues
    )}`
  );
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

    console.log(
      `Follow up message initiated successfully with Name: ${name} and Phone Number: ${to}`
    );
    res.status(200).send({
      status: 'success',
      message: `Follow up message has been sent successfully with Name: ${name} and PhoneNumber: ${to} `,
    });
  } catch (error) {
    console.error('Error sending follow up message:', error);
    res.status(500).send({
      status: 'error',
      message: 'Error sending follow up message',
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

              let conversation = await Conversation.findOne({ phoneNumber: from });

              if (!conversation) {
                // First interaction - create new conversation
                conversation = await handleNewConversation(phone_number_id, from);
                conversation.from = from;
                conversation.phoneNumberId = phone_number_id;

                await initiateVoiceCall(from);
              } else {
                // Detect intent for existing conversation
                const { intent } = await llmService.detectIntent(msg_body);

                console.log('intent____', intent);
                switch (intent) {
                  case 'channel_preference':
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

// const extractChannelFromMessage = async(message: string): Promise<string> => {
//   const systemMessage = `Extract the channel from the message : ${message}, give me only the channel name in lowercase channel name like voice, chat, whatsapp`;
//   const aiResponse = await llmService.getResponse(message, systemMessage);
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
        content: SYSTEM_PROMPT.replace('{first_name}', 'Non disponibile')
          .replace('{CUSTOMER_PHONE_NUMBER}', from)
          .replace('{previous_conversation}', 'Non disponibile')
          .replace('{recommended_products}', ''),
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
  const userPreference = await llmService.detectChannelPreference(message);
  console.log('handleChannelPreference userPreference____', userPreference);
  if (['voice', 'voce'].includes(userPreference.intent)) {
    conversation.preferredChannel = 'voice';
    const customerName = getCustomerName(conversation);
    const conversationSummary = await getConversationSummary(conversation, true);
    const recommendedProducts = getRecommendedProducts(conversation);
    const variableValues = {
      first_name: customerName,
      previous_conversation: conversationSummary,
      recommended_products: recommendedProducts,
    };

    await initiateVoiceCall(from, variableValues);
    await sendMessage(phone_number_id, from, 'Ti chiamerò subito per la nostra consulenza.');
    // conversation.messages.push({ role: 'assistant', content: 'Ti chiamerò subito per la nostra consulenza.' });

  } else if (['whatsapp', 'chat', 'chiacchierata'].includes(userPreference.intent)) {
    conversation.preferredChannel = 'whatsapp';

    const customerName = getCustomerName(conversation);
    const conversationSummary = await getConversationSummary(conversation, true);
    const recommendedProducts = getRecommendedProducts(conversation);

    const systemMessage = SYSTEM_PROMPT
    .replace('{CUSTOMER_NAME}',customerName)
    .replace('{CUSTOMER_PHONE_NUMBER}', from)
    .replace('{previous_conversation}', conversationSummary)
    .replace('{recommended_products}', recommendedProducts);

    const aiResponse = await llmService.getResponse(message, systemMessage);
    // conversation.messages.push({ role: 'assistant', content: aiResponse?.content || '' });
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
        messages: conversation.messages,
      },
    },
    { new: true }
  );
};

const getConversationSummary = async (conversation: any, isVoiceCall: boolean = false) => {
  if (!conversation) return '';

   const messages = conversation.messages
    .filter((msg: any) => msg.role !== 'system')
    .map((msg: any) => `${msg.role}: ${msg.content}`)
    .join('\n');

    const transcript = conversation.transcript;
    let systemMessage = '';

    if(transcript) {
      systemMessage = 
      `Genera un riepilogo della conversazione con il cliente e l'assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passi successivi del cliente. Sii breve e conciso. Includi solo i dettagli della trascrizione, assicurati di non includere altre informazioni o di non aggiungere ipotesi.

- Se non hai abbastanza informazioni per il riepilogo, restituisci "Non disponibile".
- Mantieni solo le informazioni della trascrizione, non aggiungere altre informazioni o di non aggiungere ipotesi.
- Non aggiungere informazioni come "Genererò un riepilogo" o "Ecco il riepilogo della conversazione", restituisci semplicemente il riepilogo.
- Se hai abbastanza informazioni, riepiloga solo quelle disponibili. Non chiedere ulteriori informazioni o le mie preferenze. Riepiloga solo ciò che hai e riepiloga la conversazione.
- Se non hai abbastanza informazioni, restituisci "Non disponibile".
- Assicurati di mantenere solo le informazioni essenziali, non aggiungere informazioni extra, sii conciso per il riepilogo della prossima chiamata.

Trascrizione della chiamata vocale tra cliente e assistente:
Trascrizione della chiamata: ${transcript}

È presente la cronologia delle conversazioni tra cliente e assistente su WhatsApp. Genera un riepilogo della conversazione con cliente e assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso. Includi solo i dettagli della trascrizione.`;
    } else {
      systemMessage = `
      Genera un riepilogo della conversazione con il cliente e l'assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso. Includi solo i dettagli della trascrizione, assicurati di non includere altre informazioni o di non aggiungere ipotesi.
- Assicurati di non aggiungere altre informazioni o di non aggiungere ipotesi. Se non hai abbastanza informazioni per il riepilogo, restituisci "Non disponibile". Se hai abbastanza informazioni, riepiloga semplicemente le informazioni disponibili. Non chiedere ulteriori informazioni o le mie preferenze. Riepiloga solo ciò che hai e riepiloga la conversazione.
- Se non hai abbastanza informazioni, restituisci "Non disponibile".
- Non aggiungere informazioni come "Genererò un riepilogo" o "Ecco il riepilogo della conversazione", restituisci solo il riepilogo.
- Assicurati di mantenere solo le informazioni essenziali, non aggiungere informazioni extra, sii conciso per il riepilogo della prossima chiamata.

Cronologia delle conversazioni tra cliente e assistente su WhatsApp. Genera un riepilogo della conversazione con cliente e assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso. Includi solo i dettagli dalla trascrizione. Cronologia delle conversazioni: ${messages}
      `;
    }


    if(isVoiceCall) {
      const summary = await llmService.getResponse(messages, systemMessage);
      console.log('getConversationSummary____summary____', summary?.content);
      return summary?.content || '';
    }
    return messages;

};

const getRecommendedProducts = (conversation: any) => {
  try {
    if (!conversation) return '';

    // Initialize recommendedProducts array if it doesn't exist
    if (!conversation.recommendedProducts) {
      conversation.recommendedProducts = [];
    }

    // If there are no recommended products, return empty string
    if (conversation.recommendedProducts.length === 0) return '';

    // Map products to formatted strings
    return conversation.recommendedProducts
      .map((product: any) => {
        try {
          const productData = typeof product === 'string' ? JSON.parse(product) : product;
          return `${productData?.name || ''} - ${productData?.description || ''}`;
        } catch (error) {
          console.error('Error parsing recommendedProducts product data:', error);
          return '';
        }
      })
      .join('\n');
  } catch (error) {
    console.error('Error parsing recommendedProducts:', error);
    return '';
  }
};

/**
 * Updates the recommended products array in the conversation object
 * @param conversation The conversation object to update
 * @param product The product to add or an array of products
 */
const updateRecommendedProducts = (conversation: any, product: any | Array<any>) => {
  if (!conversation) return;

  // Initialize recommendedProducts array if it doesn't exist
  if (!conversation.recommendedProducts) {
    conversation.recommendedProducts = [];
  }

  // Add single product or array of products
  if (Array.isArray(product)) {
    conversation.recommendedProducts = [...conversation.recommendedProducts, ...product];
  } else {
    conversation.recommendedProducts.push(product);
  }

  return conversation;
};

const getCustomerName = (conversation: any) => {
  if (!conversation) return '';
  return conversation.customerName || 'Non disponibile';
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
  // Early exit if message is empty
  if (!message || message.trim() === '') {
    console.log('Received empty message, skipping LLM processing');
    return;
  }

  const customerName = getCustomerName(conversation);
  const conversationSummary = await getConversationSummary(conversation);
  const recommendedProducts = getRecommendedProducts(conversation);
  const prompt = getSystemPrompt(customerName, conversationSummary, recommendedProducts);
  console.log('handleGeneralQuery prompt____', prompt);
  const systemMessage = prompt;

  const variableValues = {
    first_name: customerName,
    previous_conversation: conversationSummary,
    recommended_products: recommendedProducts,
  };

  const recentMessages = conversation.messages
    .filter((msg: any) => msg.role !== 'system' && msg.content && msg.content.trim() !== '')
    .slice(-MAX_CONVERSATION_HISTORY);

  const messages = [
    { role: 'system', content: systemMessage },
    ...recentMessages,
    { role: 'user', content: message },
  ];

  const aiResponse = await llmService.getResponse(message, systemMessage, messages);
  console.log('aiResponse____', JSON.stringify(aiResponse));
  if (!aiResponse) return;

  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    // Changed from toolCalls to tool_calls
    for (const toolCall of aiResponse.tool_calls) {
      if (
        toolCall.function.name === 'avviare_chiamata_vocale' ||
        toolCall.function.name === 'sendProductRecommendations'
      ) {
        await sendMessage(phone_number_id, from, `Ti chiamerò subito`);
        await initiateVoiceCall(from, variableValues);
        conversation.preferredChannel = 'voice';
      } else if (
        toolCall.function.name === 'nome_cliente_del_negozio' ||
        toolCall.function.name === 'save_customer_name'
      ) {
        const args = JSON.parse(toolCall.function.arguments);
        console.log('args____', JSON.stringify(args));
        const customerName = args.first_name;
        conversation.customerName = customerName || '';

        // Get follow-up response from GPT after saving customer name
        const followUpMessage =
          'Grazie! Ora che ho il tuo nome, iniziamo a trovare i prodotti per la cura della pelle perfetti per te. Qual è il tuo tipo di pelle principale? (secca/grassa/mista/sensibile)';
        const systemMessage = getSystemPrompt(
          customerName,
          await getConversationSummary(conversation),
          recommendedProducts
        );
        const aiResponse = await llmService.getResponse(followUpMessage, systemMessage);
        if (aiResponse?.content) {
          await sendMessage(phone_number_id, from, aiResponse.content);
        }
      }
    }
  } else {
    if (aiResponse.content) {
      await sendMessage(phone_number_id, from, aiResponse.content);
    }
  }

  console.info('message____', message);
  // Add the user message and AI response to conversation history

  console.info('aiResponse.content____', aiResponse.content);
  if (aiResponse.content && aiResponse.content.trim() !== '') {
    conversation.messages.push({ role: 'assistant', content: aiResponse.content });
  }

  // Keep only recent messages
  if (conversation.messages.length > MAX_CONVERSATION_HISTORY) {
    const systemMsg = conversation.messages.find((msg: any) => msg.role === 'system');
    const recentMessages = conversation.messages
      .filter((msg: any) => msg.role !== 'system' && msg.content && msg.content.trim() !== '')
      .slice(-MAX_CONVERSATION_HISTORY);

    conversation.messages = systemMsg ? [systemMsg, ...recentMessages] : recentMessages;
  }

  // Use findOneAndUpdate to avoid version conflicts
  await Conversation.findOneAndUpdate(
    { _id: conversation._id },
    {
      $set: {
        messages: conversation.messages,
        preferredChannel: conversation.preferredChannel,
        lastInteractionDate: new Date(),
        customerName: conversation.customerName,
      },
    },
    { new: true }
  );
};

const getSystemPrompt = (
  customerName: string,
  conversationSummary: string,
  recommendedProducts: string
) => {
  const systemPrompt = SYSTEM_PROMPT.replace('{first_name}', customerName)
    .replace('{previous_conversation}', conversationSummary)
    .replace('{recommended_products}', recommendedProducts);

  return systemPrompt;
  // return customerName && customerName?.length > 0 ? systemPrompt : askCustomerNamePrompt;
};

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
      // Update conversation with recommended products
      if (products && typeof products === 'object') {
        const existingProducts = conversation.recommendedProducts || [];
        // Convert each product to a string before saving
        const stringifiedProducts = products.map((product: any) => JSON.stringify(product));
        conversation.recommendedProducts = [...existingProducts, ...stringifiedProducts];
      }
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

const saveCustomerName = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('saveCustomerName____Body', JSON.stringify(req.body));
    const { message } = req.body;

    // Extract phone number and remove '+' if present
    let phoneNumber = message?.customer?.number;
    if (phoneNumber?.includes('+')) {
      phoneNumber = phoneNumber.replace('+', '');
    }

    // Extract recommended products from the tool calls
    const toolCall = message.toolCalls?.find(
      (call: any) => call.function.name === 'save_customer_name'
    );

    // Parse the arguments string to get the product list
    const args =
      typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

    console.log('args____', JSON.stringify(args));

    if (!args?.customerName) {
      console.error('Customer Name not found');
      res.status(200).send({ message: "Customer name didn't found" });
      return;
    }

    const conversation = await Conversation.findOne({ phoneNumber });
    if (conversation) {
      console.log('args.customerName____', args.customerName);
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { customerName: args.customerName } }
      );
    } else {
      console.error('Skip saving customer name because conversation not found');
    }
    res.status(200).send({ message: 'Customer name saved successfully' });
  } catch (error) {
    console.error('Error saving customer name:', error);
    res.status(500).send('Error saving customer name');
  }
};

export {
  verifyWebhook,
  handleWebhook,
  initiateFollowUpCall,
  sendRecommendedProductOverWhatsApp,
  updateRecommendedProducts,
  saveCustomerName,
  sendFollowUpMessage,
};

