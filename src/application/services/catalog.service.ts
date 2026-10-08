import { notFound } from '../../domain/errors';
import { mapPage, type CatalogQuery } from '../dto';
import { toPublicProduct } from '../mappers/catalog.mapper';
import type { RepositoryContext } from '../contracts/unit-of-work';

/** Чтение публичного каталога с явным исключением внутренних полей через маппер. */
export class CatalogService {
  constructor(private readonly unitOfWork: RepositoryContext) {}

  /** Возвращает страницу публичных товаров по фильтрам и сортировке. */
  async list(query: CatalogQuery) {
    const products = await this.unitOfWork.read((repositories) => repositories.catalog.list(query));
    return mapPage(products, toPublicProduct);
  }

  /** Возвращает публичную карточку или ошибку отсутствия недоступного товара. */
  async get(productId: string) {
    const product = await this.unitOfWork.read((repositories) =>
      repositories.catalog.findById(productId),
    );
    if (!product) {
      throw notFound('PRODUCT_NOT_FOUND', 'Товар не найден');
    }
    return toPublicProduct(product);
  }
}
