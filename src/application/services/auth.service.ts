import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from '../../domain/constants';
import { unauthorized } from '../../domain/errors';
import type { UserProfile } from '../../domain/models';
import type { RegisterInput } from '../dto';
import type { Repositories } from '../contracts/repositories';
import type { Clock, PasswordHasher, TokenProvider } from '../contracts/security';
import type { RepositoryContext } from '../contracts/unit-of-work';

/** Регистрация, вход, выпуск токенов и ротация refresh-сессий через переданные зависимости. */
export class AuthService {
  constructor(
    private readonly unitOfWork: RepositoryContext,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenProvider,
    private readonly clock: Clock,
  ) {}

  /** Хеширует пароль и атомарно создаёт пользователя с первой refresh-сессией. */
  async register(input: RegisterInput) {
    const passwordHash = await this.passwords.hash(input.password);
    return this.unitOfWork.transaction(async (repositories) => {
      const user = await repositories.users.create({
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash,
      });
      return this.issueTokens(repositories, user);
    });
  }

  /** Проверяет пароль и выпускает пару токенов; не возвращает хеш пароля. */
  async login(email: string, password: string) {
    const credentials = await this.unitOfWork.read((repositories) =>
      repositories.users.findByEmail(email),
    );
    if (!credentials || !(await this.passwords.verify(password, credentials.passwordHash))) {
      throw unauthorized('INVALID_CREDENTIALS', 'Неверный email или пароль');
    }
    const user: UserProfile = {
      id: credentials.id,
      email: credentials.email,
      name: credentials.name,
      role: credentials.role,
      createdAt: credentials.createdAt,
    };
    return this.unitOfWork.transaction((repositories) => this.issueTokens(repositories, user));
  }

  /** Проверяет срок сессии, однократно потребляет старый refresh и выпускает новую пару токенов. */
  async refresh(refreshToken: string) {
    const hash = this.tokens.hash(refreshToken);
    return this.unitOfWork.transaction(async (repositories) => {
      const session = await repositories.sessions.findByHash(hash);
      if (!session || session.expiresAt <= this.clock.now()) {
        throw unauthorized('INVALID_REFRESH_TOKEN', 'Refresh-токен недействителен');
      }
      const user = await repositories.users.findById(session.userId);
      if (!user || !(await repositories.sessions.consume(session.id, hash))) {
        throw unauthorized('INVALID_REFRESH_TOKEN', 'Refresh-токен уже использован');
      }
      return this.issueTokens(repositories, user);
    });
  }

  /** Отзывает refresh-сессию; повторный вызов безопасен и не отзывает уже выданный access. */
  logout(refreshToken: string): Promise<void> {
    return this.unitOfWork.transaction((repositories) =>
      repositories.sessions.revoke(this.tokens.hash(refreshToken)),
    );
  }

  /** Проверяет access-токен и загружает текущий профиль, включая актуальную роль из БД. */
  async authenticate(accessToken: string): Promise<UserProfile> {
    const userId = await this.tokens.verifyAccess(accessToken);
    const user = await this.unitOfWork.read((repositories) => repositories.users.findById(userId));
    if (!user) {
      throw unauthorized('UNAUTHORIZED', 'Пользователь не найден');
    }
    return user;
  }

  /** Изменяет имя пользователя и возвращает обновлённый профиль. */
  updateName(userId: string, name: string): Promise<UserProfile> {
    return this.unitOfWork.transaction((repositories) =>
      repositories.users.updateName(userId, name),
    );
  }

  /** Выпускает токены и сохраняет хеш refresh с вычисленным по Clock сроком действия. */
  private async issueTokens(repositories: Repositories, user: UserProfile) {
    const refreshToken = this.tokens.createRefresh();
    const expiresAt = new Date(this.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);
    await repositories.sessions.create(user.id, this.tokens.hash(refreshToken), expiresAt);
    return {
      accessToken: await this.tokens.createAccess(user),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user,
    };
  }
}
