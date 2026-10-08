import type { Repositories } from './repositories';

/**
 * Предоставляет репозитории для обычного чтения и атомарных прикладных операций.
 * Сервисы задают границы операции, адаптер управляет её выполнением в БД.
 */
export interface RepositoryContext {
  /** Выполняет операцию через репозитории без общей транзакции и гарантии единого снимка. */
  read<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T>;
  /**
   * Выполняет операцию в общей транзакции всех переданных репозиториев.
   * При ошибке откатывает изменения; адаптер может повторить callback при конфликте.
   * Не помещайте в callback необратимые внешние действия.
   */
  transaction<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T>;
}
