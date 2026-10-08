/**
 * Создаёт демонстрационные аккаунты, категории и товары в одной транзакции.
 * Повторный запуск сохраняет существующие записи; пароль новых аккаунтов берётся из SEED_PASSWORD.
 */
import { prisma } from '../src/infrastructure/database/client';
import type { Role } from '../src/generated/prisma/client';

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set SEED_PASSWORD (at least 12 characters) before running the demo seed');
const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' });
const accounts: { email: string; name: string; role: Role }[] = [
  { email: 'buyer@demo.local', name: 'Покупатель', role: 'BUYER' },
  { email: 'seller@demo.local', name: 'ТехноМир', role: 'SELLER' },
  { email: 'seller2@demo.local', name: 'Уютный дом', role: 'SELLER' },
  { email: 'moderator@demo.local', name: 'Модератор', role: 'MODERATOR' },
  { email: 'admin@demo.local', name: 'Администратор', role: 'ADMIN' },
];

try {
  await prisma.$transaction(async (tx) => {
    const users = [];
    for (const account of accounts) {
      // Preserve existing accounts and passwords on reruns.
      users.push(
        await tx.user.upsert({
          where: { email: account.email },
          create: { ...account, passwordHash },
          update: {},
        }),
      );
    }
    const electronics = await tx.category.upsert({
      where: { name: 'Электроника' },
      create: { name: 'Электроника' },
      update: {},
    });
    const home = await tx.category.upsert({
      where: { name: 'Дом' },
      create: { name: 'Дом' },
      update: {},
    });
    const demoProducts = [
      {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Механическая клавиатура',
        description: 'Компактная клавиатура с переключателями red',
        sellerId: users[1]!.id,
        categoryId: electronics.id,
        status: 'APPROVED' as const,
        price: 650000,
        quantity: 20,
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        name: 'Настольная лампа',
        description: 'Лампа с регулировкой яркости',
        sellerId: users[2]!.id,
        categoryId: home.id,
        status: 'APPROVED' as const,
        price: 250000,
        quantity: 15,
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        name: 'Беспроводная мышь',
        description: 'Мышь для работы и учёбы',
        sellerId: users[1]!.id,
        categoryId: electronics.id,
        status: 'DRAFT' as const,
        price: 180000,
        quantity: 30,
      },
    ];
    for (const { price, quantity, ...product } of demoProducts) {
      await tx.product.upsert({
        where: { id: product.id },
        update: {},
        create: {
          ...product,
          skus: {
            create: {
              name: 'Базовая комплектация',
              attributes: { color: 'black' },
              price,
              costPrice: Math.floor(price / 2),
              inventory: { create: { quantity } },
            },
          },
        },
      });
    }
  });
  console.log('Demo seed complete. Accounts:', accounts.map((account) => account.email).join(', '));
} finally {
  await prisma.$disconnect();
}
