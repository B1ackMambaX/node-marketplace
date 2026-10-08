import type { Repositories } from '../../src/application/contracts/repositories';
import type { RepositoryContext } from '../../src/application/contracts/unit-of-work';

type RepositoryOverrides = { [Key in keyof Repositories]?: Partial<Repositories[Key]> };

/** Прерывает тест при обращении сервиса к не настроенному методу репозитория. */
async function unexpectedCall(): Promise<never> {
  throw new Error('The service used a repository method not configured by this test');
}

/**
 * Подмена RepositoryContext для тестов сервисов с настраиваемыми репозиториями и счётчиками.
 * Не реализует откат, изоляцию или блокировки; атомарность проверяется отдельно на PostgreSQL.
 */
export class TestUnitOfWork implements RepositoryContext {
  reads = 0;
  transactions = 0;
  readonly repositories: Repositories;

  constructor(overrides: RepositoryOverrides = {}) {
    this.repositories = {
      users: {
        findById: unexpectedCall,
        findByEmail: unexpectedCall,
        create: unexpectedCall,
        updateName: unexpectedCall,
        ...overrides.users,
      },
      sessions: {
        findByHash: unexpectedCall,
        create: unexpectedCall,
        consume: unexpectedCall,
        revoke: unexpectedCall,
        ...overrides.sessions,
      },
      categories: {
        list: unexpectedCall,
        findById: unexpectedCall,
        create: unexpectedCall,
        rename: unexpectedCall,
        hasProducts: unexpectedCall,
        delete: unexpectedCall,
        ...overrides.categories,
      },
      products: {
        listOwned: unexpectedCall,
        findOwned: unexpectedCall,
        findById: unexpectedCall,
        create: unexpectedCall,
        updateContent: unexpectedCall,
        setStatus: unexpectedCall,
        softDelete: unexpectedCall,
        ...overrides.products,
      },
      skus: {
        findById: unexpectedCall,
        create: unexpectedCall,
        update: unexpectedCall,
        softDelete: unexpectedCall,
        ...overrides.skus,
      },
      inventory: {
        setQuantity: unexpectedCall,
        reserve: unexpectedCall,
        release: unexpectedCall,
        fulfill: unexpectedCall,
        ...overrides.inventory,
      },
      tickets: {
        list: unexpectedCall,
        findById: unexpectedCall,
        create: unexpectedCall,
        decide: unexpectedCall,
        ...overrides.tickets,
      },
      catalog: { list: unexpectedCall, findById: unexpectedCall, ...overrides.catalog },
      cart: {
        list: unexpectedCall,
        findItem: unexpectedCall,
        count: unexpectedCall,
        setQuantity: unexpectedCall,
        removeItem: unexpectedCall,
        clear: unexpectedCall,
        removeItems: unexpectedCall,
        ...overrides.cart,
      },
      orders: {
        list: unexpectedCall,
        findById: unexpectedCall,
        findByKey: unexpectedCall,
        create: unexpectedCall,
        setStatus: unexpectedCall,
        ...overrides.orders,
      },
    };
  }

  /** Считает чтение и выполняет callback на настроенных тестовых репозиториях. */
  async read<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T> {
    this.reads++;
    return operation(this.repositories);
  }

  /** Считает транзакционный вызов без настоящей транзакции и выполняет callback. */
  async transaction<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T> {
    this.transactions++;
    return operation(this.repositories);
  }
}
