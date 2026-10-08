import type {
  CartEntry,
  CartItem,
  CatalogProduct,
  Category,
  ModerationTicket,
  OrderStatus,
  ProductDetails,
  ProductStatus,
  PurchasableSku,
  Session,
  Sku,
  StoredOrder,
  TicketStatus,
  UserCredentials,
  UserProfile,
} from '../../domain/models';
import type {
  CatalogQuery,
  CreateOrderInput,
  CreateProductInput,
  CreateSkuInput,
  OrderQuery,
  Page,
  Pagination,
  SellerProductQuery,
  TicketQuery,
  UpdateProductInput,
  UpdateSkuInput,
} from '../dto';

/** Чтение профилей и хранение пользователей; хеш пароля нужен только для входа. */
export interface UserRepository {
  /** Возвращает профиль без хеша пароля или null, если пользователь отсутствует. */
  findById(id: string): Promise<UserProfile | null>;
  /** Возвращает учётные данные с хешем пароля для проверки входа или null. */
  findByEmail(email: string): Promise<UserCredentials | null>;
  /** Сохраняет пользователя с готовым хешем пароля и возвращает безопасный профиль. */
  create(
    input: Omit<UserProfile, 'id' | 'createdAt'> & { passwordHash: string },
  ): Promise<UserProfile>;
  /** Изменяет имя и возвращает профиль без хеша пароля. */
  updateName(id: string, name: string): Promise<UserProfile>;
}

/** Хранение refresh-сессий по хешам токенов; ротацию координирует сервис. */
export interface SessionRepository {
  /** Находит сессию по хешу токена; срок действия проверяет сервис. */
  findByHash(hash: string): Promise<Session | null>;
  /** Сохраняет хеш refresh-токена, владельца и срок действия сессии. */
  create(userId: string, hash: string, expiresAt: Date): Promise<void>;
  /** Однократно удаляет сессию по ID и хешу; false означает, что она уже отсутствует. */
  consume(id: string, hash: string): Promise<boolean>;
  /** Удаляет сессию по хешу; повторный отзыв безопасен. */
  revoke(hash: string): Promise<void>;
}

/** Чтение и изменение плоских категорий каталога. */
export interface CategoryRepository {
  /** Возвращает страницу категорий, отсортированную по имени и ID. */
  list(query: Pagination): Promise<Page<Category>>;
  /** Находит категорию или возвращает null. */
  findById(id: string): Promise<Category | null>;
  /** Сохраняет новую категорию с уникальным именем. */
  create(name: string): Promise<Category>;
  /** Обновляет имя существующей категории. */
  rename(id: string, name: string): Promise<Category>;
  /** Проверяет наличие любых товаров категории, включая архивные. */
  hasProducts(id: string): Promise<boolean>;
  /** Удаляет категорию; проверку допустимости удаления выполняет сервис. */
  delete(id: string): Promise<void>;
}

/** Хранение товаров; проверку бизнес-состояния выполняет прикладной сервис. */
export interface ProductRepository {
  /** Возвращает страницу неархивных товаров указанного продавца. */
  listOwned(sellerId: string, query: SellerProductQuery): Promise<Page<ProductDetails>>;
  /** Возвращает неархивный товар владельца; для чужого или отсутствующего — null. */
  findOwned(id: string, sellerId: string): Promise<ProductDetails | null>;
  /** Находит товар для внутренних сценариев, включая архивный. */
  findById(id: string): Promise<ProductDetails | null>;
  /** Сохраняет новый товар продавца со статусом черновика по умолчанию. */
  create(sellerId: string, input: CreateProductInput): Promise<ProductDetails>;
  /** Обновляет только переданные поля контента товара. */
  updateContent(id: string, input: UpdateProductInput): Promise<ProductDetails>;
  /** Записывает статус товара; допустимость перехода проверяет сервис. */
  setStatus(id: string, status: ProductStatus): Promise<void>;
  /** Помечает товар удалённым, сохраняя связи с заказами и заявками. */
  softDelete(id: string): Promise<void>;
}

/** Хранение вариантов товара; изменение физического остатка выполняется отдельно. */
export interface SkuRepository {
  /** Находит неархивный SKU с товаром и остатком для проверки покупки. */
  findById(id: string): Promise<PurchasableSku | null>;
  /** Создаёт SKU и связанную запись физического остатка. */
  create(productId: string, input: CreateSkuInput): Promise<Sku>;
  /** Обновляет переданные поля SKU, не изменяя quantity или reserved. */
  update(id: string, input: Omit<UpdateSkuInput, 'quantity'>): Promise<Sku>;
  /** Помечает SKU удалённым, сохраняя историю заказов. */
  softDelete(id: string): Promise<void>;
}

