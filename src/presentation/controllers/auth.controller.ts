import type { RequestHandler } from 'express';
import type { AuthService } from '../../application/services/auth.service';
import { currentUser } from '../request';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateProfileSchema,
} from '../schemas/auth.schema';

/** Разбирает HTTP-запросы регистрации, входа, токенов и профиля и вызывает AuthService. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Проверяет тело регистрации и возвращает профиль с токенами и статусом 201. */
  register: RequestHandler = async (request, response) => {
    const input = registerSchema.parse(request.body);
    response.status(201).json(await this.auth.register(input));
  };

  /** Проверяет тело входа и возвращает выданную сервисом пару токенов. */
  login: RequestHandler = async (request, response) => {
    const { email, password } = loginSchema.parse(request.body);
    response.json(await this.auth.login(email, password));
  };

  /** Проверяет refresh-токен в теле и возвращает результат его ротации. */
  refresh: RequestHandler = async (request, response) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    response.json(await this.auth.refresh(refreshToken));
  };

  /** Отзывает переданный refresh-токен и возвращает 204 без тела. */
  logout: RequestHandler = async (request, response) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    await this.auth.logout(refreshToken);
    response.sendStatus(204);
  };

  /** Возвращает профиль, установленный middleware аутентификации. */
  profile: RequestHandler = (request, response) => {
    response.json(currentUser(request));
  };

  /** Передаёт новое имя текущего пользователя сервису и возвращает профиль. */
  updateProfile: RequestHandler = async (request, response) => {
    const { name } = updateProfileSchema.parse(request.body);
    response.json(await this.auth.updateName(currentUser(request).id, name));
  };
}
