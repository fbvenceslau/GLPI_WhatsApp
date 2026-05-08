import { v4 as uuidv4 } from 'uuid';
import { PendingRegistration } from '../models/pending-registration.model';
import { glpiService } from './glpi.service';
import { evolutionService } from './evolution.service';
import { glpiConfig } from '../config/glpi';
import logger from '../utils/logger';

class RegistrationService {

  async savePending(data: {
    phone: string;
    glpiUserId: number;
    username: string;
    tempPassword: string;
  }): Promise<void> {
    await PendingRegistration.create({ id: uuidv4(), ...data });
    logger.info(`[Registration] Cadastro pendente salvo: GLPI user ${data.glpiUserId} → ${data.phone}`);
  }

  async checkPendingRegistrations(): Promise<void> {
    const pending = await PendingRegistration.findAll({ where: { notified: false } });

    if (pending.length === 0) return;

    logger.info(`[Registration] Verificando ${pending.length} cadastro(s) pendente(s)`);

    for (const record of pending) {
      try {
        const glpiUser = await glpiService.getUserById(record.glpiUserId);

        if (!glpiUser || glpiUser.is_active !== 1) continue;

        const message = [
          `✅ *Seu cadastro foi aprovado pela T.I!*`,
          ``,
          `Seus dados de acesso ao portal:`,
          `👤 *Usuário:* ${record.username}`,
          `🔑 *Senha:* ${record.tempPassword}`,
          ``,
          `🌐 Acesse: ${glpiConfig.portalUrl}`,
          ``,
          `_Recomendamos alterar sua senha no primeiro acesso._`,
        ].join('\n');

        await evolutionService.sendText(record.phone, message);
        await evolutionService.sendText(
          record.phone,
          `_Atendimento encerrado. Quando precisar abrir um chamado, é só nos enviar uma mensagem!_ 👋`
        );
        await record.update({ notified: true });

        logger.info(`[Registration] Aprovação notificada: ${record.phone} (GLPI user ${record.glpiUserId})`);
      } catch (error) {
        logger.error(`[Registration] Erro ao processar registro ${record.id}:`, error);
      }
    }
  }
}

export const registrationService = new RegistrationService();
