import { Router, type RequestHandler } from 'express';
import type { ModerationController } from '../controllers/moderation.controller';
import { allowRoles } from '../middleware/authentication';

/** Регистрирует очередь и решения относительно /moderation для MODERATOR и ADMIN. */
export function createModerationRoutes(
  controller: ModerationController,
  authenticate: RequestHandler,
) {
  const router = Router();
  router.use(authenticate, allowRoles('MODERATOR', 'ADMIN'));
  router.get('/tickets', controller.list);
  router.get('/tickets/:id', controller.get);
  router.post('/tickets/:id/approve', controller.approve);
  router.post('/tickets/:id/reject', controller.reject);
  return router;
}
