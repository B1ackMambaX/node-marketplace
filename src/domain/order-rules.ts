import { MAX_INT } from './constants';
import { invalidInput } from './errors';
import type { OrderStatus } from './models';

/** Проверяет допустимость перехода статуса заказа; повтор текущего статуса разрешён. */
export function canChangeOrderStatus(current: OrderStatus, target: OrderStatus): boolean {
  if (current === target) return true;
  return (
    (current === 'CREATED' && (target === 'PROCESSING' || target === 'CANCELLED')) ||
    (current === 'PROCESSING' && (target === 'COMPLETED' || target === 'CANCELLED'))
  );
}

/**
 * Считает сумму позиций в копейках и требует целый итог от 1 до MAX_INT.
 * @throws ApplicationError Если итог небезопасен, неположителен или превышает лимит.
 */
export function orderTotal(items: readonly { unitPrice: number; quantity: number }[]): number {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!Number.isSafeInteger(total) || total < 1 || total > MAX_INT) {
    throw invalidInput('ORDER_TOTAL_LIMIT', 'Сумма заказа превышает допустимый предел');
  }
  return total;
}
