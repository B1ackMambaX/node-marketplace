import { conflict } from '../../domain/errors';
import type { Pagination } from '../dto';
import type { RepositoryContext } from '../contracts/unit-of-work';
import { requireCategory } from './access';

/** Управление категориями с запретом удаления категорий, связанных с товарами. */
export class CategoryService {
  constructor(private readonly unitOfWork: RepositoryContext) {}

  /** Возвращает страницу категорий для публичного списка. */
  list(query: Pagination) {
    return this.unitOfWork.read((repositories) => repositories.categories.list(query));
  }

  /** Создаёт категорию; допуск администратора проверяется в HTTP-слое. */
  create(name: string) {
    return this.unitOfWork.transaction((repositories) => repositories.categories.create(name));
  }

  /** Проверяет существование категории и меняет её имя. */
  rename(categoryId: string, name: string) {
    return this.unitOfWork.transaction(async (repositories) => {
      await requireCategory(repositories, categoryId);
      return repositories.categories.rename(categoryId, name);
    });
  }

  /** Удаляет категорию, только если у неё нет товаров, включая архивные. */
  delete(categoryId: string): Promise<void> {
    return this.unitOfWork.transaction(async (repositories) => {
      await requireCategory(repositories, categoryId);
      if (await repositories.categories.hasProducts(categoryId)) {
        throw conflict('CATEGORY_NOT_EMPTY', 'В категории есть товары, включая архивные');
      }
      await repositories.categories.delete(categoryId);
    });
  }
}