/** Атомарные операции с физическим остатком и резервом SKU. */
export interface InventoryRepository {
  /** Устанавливает физическое количество; сервис предварительно проверяет нижнюю границу резерва. */
  setQuantity(skuId: string, quantity: number): Promise<void>;
  /**
   * Увеличивает резерв, если он равен observedReserved и свободного остатка достаточно.
   * Возвращает false, если условие не выполнено или запись отсутствует.
   */
  reserve(skuId: string, quantity: number, observedReserved: number): Promise<boolean>;
  /** Уменьшает резерв без изменения физического остатка; false означает недостаточный резерв или отсутствие записи. */
  release(skuId: string, quantity: number): Promise<boolean>;
  /** Уменьшает физический остаток и резерв одновременно; false означает, что списание невозможно. */
  fulfill(skuId: string, quantity: number): Promise<boolean>;
}

/** Хранение заявок, снимков товаров и решений модераторов. */
export interface TicketRepository {
  /** Возвращает страницу заявок выбранного статуса, начиная с самых ранних. */
  list(query: TicketQuery): Promise<Page<ModerationTicket>>;
  /** Находит заявку или возвращает null. */
  findById(id: string): Promise<ModerationTicket | null>;
  /** Сохраняет заявку с JSON-снимком переданного товара и его SKU. */
  create(product: ProductDetails): Promise<ModerationTicket>;
  /** Записывает решение, модератора, причину и время; статус товара меняет сервис в той же транзакции. */
  decide(
    id: string,
    moderatorId: string,
    status: Exclude<TicketStatus, 'PENDING'>,
    reason: string | null,
  ): Promise<ModerationTicket>;
}

/** Выборка опубликованных неархивных товаров с активными SKU для публичного каталога. */
export interface CatalogRepository {
  /**
   * Применяет фильтры и пагинацию; сортировка цены использует минимум всех активных SKU.
   * Ценовой фильтр требует хотя бы один активный SKU в диапазоне.
   */
  list(query: CatalogQuery): Promise<Page<CatalogProduct>>;
  /** Возвращает доступный для публичной карточки товар или null; нулевой остаток не скрывает товар. */
  findById(id: string): Promise<CatalogProduct | null>;
}

/** Хранение выбранных SKU покупателя без резервирования склада. */
export interface CartRepository {
  /** Возвращает позиции покупателя с актуальными товарами, ценами и остатками, включая недоступные. */
  list(buyerId: string): Promise<CartEntry[]>;
  /** Находит позицию по покупателю и SKU или возвращает null. */
  findItem(buyerId: string, skuId: string): Promise<CartItem | null>;
  /** Считает число разных SKU в корзине покупателя. */
  count(buyerId: string): Promise<number>;
  /** Создаёт позицию или устанавливает её количество; не прибавляет к прежнему значению. */
  setQuantity(buyerId: string, skuId: string, quantity: number): Promise<CartItem>;
  /** Удаляет SKU только из корзины указанного покупателя. */
  removeItem(buyerId: string, skuId: string): Promise<void>;
  /** Удаляет все позиции корзины указанного покупателя. */
  clear(buyerId: string): Promise<void>;
  /** Удаляет по ID только оформленные позиции указанного покупателя. */
  removeItems(buyerId: string, ids: string[]): Promise<void>;
}

/** Хранение заказов со снимками позиций и внутренними данными идемпотентности. */
export interface OrderRepository {
  /** Возвращает страницу заказов; без buyerId выборка охватывает всех покупателей. */
  list(query: OrderQuery, buyerId?: string): Promise<Page<StoredOrder>>;
  /** Находит заказ; переданный buyerId ограничивает выборку владельцем. */
  findById(id: string, buyerId?: string): Promise<StoredOrder | null>;
  /** Находит исходный заказ по ключу в пределах указанного покупателя. */
  findByKey(buyerId: string, key: string): Promise<StoredOrder | null>;
  /** Сохраняет заказ и снимки его позиций; резервом и корзиной управляет сервис. */
  create(input: CreateOrderInput): Promise<StoredOrder>;
  /** Записывает статус без складских эффектов; их выполняет сервис в той же транзакции. */
  setStatus(id: string, status: OrderStatus): Promise<StoredOrder>;
}

/**
 * Набор репозиториев, доступных одной прикладной операции.
 * В callback transaction все используют один общий клиент транзакции.
 */
export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  categories: CategoryRepository;
  products: ProductRepository;
  skus: SkuRepository;
  inventory: InventoryRepository;
  tickets: TicketRepository;
  catalog: CatalogRepository;
  cart: CartRepository;
  orders: OrderRepository;
}
