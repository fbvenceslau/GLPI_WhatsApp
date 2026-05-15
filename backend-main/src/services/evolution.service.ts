import axios, { AxiosInstance } from 'axios';
import { evolutionConfig } from '../config/evolution';
import { SendTextPayload } from '../types/evolution.types';
import logger from '../utils/logger';

class EvolutionService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: evolutionConfig.apiUrl,
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionConfig.apiKey,
      },
    });
  }

  async sendText(to: string, text: string): Promise<void> {
    const phone = this.normalizePhone(to);
    const payload: SendTextPayload = {
      number: phone,
      text,
      delay: evolutionConfig.messageDelay,
    };

    try {
      await this.client.post(`/message/sendText/${evolutionConfig.instance}`, payload);
      logger.info(`[Evolution] Mensagem enviada para ${phone}`);
    } catch (error) {
      logger.error(`[Evolution] Erro ao enviar mensagem para ${phone}:`, error);
      throw error;
    }
  }

  async sendTyping(to: string): Promise<void> {
    const phone = this.normalizePhone(to);
    try {
      await this.client.post(`/chat/sendPresence/${evolutionConfig.instance}`, {
        number: phone,
        options: { presence: 'composing', delay: 1000 },
      });
    } catch {
      // não-crítico
    }
  }

  private normalizePhone(phone: string): string {
    return phone.replace('@s.whatsapp.net', '').replace(/[^\d+]/g, '');
  }
}

export const evolutionService = new EvolutionService();
