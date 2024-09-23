const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.OPENAI_ASSISTANT_ID;

getChatGPTResponse = async (message) => {
  try {
    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Retrieve the messages
    const messages = await openai.beta.threads.messages.list(thread.id);

    // Get the last message from the assistant
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
module.exports = {getChatGPTResponse};
