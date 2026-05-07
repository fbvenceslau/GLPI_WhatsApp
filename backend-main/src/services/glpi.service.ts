import axios, { AxiosInstance } from 'axios';
import { glpiConfig } from '../config/glpi';
import {
  GlpiUser,
  GlpiCategory,
  GlpiTicketPayload,
  GlpiTicketResponse,
  GlpiSearchResult,
  GlpiSessionToken,
} from '../types/glpi.types';
import logger from '../utils/logger';

class GlpiService {
  private client: AxiosInstance;
  private sessionToken: string | null = null;
  private sessionExpiry: Date | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: glpiConfig.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'App-Token': glpiConfig.appToken,
      },
    });
  }

  // ─── Gerenciamento de Sessão ─────────────────────────────────────────────

  private async initSession(): Promise<string> {
    // Reutiliza sessão válida (válida por 1h com margem de segurança de 5min)
    if (this.sessionToken && this.sessionExpiry && this.sessionExpiry > new Date()) {
      return this.sessionToken;
    }

    const response = await this.client.get<GlpiSessionToken>('/initSession', {
      headers: { Authorization: `user_token ${glpiConfig.userToken}` },
    });

    this.sessionToken = response.data.session_token;
    this.sessionExpiry = new Date(Date.now() + 55 * 60 * 1000); // 55 minutos
    logger.info('[GLPI] Sessão iniciada com sucesso.');
    return this.sessionToken;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.initSession();
    return { 'Session-Token': token };
  }

  async killSession(): Promise<void> {
    if (!this.sessionToken) return;
    try {
      await this.client.get('/killSession', {
        headers: { 'Session-Token': this.sessionToken },
      });
    } finally {
      this.sessionToken = null;
      this.sessionExpiry = null;
    }
  }

  // ─── Usuários ────────────────────────────────────────────────────────────

  async findUserByEmail(email: string): Promise<GlpiUser | null> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await this.client.get<GlpiSearchResult<Record<string, string>>>(
        '/search/User',
        {
          headers,
          params: {
            'criteria[0][field]': 5,     // campo email
            'criteria[0][searchtype]': 'contains',
            'criteria[0][value]': email.toLowerCase().trim(),
            'forcedisplay[0]': 1,        // login/name
            'forcedisplay[1]': 2,        // ID
            'forcedisplay[2]': 5,        // email
            'forcedisplay[3]': 8,        // firstname
            'forcedisplay[4]': 9,        // phone
            'forcedisplay[5]': 34,       // realname
          },
        }
      );

      if (!response.data.data || response.data.totalcount === 0) {
        return null;
      }

      const raw = response.data.data[0];
      return {
        id: parseInt(raw['2']),       // field 2 = ID
        name: raw['1'] || '',         // field 1 = login/name
        realname: raw['34'] || '',
        firstname: raw['8'] || '',
        email: raw['5'] || email,
        phone: raw['9'] || '',
      };
    } catch (error) {
      logger.error('[GLPI] Erro ao buscar usuário por email:', error);
      throw new Error('Falha na comunicação com o GLPI ao buscar usuário.');
    }
  }

  // ─── Categorias ──────────────────────────────────────────────────────────

  async getCategories(ticketType?: number): Promise<GlpiCategory[]> {
    try {
      const headers = await this.getAuthHeaders();

      const params: Record<string, unknown> = {
        'forcedisplay[0]': 2,   // ID
        'forcedisplay[1]': 14,  // name (curto)
        'forcedisplay[2]': 1,   // completename
        'forcedisplay[3]': 74,  // visível para incidente
        'forcedisplay[4]': 75,  // visível para requisição
        range: '0-50',
        sort: 1,
        order: 'ASC',
      };

      if (ticketType === 1) {
        params['criteria[0][field]'] = 74;  // visível para incidente
        params['criteria[0][searchtype]'] = 'equals';
        params['criteria[0][value]'] = 1;
      } else if (ticketType === 2) {
        params['criteria[0][field]'] = 75;  // visível para requisição
        params['criteria[0][searchtype]'] = 'equals';
        params['criteria[0][value]'] = 1;
      }

      const response = await this.client.get<GlpiSearchResult<Record<string, string>>>(
        '/search/ITILCategory',
        { headers, params }
      );

      if (!response.data.data) return [];

      return response.data.data.map((raw) => ({
        id: parseInt(raw['2']),
        name: raw['14'] || raw['1'] || '',
        completename: raw['1'] || '',
        is_incident: parseInt(raw['74'] || '0'),
        is_request: parseInt(raw['75'] || '0'),
      }));
    } catch (error) {
      logger.error('[GLPI] Erro ao buscar categorias:', error);
      return [];
    }
  }

  // ─── Chamados ────────────────────────────────────────────────────────────

  async createTicket(payload: GlpiTicketPayload): Promise<GlpiTicketResponse> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await this.client.post<GlpiTicketResponse>('/Ticket', payload, {
        headers,
      });

      logger.info(`[GLPI] Chamado criado: #${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('[GLPI] Erro ao criar chamado:', error);
      throw new Error('Falha ao criar chamado no GLPI. Tente novamente ou contate o suporte.');
    }
  }

  async getTicketUrl(ticketId: number): Promise<string> {
    return `${glpiConfig.portalUrl}/front/ticket.form.php?id=${ticketId}`;
  }
}

export const glpiService = new GlpiService();
