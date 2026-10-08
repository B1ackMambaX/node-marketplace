import type { Clock, PasswordHasher, TokenProvider } from '../contracts/security';
import type { RepositoryContext } from '../contracts/unit-of-work';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { CatalogService } from './catalog.service';
import { CategoryService } from './category.service';
import { ModerationService } from './moderation.service';
import { OrderService } from './order.service';
import { ProductService } from './product.service';
import { SkuService } from './sku.service';

/** Собирает прикладные сервисы из переданных контрактов, не выбирая конкретные адаптеры. */
export function createServices(
  repositoryContext: RepositoryContext,
  passwords: PasswordHasher,
  tokens: TokenProvider,
  clock: Clock,
) {
  return {
    auth: new AuthService(repositoryContext, passwords, tokens, clock),
    categories: new CategoryService(repositoryContext),
    products: new ProductService(repositoryContext),
    skus: new SkuService(repositoryContext),
    moderation: new ModerationService(repositoryContext),
    catalog: new CatalogService(repositoryContext),
    cart: new CartService(repositoryContext),
    orders: new OrderService(repositoryContext, tokens),
  };
}

/** Набор прикладных сервисов, передаваемый HTTP-слою при сборке приложения. */
export type ApplicationServices = ReturnType<typeof createServices>;
