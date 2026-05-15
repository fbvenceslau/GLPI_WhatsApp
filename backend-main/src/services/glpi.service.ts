import axios, { AxiosInstance } from 'axios';
import { glpiConfig } from '../config/glpi';
import {
  GlpiUser,
  GlpiCategory,
  GlpiEntity,
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

  // ─── Usuários por Telefone ───────────────────────────────────────────────

  async findUserByPhone(phoneJid: string): Promise<GlpiUser | null> {
    try {
      const headers = await this.getAuthHeaders();

      // Extract number from JID and remove Brazil country code (55) for broader matching
      const fullNumber = phoneJid.split('@')[0];
      const searchNumber = fullNumber.startsWith('55') ? fullNumber.slice(2) : fullNumber;

      const response = await this.client.get<GlpiSearchResult<Record<string, string>>>(
        '/search/User',
        {
          headers,
          params: {
            'criteria[0][field]': 11,           // mobile
            'criteria[0][searchtype]': 'contains',
            'criteria[0][value]': searchNumber,
            'criteria[1][link]': 'OR',
            'criteria[1][field]': 9,            // phone
            'criteria[1][searchtype]': 'contains',
            'criteria[1][value]': searchNumber,
            'forcedisplay[0]': 1,               // login
            'forcedisplay[1]': 2,               // ID
            'forcedisplay[2]': 5,               // email
            'forcedisplay[3]': 8,               // firstname
            'forcedisplay[4]': 9,               // phone
            'forcedisplay[5]': 34,              // realname
          },
        }
      );

      if (!response.data.data || response.data.totalcount === 0) {
        return null;
      }

      const raw = response.data.data[0];
      const userId = parseInt(raw['2']);
      const email = raw['5'] || '';

      // Busca direta pelo ID para obter firstname/realname sem depender do mapeamento numérico da search API
      const detail = await this.client.get<{
        id: number;
        name: string;
        firstname: string;
        realname: string;
      }>(`/User/${userId}`, { headers });

      return {
        id: detail.data.id,
        name: detail.data.name || '',
        realname: detail.data.realname || '',
        firstname: detail.data.firstname || '',
        email,
        phone: raw['9'] || '',
      };
    } catch (error) {
      logger.error('[GLPI] Erro ao buscar usuário por telefone:', error);
      throw new Error('Falha na comunicação com o GLPI ao buscar usuário por telefone.');
    }
  }

  // ─── Entidades ───────────────────────────────────────────────────────────

  async getEntities(): Promise<GlpiEntity[]> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await this.client.get<GlpiSearchResult<Record<string, string>>>(
        '/search/Entity',
        {
          headers,
          params: {
            'forcedisplay[0]': 2,   // ID
            'forcedisplay[1]': 1,   // completename
            'forcedisplay[2]': 14,  // shortname
            range: '0-20',
            sort: 1,
            order: 'ASC',
          },
        }
      );

      if (!response.data.data) return [];

      return response.data.data.map((raw) => ({
        id: parseInt(raw['2']),
        name: raw['14'] || raw['1'] || '',
        completename: raw['1'] || '',
      }));
    } catch (error) {
      logger.error('[GLPI] Erro ao buscar entidades:', error);
      return [];
    }
  }

  async getUserEntities(userId: number): Promise<GlpiEntity[]> {
    try {
      const headers = await this.getAuthHeaders();

      // Busca os perfis/entidades associados ao usuário
      const profileResp = await this.client.get<Array<{ entities_id: number }>>(
        `/User/${userId}/Profile_User`,
        { headers, params: { range: '0-50' } }
      );

      if (!Array.isArray(profileResp.data) || profileResp.data.length === 0) {
        return this.getEntities();
      }

      const userEntityIds = new Set(profileResp.data.map((p) => p.entities_id));
      const allEntities = await this.getEntities();
      const filtered = allEntities.filter((e) => userEntityIds.has(e.id));

      return filtered.length > 0 ? filtered : allEntities;
    } catch (error) {
      logger.error('[GLPI] Erro ao buscar entidades do usuário:', error);
      return this.getEntities();
    }
  }

  // ─── Criação de Usuário Pendente ─────────────────────────────────────────

  async createPendingUser(data: {
    fullName: string;
    email: string;
    phoneJid: string;
  }): Promise<{ id: number; username: string; tempPassword: string }> {
    const headers = await this.getAuthHeaders();

    const phoneNumber = data.phoneJid.split('@')[0];
    const mobile = phoneNumber.startsWith('55') ? phoneNumber.slice(2) : phoneNumber;

    const parts = data.fullName.trim().split(' ');
    const firstname = parts[0];
    const realname = parts.slice(1).join(' ') || parts[0];

    const tempPassword = this.generateTempPassword();

    const response = await this.client.post<{ id: number }>(
      '/User',
      {
        input: {
          name: data.email,
          firstname,
          realname,
          mobile,
          is_active: 0,
          password: tempPassword,
          password2: tempPassword,
          _useremails: [data.email],
        },
      },
      { headers }
    );

    logger.info(`[GLPI] Usuário pendente criado: id=${response.data.id} login=${data.email}`);
    return { id: response.data.id, username: data.email, tempPassword };
  }

  async getUserById(userId: number): Promise<{ id: number; is_active: number } | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.client.get<{ id: number; is_active: number }>(
        `/User/${userId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      logger.error(`[GLPI] Erro ao buscar usuário ${userId}:`, error);
      return null;
    }
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  // ─── Categorias ──────────────────────────────────────────────────────────

  async getCategories(parentCategoryId?: number): Promise<GlpiCategory[]> {
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

      if (parentCategoryId !== undefined) {
        // Campo 3 = itilcategories_id (categoria pai) na API de busca do GLPI
        params['criteria[0][field]'] = 3;
        params['criteria[0][searchtype]'] = 'equals';
        params['criteria[0][value]'] = parentCategoryId;
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

  // ─── Acompanhamento de Chamados ──────────────────────────────────────────

  async getTicketStatus(ticketId: number): Promise<{ id: number; status: number } | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.client.get<{ id: number; status: number }>(
        `/Ticket/${ticketId}`,
        { headers }
      );
      return { id: response.data.id, status: response.data.status };
    } catch (error) {
      logger.error(`[GLPI] Erro ao buscar status do chamado ${ticketId}:`, error);
      return null;
    }
  }

  async getTicketFollowups(ticketId: number): Promise<Array<{ id: number; content: string }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.client.get<Array<{ id: number; content: string }>>(
        `/Ticket/${ticketId}/ITILFollowup`,
        { headers, params: { range: '0-50', sort: 'id', order: 'ASC' } }
      );
      if (!Array.isArray(response.data)) return [];
      return response.data.map(f => ({ id: f.id, content: f.content || '' }));
    } catch (error) {
      logger.error(`[GLPI] Erro ao buscar followups do chamado ${ticketId}:`, error);
      return [];
    }
  }
}

export const glpiService = new GlpiService();
