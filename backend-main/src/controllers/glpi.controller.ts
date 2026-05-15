import { Request, Response } from 'express';
import { glpiService } from '../services/glpi.service';
import logger from '../utils/logger';

export async function listCategories(req: Request, res: Response): Promise<void> {
  try {
    const parentCategoryId = req.query.parentId ? parseInt(req.query.parentId as string) : undefined;
    const categories = await glpiService.getCategories(parentCategoryId);
    res.json({ data: categories, count: categories.length });
  } catch (error) {
    logger.error('[GlpiController] Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Falha ao buscar categorias do GLPI.' });
  }
}

export async function lookupUser(req: Request, res: Response): Promise<void> {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Parâmetro email é obrigatório.' });
    return;
  }

  try {
    const user = await glpiService.findUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado no GLPI.' });
      return;
    }
    res.json({ data: user });
  } catch (error) {
    logger.error('[GlpiController] Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Falha na comunicação com o GLPI.' });
  }
}
