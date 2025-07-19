import { queryRaw } from './db-raw';

// Sistema di profiling per query SQL
const profileSqlQuery = async <T>(queryName: string, sqlQuery: string, queryFn: () => Promise<T>): Promise<T> => {
  const startTime = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    console.log(`[SQL_PROFILING] ${queryName}: ${duration}ms`);
    console.log(`[SQL_PROFILING] Query: ${sqlQuery.replace(/\s+/g, ' ').trim()}`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`[SQL_PROFILING] ${queryName}: FAILED after ${duration}ms - ${error}`);
    console.log(`[SQL_PROFILING] Query: ${sqlQuery.replace(/\s+/g, ' ').trim()}`);
    throw error;
  }
};

// Interfaces per i tipi di ritorno basate sullo schema Prisma
interface ExpenseRow {
  id: number;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  "userId": number;
  "categoryId": number;
}

interface CategoryRow {
  id: number;
  name: string;
}

interface ExchangeRateRow {
  rate: number;
  date: string;
}

export class RawDashboardDB {
  /**
   * Ottiene il conteggio rapido delle spese per un utente (ottimizzazione performance)
   */
  static async getUserExpenseCount(userId: number): Promise<number> {
    const query = `
      SELECT COUNT(*)::int as count
      FROM expenses
      WHERE "userId" = $1
    `;
    return await profileSqlQuery(
      'getUserExpenseCount',
      query,
      async () => {
        const result = await queryRaw<{ count: number }>(query, [userId]);
        return result[0]?.count || 0;
      }
    );
  }

  /**
   * Ottiene le spese per un utente in un periodo specifico CON i tassi storici (FK JOIN)
   * OTTIMIZZAZIONE: Una singola query invece di N+1 query separate
   */
  static async getExpensesWithHistoricalRates(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    id: number;
    amount: number;
    currency: string;
    date: string;
    description: string | null;
    userId: number;
    categoryId: number;
    historicalRates: Array<{
      fromCurrency: string;
      toCurrency: string;
      rate: number;
    }>;
  }>> {
    const query = `
      SELECT 
        e.id, 
        e.amount, 
        e.currency, 
        e.date, 
        e.description, 
        e."userId", 
        e."categoryId",
        COALESCE(
          json_agg(
            json_build_object(
              'fromCurrency', eer."fromCurrency",
              'toCurrency', eer."toCurrency", 
              'rate', eer.rate::float
            )
          ) FILTER (WHERE eer.id IS NOT NULL), 
          '[]'::json
        ) as "historicalRates"
      FROM expenses e
      LEFT JOIN expense_exchange_rates eer ON e.id = eer."expenseId"
      WHERE e."userId" = $1 AND e.date >= $2 AND e.date <= $3
      GROUP BY e.id, e.amount, e.currency, e.date, e.description, e."userId", e."categoryId"
      ORDER BY e.date DESC
    `;
    return await profileSqlQuery(
      'getExpensesWithHistoricalRates',
      query,
      async () => {
        return await queryRaw(query, [userId, startDate.toISOString(), endDate.toISOString()]);
      }
    );
  }

  /**
   * Ottiene le spese per un utente in un periodo specifico
   */
  static async getExpensesByPeriod(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ExpenseRow[]> {
    const query = `
      SELECT id, amount, currency, date, description, "userId", "categoryId"
      FROM expenses
      WHERE "userId" = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `;
    return await profileSqlQuery(
      'getExpensesByPeriod',
      query,
      async () => {
        return await queryRaw(query, [userId, startDate.toISOString(), endDate.toISOString()]);
      }
    );
  }

  /**
   * Conta le spese per un utente in un periodo specifico
   */
  static async countExpensesByPeriod(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM expenses
      WHERE "userId" = $1 AND date >= $2 AND date <= $3
    `;
    return await profileSqlQuery(
      'countExpensesByPeriod',
      query,
      async () => {
        const result = await queryRaw(query, [userId, startDate.toISOString(), endDate.toISOString()]);
        return parseInt(result[0]?.count || '0');
      }
    );
  }

  /**
   * Ottiene le spese recenti per un utente
   */
  static async getRecentExpenses(userId: number, limit?: number): Promise<ExpenseRow[]> {
    let query = `
      SELECT id, amount, currency, date, description, "userId", "categoryId"
      FROM expenses
      WHERE "userId" = $1
      ORDER BY date DESC
    `;
    
    const params: any[] = [userId];
    
    // ✅ Aggiungi LIMIT solo se specificato
    if (limit !== undefined) {
      query += ` LIMIT $2`;
      params.push(limit);
    }
    
    return await profileSqlQuery(
      'getRecentExpenses',
      query,
      async () => {
        return await queryRaw(query, params);
      }
    );
  }

  /**
   * Ottiene tutte le categorie per un utente
   */
  static async getCategoriesByUser(userId: number): Promise<CategoryRow[]> {
    const query = `
      SELECT id, name
      FROM categories
      WHERE "userId" = $1
      ORDER BY name ASC
    `;
    return await profileSqlQuery(
      'getCategoriesByUser',
      query,
      async () => {
        return await queryRaw(query, [userId]);
      }
    );
  }

  /**
   * Ottiene il tasso di cambio più recente per una coppia di valute
   */
  static async getLatestExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRateRow | null> {
    const query = `
      SELECT rate, date
      FROM exchange_rates
      WHERE "fromCurrency" = $1 AND "toCurrency" = $2
      ORDER BY date DESC
      LIMIT 1
    `;
    return await profileSqlQuery(
      'getLatestExchangeRate',
      query,
      async () => {
        const result = await queryRaw(query, [fromCurrency, toCurrency]);
        return result[0] || null;
      }
    );
  }

  /**
   * Ottiene le spese aggregate per categoria in un periodo
   */
  static async getExpensesByCategory(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ categoryId: number; categoryName: string; total: number; count: number }>> {
    const query = `
      SELECT 
        e."categoryId",
        c.name as "categoryName",
        SUM(e.amount) as total,
        COUNT(e.id) as count
      FROM expenses e
      JOIN categories c ON e."categoryId" = c.id
      WHERE e."userId" = $1 AND e.date >= $2 AND e.date <= $3
      GROUP BY e."categoryId", c.name
      ORDER BY total DESC
    `;
    return await profileSqlQuery(
      'getExpensesByCategory',
      query,
      async () => {
        return await queryRaw(query, [userId, startDate.toISOString(), endDate.toISOString()]);
      }
    );
  }

  /**
   * Ottiene le spese aggregate per mese in un periodo
   */
  static async getExpensesByMonth(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ month: string; total: number; count: number }>> {
    const query = `
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        SUM(amount) as total,
        COUNT(id) as count
      FROM expenses
      WHERE "userId" = $1 AND date >= $2 AND date <= $3
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month ASC
    `;
    return await profileSqlQuery(
      'getExpensesByMonth',
      query,
      async () => {
        return await queryRaw(query, [userId, startDate.toISOString(), endDate.toISOString()]);
      }
    );
  }
} 