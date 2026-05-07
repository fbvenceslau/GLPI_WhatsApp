export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
  destination: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}

export interface EvolutionMessageData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName: string;
  message: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string };
    documentMessage?: { caption?: string };
    audioMessage?: Record<string, unknown>;
  };
  messageType: string;
  messageTimestamp: number;
  instanceId: string;
  source: string;
}

export interface SendTextPayload {
  number: string;
  text: string;
  delay?: number;
}
