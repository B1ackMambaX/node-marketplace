import { describe, expect, test } from 'bun:test';
import { MAX_INT } from '../src/domain/constants';
import { ApplicationError } from '../src/domain/errors';
import { canChangeOrderStatus, orderTotal } from '../src/domain/order-rules';

describe('Денежные расчёты и жизненный цикл заказа', () => {
  test('считает несколько позиций в целых копейках', () => {
    expect(
      orderTotal([
        { unitPrice: 19999, quantity: 3 },
        { unitPrice: 500, quantity: 2 },
      ]),
    ).toBe(60997);
  });
  test('принимает предельную сумму и отклоняет превышение', () => {
    expect(orderTotal([{ unitPrice: MAX_INT, quantity: 1 }])).toBe(MAX_INT);
    expect(() => orderTotal([{ unitPrice: MAX_INT, quantity: 2 }])).toThrow(ApplicationError);
    expect(() =>
      orderTotal([
        { unitPrice: MAX_INT, quantity: 1 },
        { unitPrice: 1, quantity: 1 },
      ]),
    ).toThrow(ApplicationError);
  });
  test('не принимает пустой заказ или небезопасную сумму', () => {
    expect(() => orderTotal([])).toThrow(ApplicationError);
    expect(() => orderTotal([{ unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 }])).toThrow(
      ApplicationError,
    );
  });
  test('отмена возможна до завершения, терминальные заказы нельзя возобновить', () => {
    expect(canChangeOrderStatus('CREATED', 'CANCELLED')).toBe(true);
    expect(canChangeOrderStatus('PROCESSING', 'CANCELLED')).toBe(true);
    expect(canChangeOrderStatus('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canChangeOrderStatus('CANCELLED', 'PROCESSING')).toBe(false);
    expect(canChangeOrderStatus('CREATED', 'COMPLETED')).toBe(false);
  });
  test('повтор текущего статуса разрешён', () => {
    for (const status of ['CREATED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canChangeOrderStatus(status, status)).toBe(true);
    }
  });
});
