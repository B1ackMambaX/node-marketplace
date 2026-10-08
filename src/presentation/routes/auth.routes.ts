import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller';

/** Регистрирует публичные операции авторизации и защищённые операции собственного профиля. */
export function createAuthRoutes(controller: AuthController, authenticate: RequestHandler) {
  const router = Router();
  router.post('/auth/register', controller.register);
  router.post('/auth/login', controller.login);
  router.post('/auth/refresh', controller.refresh);
  router.post('/auth/logout', controller.logout);
  router.get('/users/me', authenticate, controller.profile);
  router.patch('/users/me', authenticate, controller.updateProfile);
  return router;
}
