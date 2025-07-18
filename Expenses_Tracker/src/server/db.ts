import { PrismaClient } from "@prisma/client";

/**
 * OPTIMIZED PRISMA CLIENT CONFIGURATION
 * 
 * Implementa un singleton pattern per ridurre la latenza di connessione
 * e ottimizza il connection pooling per Supabase
 */

// Singleton Prisma client instance
let prismaInstance: PrismaClient | null = null;

// Configuration ottimizzata per Supabase
const createOptimizedPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Ottimizzazioni per connection pooling
    transactionOptions: {
      timeout: 10000, // 10 secondi timeout per transazioni
      maxWait: 5000,  // 5 secondi wait massimo
    },
  });
};

// Funzione per ottenere il client singleton
const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    console.log('[PRISMA_OPTIMIZATION] Creating new optimized Prisma client singleton...');
    prismaInstance = createOptimizedPrismaClient();
    
    // Pre-connect per ridurre latenza del primo utilizzo
    prismaInstance.$connect().then(() => {
      console.log('[PRISMA_OPTIMIZATION] Prisma client pre-connected successfully');
    }).catch((error) => {
      console.error('[PRISMA_OPTIMIZATION] Pre-connection failed:', error);
    });
  }
  return prismaInstance;
};

// Wrapper OTTIMIZZATO che usa il singleton invece di creare nuovi client
export async function withDB<T>(operation: (db: PrismaClient) => Promise<T>): Promise<T> {
  const startTime = Date.now();
  const client = getPrismaClient();
  
  try {
    const result = await operation(client);
    const duration = Date.now() - startTime;
    
    // Log solo operazioni lente per il debugging
    if (duration > 1000) {
      console.log(`[PRISMA_OPTIMIZATION] Slow operation detected: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PRISMA_OPTIMIZATION] Operation failed after ${duration}ms:`, error);
    throw error;
  }
}

// Export del singleton client (PERFORMANCE BOOST)
export const getDB = (): PrismaClient => {
  return getPrismaClient();
};

// Export principale - usa il singleton ottimizzato
export const db = getPrismaClient();

// Funzione per il graceful shutdown del singleton
const gracefulShutdown = async () => {
  if (prismaInstance) {
    console.log('[PRISMA_OPTIMIZATION] Disconnecting Prisma client...');
    try {
      await prismaInstance.$disconnect();
      console.log('[PRISMA_OPTIMIZATION] Prisma client disconnected successfully');
    } catch (error) {
      console.error('[PRISMA_OPTIMIZATION] Error disconnecting Prisma client:', error);
    } finally {
      prismaInstance = null;
    }
  }
};

// Graceful shutdown handlers ottimizzati
process.on('beforeExit', async () => {
  console.log('[PRISMA_OPTIMIZATION] Application shutting down...');
  await gracefulShutdown();
});

process.on('SIGINT', async () => {
  console.log('[PRISMA_OPTIMIZATION] Received SIGINT, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[PRISMA_OPTIMIZATION] Received SIGTERM, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});
