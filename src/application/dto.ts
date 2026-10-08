import type {
  Attributes,
  OrderItem,
  OrderStatus,
  ProductStatus,
  TicketStatus,
} from '../domain/models';

/** Размер страницы и число пропускаемых записей после нормализации HTTP-входа. */
export interface Pagination {
  limit: number;
  offset: number;
}

/** Страница результатов с общим числом записей до применения limit и offset. */
export interface Page<T> extends Pagination {
  items: T[];
  total: number;
}

/** Данные публичной регистрации; допускает только покупателя или продавца. */
export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  role: 'BUYER' | 'SELLER';
}

/** Контент нового товара продавца; сервис создаёт товар как черновик. */
export interface CreateProductInput {
  name: string;
  description: string;
  categoryId: string;
  images: string[];
}

/** Переданные поля изменения товара; пропущенные поля сохраняют прежние значения. */
export type UpdateProductInput = Partial<CreateProductInput>;

/** Данные нового варианта товара; цены в копейках, quantity включает резерв. */
export interface CreateSkuInput {
  name: string;
  attributes: Attributes;
  price: number;
  costPrice?: number | null;
  quantity: number;
}

/** Переданные поля изменения SKU; отсутствие поля не означает сброс его значения. */
export type UpdateSkuInput = Partial<CreateSkuInput>;
/** Пагинация и необязательный фильтр статуса для товаров конкретного продавца. */
export interface SellerProductQuery extends Pagination {
  status?: ProductStatus;
}
/** Пагинация заявок, обязательный выбранный статус и необязательный фильтр товара. */
export interface TicketQuery extends Pagination {
  status: TicketStatus;
  productId?: string;
}
/** Пагинация заказов с необязательным фильтром состояния. */
export interface OrderQuery extends Pagination {
  status?: OrderStatus;
}
/** Фильтры и сортировка публичного каталога; границы цены заданы в копейках. */
export interface CatalogQuery extends Pagination {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: 'newest' | 'oldest' | 'priceAsc' | 'priceDesc';
}

/** Данные сохранения заказа: снимки позиций, итог и сведения об идемпотентности. */
export interface CreateOrderInput {
  buyerId: string;
  deliveryAddress: string;
  idempotencyKey: string;
  requestHash: string;
  total: number;
  items: OrderItem[];
}

/** Преобразует элементы страницы, сохраняя total и параметры пагинации. */
export function mapPage<T, R>(page: Page<T>, transform: (item: T) => R): Page<R> {
  return { ...page, items: page.items.map(transform) };
}
