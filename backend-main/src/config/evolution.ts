import dotenv from 'dotenv';

dotenv.config();

export const evolutionConfig = {
  apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
  apiKey: process.env.EVOLUTION_API_KEY || '',
  instance: process.env.EVOLUTION_INSTANCE || 'default',
  messageDelay: parseInt(process.env.EVOLUTION_MSG_DELAY || '1200'),
};
