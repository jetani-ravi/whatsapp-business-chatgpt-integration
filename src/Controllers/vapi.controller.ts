import Conversation from '../Models/conversation.model';
import LLMService  from '../Services/llmService';
import { Request, Response } from 'express';
// import {
//   initiateFollowUpCall as initiateFollowUpCallService,
//   initiateVoiceCall,
// } from '../Services/vapiService';

const handleVapiServerEvents = async (req: Request, res: Response): Promise<void> => {
  console.log('request body', JSON.stringify(req.body));
  console.log('request query', req.query);

  const body = req.body;
  if (!body.message) {
    res.status(200).send('OK');
    return;
  }

  if(body.message.type === 'end-of-call-report') {
    console.log('### end of call report ###', JSON.stringify(body.message));

  const { transcript, customer } = body.message;

  const summary = await LLMService.getResponse(transcript, `
      Genera un riepilogo della conversazione con il cliente e l'assistente, evidenzia i punti importanti e i prodotti consigliati, punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi della pelle del cliente, prodotti consigliati, feedback del cliente, risposta dell'assistente, soddisfazione del cliente, passaggi successivi del cliente, sii breve e conciso`);

    const number = customer?.number ? customer.number.replace('+', '') : '';
    console.log(`### Final Call Summary: ${summary.content}
                      ### @Transcript: ${transcript}`);
    console.log('### Updating Summary and Transcript for Customer ###', number);
    await Conversation.findOneAndUpdate({ phoneNumber: number }, {
      $set: {
        summary: summary.content,
        transcript: transcript
      }
    }, { new: true });

  }

  if(body.message.type === 'status-update' && body.message.status === 'ended') {
    console.log('### call ended ###', JSON.stringify(body.message));
    const { transcript, customer } = body.message;

    const summary = await LLMService.getResponse(transcript, `
     Genera un riepilogo della conversazione con il cliente e l'assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, feedback del cliente, risposta dell'assistente, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso.
Ecco la trascrizione dell'IA e dell'utente:
${transcript}`);

     const number = customer?.phoneNumber ? customer.phoneNumber.replace('+91', '') : '';
     console.log(`### Final Call Summary: ${summary.content}
                       ### @Transcript: ${transcript}`);
     await Conversation.findOneAndUpdate({ phoneNumber: number }, {
       $set: {
         summary: summary.content,
         transcript: transcript
       }
     }, { new: true });
  }

  res.status(200).send('OK');
}

export { handleVapiServerEvents };
