import type { RequestHandler } from 'express';
import type { CategoryService } from '../../application/services/category.service';
import { pathId } from '../request';
import { categorySchema } from '../schemas/category.schema';
import { paginationSchema } from '../schemas/common.schema';

/** Обрабатывает чтение и изменение категорий через CategoryService. */
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  /** Проверяет пагинацию и возвращает публичный список категорий. */
  list: RequestHandler = async (request, response) => {
    response.json(await this.categories.list(paginationSchema.parse(request.query)));
  };

  /** Проверяет имя и возвращает новую категорию со статусом 201. */
  create: RequestHandler = async (request, response) => {
    const { name } = categorySchema.parse(request.body);
    response.status(201).json(await this.categories.create(name));
  };

  /** Проверяет UUID и имя и возвращает обновлённую категорию. */
  rename: RequestHandler = async (request, response) => {
    const { name } = categorySchema.parse(request.body);
    response.json(await this.categories.rename(pathId(request), name));
  };

  /** Передаёт UUID сервису удаления и возвращает 204. */
  delete: RequestHandler = async (request, response) => {
    await this.categories.delete(pathId(request));
    response.sendStatus(204);
  };
}
