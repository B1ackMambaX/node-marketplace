import { MAX_CART_ITEMS, MAX_QUANTITY } from '../../domain/constants';
import { conflict, invalidInput, notFound } from '../../domain/errors';
import { ensurePurchasable, ensureStockAvailable } from '../../domain/product-rules';
import { toCartView } from '../mappers/cart.mapper';
import type { Repositories } from '../contracts/repositories';
import type { RepositoryContext } from '../contracts/unit-of-work';

/** Управление корзиной покупателя с актуальными ценами и проверкой доступности без резерва. */
export class CartService {
  constructor(private readonly unitOfWork: RepositoryContext) {}

  /** Возвращает корзину с текущими ценами; недоступные позиции остаются с available: false. */
  async get(buyerId: string) {
    const entries = await this.unitOfWork.read((repositories) => repositories.cart.list(buyerId));
    return toCartView(entries);
  }

  /** Прибавляет количество SKU к корзине, проверяя лимит позиций и свободный остаток. */
  add(buyerId: string, skuId: string, quantity: number) {
    return this.unitOfWork.transaction(async (repositories) => {
      const existing = await repositories.cart.findItem(buyerId, skuId);
      if (!existing && (await repositories.cart.count(buyerId)) >= MAX_CART_ITEMS) {
        throw conflict('CART_LIMIT', 'В корзине может быть не более 100 SKU');
      }
      return this.saveQuantity(repositories, buyerId, skuId, (existing?.quantity ?? 0) + quantity);
    });
  }

  /** Устанавливает количество существующей позиции после проверки доступности SKU. */
  update(buyerId: string, skuId: string, quantity: number) {
    return this.unitOfWork.transaction(async (repositories) => {
      if (!(await repositories.cart.findItem(buyerId, skuId))) {
        throw notFound('CART_ITEM_NOT_FOUND', 'Позиция корзины не найдена');
      }
      return this.saveQuantity(repositories, buyerId, skuId, quantity);
    });
  }

  /** Удаляет позицию из корзины указанного покупателя. */
  remove(buyerId: string, skuId: string): Promise<void> {
    return this.unitOfWork.transaction((repositories) =>
      repositories.cart.removeItem(buyerId, skuId),
    );
  }

  /** Очищает корзину покупателя без изменения складских остатков. */
  clear(buyerId: string): Promise<void> {
    return this.unitOfWork.transaction((repositories) => repositories.cart.clear(buyerId));
  }

  /** Проверяет лимит количества и доступность SKU, затем сохраняет позицию без резерва. */
  private async saveQuantity(
    repositories: Repositories,
    buyerId: string,
    skuId: string,
    quantity: number,
  ) {
    if (quantity > MAX_QUANTITY) {
      throw invalidInput('QUANTITY_LIMIT', 'Не более 10000 единиц одного SKU');
    }
    const sku = await repositories.skus.findById(skuId);
    ensurePurchasable(sku);
    ensureStockAvailable(sku, quantity);
    const item = await repositories.cart.setQuantity(buyerId, skuId, quantity);
    return { skuId: item.skuId, quantity: item.quantity };
  }
}
