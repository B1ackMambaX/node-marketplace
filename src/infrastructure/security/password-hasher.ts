import type { PasswordHasher } from '../../application/contracts/security';

/** Хеширует пароли алгоритмом Argon2id и проверяет их через Bun.password. */
export class BunPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Bun.password.hash(password, { algorithm: 'argon2id' });
  }

  verify(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash);
  }
}
