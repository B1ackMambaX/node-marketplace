import { expect, test } from 'bun:test';
import {
  skuCreate,
  skuPatch,
  productCreate,
  productPatch,
} from '../src/presentation/schemas/product.schema';

test('PATCH не сбрасывает остатки, характеристики и изображения', () => {
  expect(skuPatch.parse({ price: 2500 })).toEqual({ price: 2500 });
  expect(productPatch.parse({ name: 'Новое название' })).toEqual({ name: 'Новое название' });
  expect(() => skuPatch.parse({})).toThrow();
  expect(() => productPatch.parse({})).toThrow();
});
test('отклоняет дробные суммы, отрицательные остатки и неизвестные поля', () => {
  expect(() => skuCreate.parse({ name: 'SKU', price: 1.5 })).toThrow();
  expect(() => skuCreate.parse({ name: 'SKU', price: 100, quantity: -1 })).toThrow();
  expect(() => skuPatch.parse({ reserved: 0 })).toThrow();
  expect(() =>
    productCreate.parse({
      name: 'Товар',
      description: 'Описание',
      categoryId: crypto.randomUUID(),
      status: 'APPROVED',
    }),
  ).toThrow();
});
