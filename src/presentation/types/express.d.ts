import type { UserProfile } from '../../domain/models';

declare module 'express-serve-static-core' {
  /** Дополняет Express-запрос профилем, который устанавливает middleware аутентификации. */
  interface Request {
    /** Проверенный профиль; отсутствует до аутентификации и на публичных маршрутах. */
    user?: UserProfile;
  }
}
