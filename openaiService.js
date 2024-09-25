const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.OPENAI_ASSISTANT_ID;

const getChatGPTResponse = async (message) => {
  try {
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message
    });
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data
      .filter(message => message.role === 'assistant')
      .pop();
    if (lastMessage) {
      return lastMessage.content[0].text.value;
    } else {
      throw new Error('No response from assistant');
    }
  } catch (error) {
    console.error('Error getting ChatGPT response:', error);
    throw error;
  }
};

module.exports = { getChatGPTResponse };
