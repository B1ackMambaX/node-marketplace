import { conflict, notFound } from '../../domain/errors';
import { ensureProductEditable } from '../../domain/product-rules';
import type { CreateSkuInput, UpdateSkuInput } from '../dto';
import type { RepositoryContext } from '../contracts/unit-of-work';
import { requireOwnedProduct, requireProductSku } from './access';

/** Управление вариантами товара и физическим остатком с сохранением складских инвариантов. */
export class SkuService {
  constructor(private readonly unitOfWork: RepositoryContext) {}

  /** Возвращает активные SKU товара после проверки продавца-владельца. */
  async list(sellerId: string, productId: string) {
    const product = await this.unitOfWork.read((repositories) =>
      requireOwnedProduct(repositories, productId, sellerId),
    );
    return product.skus;
  }

  /** Создаёт SKU с остатком и возвращает товар в DRAFT; PENDING запрещает создание. */
  create(sellerId: string, productId: string, input: CreateSkuInput) {
    return this.unitOfWork.transaction(async (repositories) => {
      ensureProductEditable(await requireOwnedProduct(repositories, productId, sellerId));
      await repositories.products.setStatus(productId, 'DRAFT');
      return repositories.skus.create(productId, input);
    });
  }

  /**
   * Меняет переданные поля SKU; физический остаток не может стать меньше резерва.
   * Имя или характеристики возвращают товар в DRAFT; цена и остаток не требуют новой модерации.
   */
  update(sellerId: string, productId: string, skuId: string, input: UpdateSkuInput) {
    return this.unitOfWork.transaction(async (repositories) => {
      const product = await requireOwnedProduct(repositories, productId, sellerId);
      ensureProductEditable(product);
      const sku = requireProductSku(product, skuId);
      if (!sku.inventory) {
        throw notFound('SKU_NOT_FOUND', 'SKU не найден');
      }
      const { quantity, ...changes } = input;
      if (quantity !== undefined) {
        if (quantity < sku.inventory.reserved) {
          throw conflict('STOCK_BELOW_RESERVED', 'Остаток не может быть меньше резерва');
        }
        await repositories.inventory.setQuantity(skuId, quantity);
      }
      if (changes.name !== undefined || changes.attributes !== undefined) {
        await repositories.products.setStatus(productId, 'DRAFT');
      }
      return repositories.skus.update(skuId, changes);
    });
  }

  /** Мягко удаляет SKU без резерва и возвращает товар в DRAFT; PENDING запрещает удаление. */
  delete(sellerId: string, productId: string, skuId: string): Promise<void> {
    return this.unitOfWork.transaction(async (repositories) => {
      const product = await requireOwnedProduct(repositories, productId, sellerId);
      ensureProductEditable(product);
      const sku = requireProductSku(product, skuId);
      if ((sku.inventory?.reserved ?? 0) > 0) {
        throw conflict('ACTIVE_RESERVATIONS', 'У SKU есть активные резервы');
      }
      await repositories.skus.softDelete(skuId);
      await repositories.products.setStatus(productId, 'DRAFT');
    });
  }
}
