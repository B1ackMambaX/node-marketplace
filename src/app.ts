import { createDependencies } from './dependencies';
import { createHttpApp } from './presentation/app';

/** Собирает HTTP-приложение с реальными адаптерами из dependencies.ts */
export function createApp() {
  return createHttpApp(createDependencies());
}
