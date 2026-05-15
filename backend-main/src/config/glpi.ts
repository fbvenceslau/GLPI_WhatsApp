const parseOptionalInt = (val: string | undefined): number | undefined =>
  val ? parseInt(val) : undefined;

export const glpiConfig = {
  baseUrl: process.env.GLPI_BASE_URL || '',
  appToken: process.env.GLPI_APP_TOKEN || '',
  userToken: process.env.GLPI_USER_TOKEN || '',
  portalUrl: process.env.GLPI_PORTAL_URL || '',
  requestTypeId: parseInt(process.env.GLPI_REQUEST_TYPE_ID || '1'),
  defaultEntityId: parseInt(process.env.GLPI_ENTITY_ID || '0'),
  categoryParentTI: parseOptionalInt(process.env.GLPI_CATEGORY_PARENT_TI),
  categoryParentCompras: parseOptionalInt(process.env.GLPI_CATEGORY_PARENT_COMPRAS),
  categoryParentManutencao: parseOptionalInt(process.env.GLPI_CATEGORY_PARENT_MANUTENCAO),
  categoryParentFacilities: parseOptionalInt(process.env.GLPI_CATEGORY_PARENT_FACILITIES),
};

if (!glpiConfig.baseUrl || !glpiConfig.appToken || !glpiConfig.userToken) {
  console.warn('[GLPI Config] Variáveis de ambiente do GLPI não configuradas corretamente.');
}
