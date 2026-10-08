import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { TokenProvider } from '../../application/contracts/security';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../domain/constants';
import { unauthorized } from '../../domain/errors';
import type { UserProfile } from '../../domain/models';

const ISSUER = 'marketplace';
const AUDIENCE = 'marketplace-api';

/** Выпускает JWT HS256, случайные refresh-токены и SHA-256-хеши строк. */
export class JwtTokenProvider implements TokenProvider {
  constructor(private readonly secret: Uint8Array) {}

  /** Подписывает JWT с ID пользователя, ролью и сроком действия access-токена. */
  createAccess(user: UserProfile): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.secret);
  }

  /**
   * Проверяет подпись, алгоритм, issuer, audience и срок JWT, затем возвращает subject.
   * Роль из payload не заменяет загрузку текущего профиля в AuthService.
   */
  async verifyAccess(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (!payload.sub) {
        throw new Error('Missing subject');
      }
      return payload.sub;
    } catch {
      throw unauthorized('INVALID_ACCESS_TOKEN', 'Access-токен недействителен или истёк');
    }
  }

  /** Создаёт refresh-токен из 48 криптографически случайных байтов в base64url. */
  createRefresh(): string {
    return randomBytes(48).toString('base64url');
  }

  /** Возвращает SHA-256 строки для хранения токенов и сверки оформления; не используется для паролей. */
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
