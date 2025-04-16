import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  phoneNumber: string;
  isFirstInteraction: boolean;
  from: string;
  to: string;
  summary: string;
  transcript: string;
  phoneNumberId: string;
  preferredChannel?: 'voice' | 'chat' | 'whatsapp';
  lastInteractionDate: Date;
  status: 'active' | 'awaiting_preference' | 'completed';
  recommendedProducts?: string[];
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

const ConversationSchema: Schema = new Schema({
  phoneNumber: { type: String, required: true, unique: true },
  isFirstInteraction: { type: Boolean, default: true },
  from: { type: String },
  customerName: { type: String },
  to: { type: String },
  summary: { type: String, default: '' },
  transcript: { type: String, default: '' },
  phoneNumberId: { type: String },
  preferredChannel: { type: String, enum: ['voice', 'chat','whatsapp'] },
  lastInteractionDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'awaiting_preference', 'completed'], default: 'active' },
  recommendedProducts: [{ type: String }],
  messages: [{
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String }
  }]
});

export default mongoose.model<IConversation>('Conversation', ConversationSchema); 