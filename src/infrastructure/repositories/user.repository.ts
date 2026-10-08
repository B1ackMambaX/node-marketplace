import type { UserRepository } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';
import { userSelection } from './selections';

/** Хранит пользователей; методы профиля явно исключают хеш пароля из результата. */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseClient) {}

  findById(id: string) {
    return this.database.user.findUnique({ where: { id }, select: userSelection });
  }

  findByEmail(email: string) {
    return this.database.user.findUnique({ where: { email } });
  }

  create(input: Parameters<UserRepository['create']>[0]) {
    return this.database.user.create({ data: input, select: userSelection });
  }

  updateName(id: string, name: string) {
    return this.database.user.update({ where: { id }, data: { name }, select: userSelection });
  }
}
