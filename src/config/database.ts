import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    const uri = process.env['MONGODB_URI'] || '';
    console.info('Connecting to MongoDB...', uri);
    
    await mongoose.connect(uri);
    console.info('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}; 