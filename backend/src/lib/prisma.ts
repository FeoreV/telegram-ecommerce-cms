import { PrismaClient } from '@prisma/client';
import { databaseService } from './database';

// Use the new DatabaseService under the hood for backward compatibility
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(target, prop) {
    // Get the initialized Prisma client from DatabaseService
    const client = databaseService.getPrisma();
    return typeof client[prop as keyof PrismaClient] === 'function'
      ? (client[prop as keyof PrismaClient] as (...args: any[]) => any).bind(client)
      : client[prop as keyof PrismaClient];
  }
});

export async function disconnectPrisma(): Promise<void> {
  await databaseService.disconnect();
}


