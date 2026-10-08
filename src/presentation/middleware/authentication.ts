import type { RequestHandler } from 'express';
import type { AuthService } from '../../application/services/auth.service';
import { ApplicationError, unauthorized } from '../../domain/errors';
import type { Role } from '../../domain/models';
import { currentUser } from '../request';

/** Создаёт middleware, проверяющий Bearer-токен через AuthService и сохраняющий текущий профиль в request.user. */
export function createAuthentication(auth: AuthService): RequestHandler {
  return async (request, _response, next) => {
    const token = request.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) {
      throw unauthorized('UNAUTHORIZED', 'Требуется Bearer-токен');
    }
    request.user = await auth.authenticate(token);
    next();
  };
}

/** Создаёт middleware допуска по актуальной роли; выполняется после аутентификации. */
export function allowRoles(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!roles.includes(currentUser(request).role)) {
      throw new ApplicationError('forbidden', 'FORBIDDEN', 'Недостаточно прав');
    }
    next();
  };
}
