import dotenv from 'dotenv';

dotenv.config();

export const glpiConfig = {
  baseUrl: process.env.GLPI_BASE_URL || '',
  appToken: process.env.GLPI_APP_TOKEN || '',
  userToken: process.env.GLPI_USER_TOKEN || '',
  portalUrl: process.env.GLPI_PORTAL_URL || '',
  // requesttypes_id=6 = WhatsApp (cadastre como fonte no GLPI ou use 1=Helpdesk)
  requestTypeId: parseInt(process.env.GLPI_REQUEST_TYPE_ID || '1'),
  defaultEntityId: parseInt(process.env.GLPI_ENTITY_ID || '0'),
};

if (!glpiConfig.baseUrl || !glpiConfig.appToken || !glpiConfig.userToken) {
  console.warn('[GLPI Config] Variáveis de ambiente do GLPI não configuradas corretamente.');
}
