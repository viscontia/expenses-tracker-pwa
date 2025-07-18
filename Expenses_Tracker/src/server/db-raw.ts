import { Pool, PoolClient } from 'pg';

// Configurazione del pool di connessioni PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Massimo 1 connessione per evitare conflitti
  idleTimeoutMillis: 1000, // Disconnetti dopo 1 secondo di inattività
  connectionTimeoutMillis: 5000, // Timeout di connessione
});

// Wrapper per eseguire query raw con gestione automatica delle connessioni
export async function queryRaw<T = any>(text: string, params: any[] = []): Promise<T[]> {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Raw query error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Funzioni specifiche per l'autenticazione che bypassano Prisma
export class RawAuthDB {
  static async findUserByEmail(email: string) {
    const query = 'SELECT id, email, password, role, preferences, "createdAt" FROM users WHERE email = $1 LIMIT 1';
    const result = await queryRaw(query, [email]);
    return result[0] || null;
  }

  static async findUserById(id: number) {
    const query = 'SELECT id, email, role, preferences, "createdAt" FROM users WHERE id = $1 LIMIT 1';
    const result = await queryRaw(query, [id]);
    return result[0] || null;
  }

  static async createUser(email: string, hashedPassword: string) {
    const query = `
      INSERT INTO users (email, password, role, "createdAt") 
      VALUES ($1, $2, 'user', NOW()) 
      RETURNING id, email, role, preferences, "createdAt"
    `;
    const result = await queryRaw(query, [email, hashedPassword]);
    return result[0];
  }

  static async updateUserPreferences(userId: number, preferences: object) {
    const query = 'UPDATE users SET preferences = $1 WHERE id = $2';
    await queryRaw(query, [JSON.stringify(preferences), userId]);
    return { success: true };
  }

  static async checkUserExists(email: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE email = $1 LIMIT 1';
    const result = await queryRaw(query, [email]);
    return result.length > 0;
  }
}

export class RawCurrencyDB {
  /**
   * Ottiene l'ultima data di aggiornamento delle valute
   */
  static async getLastExchangeRateUpdate(): Promise<{ date: string } | null> {
    const query = `
      SELECT date 
      FROM "ExchangeRate" 
      ORDER BY date DESC 
      LIMIT 1
    `;
    const result = await queryRaw<{ date: string }>(query, []);
    return result[0] || null;
  }

  /**
   * Ottiene tutte le valute disponibili
   */
  static async getAvailableCurrencies(): Promise<Array<{ fromCurrency: string; toCurrency: string }>> {
    const query = `
      SELECT DISTINCT "fromCurrency", "toCurrency"
      FROM "ExchangeRate"
      ORDER BY "fromCurrency", "toCurrency"
    `;
    return await queryRaw<{ fromCurrency: string; toCurrency: string }>(query, []);
  }

  /**
   * Verifica se esistono tassi per una data specifica
   */
  static async checkExistingRatesForDate(date: Date): Promise<boolean> {
    const query = `
      SELECT 1 
      FROM "ExchangeRate" 
      WHERE date >= $1 AND date < $2
      LIMIT 1
    `;
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const result = await queryRaw(query, [date.toISOString(), nextDay.toISOString()]);
    return result.length > 0;
  }

  /**
   * Inserisce o aggiorna un tasso di cambio
   */
  static async upsertExchangeRate(fromCurrency: string, toCurrency: string, rate: number, date: Date): Promise<void> {
    const query = `
      INSERT INTO "ExchangeRate" ("fromCurrency", "toCurrency", rate, date) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("fromCurrency", "toCurrency", date) 
      DO UPDATE SET rate = EXCLUDED.rate
    `;
    await queryRaw(query, [fromCurrency, toCurrency, rate, date.toISOString()]);
  }
}

// Cleanup graceful
export async function closePool() {
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

// Funzioni specifiche per la gestione delle expenses che bypassano Prisma
export class RawExpensesDB {
  static async getExpensesWithCategories(
    userId: number,
    categoryIds?: number[],
    startDate?: Date,
    endDate?: Date,
    limit: number = 50,
    offset: number = 0
  ) {
    let whereConditions = ['e."userId" = $1'];
    let params: any[] = [userId];
    let paramIndex = 2;

    if (categoryIds && categoryIds.length > 0) {
      whereConditions.push(`e."categoryId" = ANY($${paramIndex})`);
      params.push(categoryIds);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`e.date >= $${paramIndex}`);
      params.push(startDate.toISOString());
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`e.date <= $${paramIndex}`);
      params.push(endDate.toISOString());
      paramIndex++;
    }

    const query = `
      SELECT 
        e.id,
        e.amount,
        e.currency,
        e.date,
        e.description,
        e."userId",
        e."categoryId",
        e."conversionRate",
        c.id as "category_id",
        c.name as "category_name",
        c.description as "category_description",
        c.icon as "category_icon"
      FROM expenses e
      JOIN categories c ON e."categoryId" = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY e.date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await queryRaw(query, params);
    
    return result.map(row => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      description: row.description,
      userId: row.userId,
      categoryId: row.categoryId,
      conversionRate: row.conversionRate,
      category: {
        id: row.category_id,
        name: row.category_name,
        description: row.category_description,
        icon: row.category_icon
      }
    }));
  }

  static async countExpenses(
    userId: number,
    categoryIds?: number[],
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    let whereConditions = ['"userId" = $1'];
    let params: any[] = [userId];
    let paramIndex = 2;

    if (categoryIds && categoryIds.length > 0) {
      whereConditions.push(`"categoryId" = ANY($${paramIndex})`);
      params.push(categoryIds);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`date >= $${paramIndex}`);
      params.push(startDate.toISOString());
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`date <= $${paramIndex}`);
      params.push(endDate.toISOString());
      paramIndex++;
    }

    const query = `
      SELECT COUNT(*)::int as count
      FROM expenses
      WHERE ${whereConditions.join(' AND ')}
    `;

    const result = await queryRaw(query, params);
    return result[0]?.count || 0;
  }

  static async findCategoryById(categoryId: number, userId: number) {
    const query = `
      SELECT id, name, description, icon, "userId"
      FROM categories
      WHERE id = $1 AND "userId" = $2
    `;
    const result = await queryRaw(query, [categoryId, userId]);
    return result[0] || null;
  }

  static async createExpense(
    userId: number,
    categoryId: number,
    amount: number,
    currency: string,
    conversionRate: number,
    date: string,
    description?: string
  ) {
    const query = `
      INSERT INTO expenses ("userId", "categoryId", amount, currency, "conversionRate", date, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, amount, currency, date, description, "userId", "categoryId", "conversionRate"
    `;
    const result = await queryRaw(query, [userId, categoryId, amount, currency, conversionRate, date, description]);
    return result[0];
  }

  static async findExpenseById(expenseId: number, userId: number) {
    const query = `
      SELECT id, amount, currency, date, description, "userId", "categoryId", "conversionRate"
      FROM expenses
      WHERE id = $1 AND "userId" = $2
    `;
    const result = await queryRaw(query, [expenseId, userId]);
    return result[0] || null;
  }

  static async updateExpense(
    expenseId: number,
    userId: number,
    updates: {
      categoryId?: number,
      amount?: number,
      currency?: string,
      conversionRate?: number,
      date?: string,
      description?: string
    }
  ) {
    const fields = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (key === 'categoryId') {
          fields.push(`"categoryId" = $${paramIndex}`);
        } else if (key === 'conversionRate') {
          fields.push(`"conversionRate" = $${paramIndex}`);
        } else {
          fields.push(`${key} = $${paramIndex}`);
        }
        params.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(expenseId, userId);
    const query = `
      UPDATE expenses
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND "userId" = $${paramIndex + 1}
      RETURNING id, amount, currency, date, description, "userId", "categoryId", "conversionRate"
    `;

    const result = await queryRaw(query, params);
    return result[0] || null;
  }

  static async deleteExpense(expenseId: number, userId: number) {
    const query = `
      DELETE FROM expenses
      WHERE id = $1 AND "userId" = $2
    `;
    await queryRaw(query, [expenseId, userId]);
  }
}

// Funzioni specifiche per la gestione degli exchange rates storici che bypassano Prisma
export class RawHistoricalRatesDB {
  static async findExpenseExchangeRate(expenseId: number, fromCurrency: string, toCurrency: string) {
    const query = `
      SELECT rate, "fromCurrency", "toCurrency", date
      FROM expense_exchange_rates
      WHERE "expenseId" = $1 AND "fromCurrency" = $2 AND "toCurrency" = $3
    `;
    const result = await queryRaw(query, [expenseId, fromCurrency, toCurrency]);
    return result[0] || null;
  }

  static async createManyExpenseExchangeRates(rates: Array<{
    expenseId: number;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    date: Date;
  }>) {
    if (rates.length === 0) return;
    
    const values = rates.map((rate, index) => {
      const baseIndex = index * 5;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
    }).join(', ');
    
    const params = rates.flatMap(rate => [
      rate.expenseId,
      rate.fromCurrency,
      rate.toCurrency,
      rate.rate,
      rate.date.toISOString()
    ]);
    
    const query = `
      INSERT INTO expense_exchange_rates ("expenseId", "fromCurrency", "toCurrency", rate, date)
      VALUES ${values}
      ON CONFLICT ("expenseId", "fromCurrency", "toCurrency") DO NOTHING
    `;
    
    await queryRaw(query, params);
  }

  static async countExpenseExchangeRates(expenseId: number) {
    const query = `
      SELECT COUNT(*)::int as count
      FROM expense_exchange_rates
      WHERE "expenseId" = $1
    `;
    const result = await queryRaw(query, [expenseId]);
    return result[0]?.count || 0;
  }

  static async findExpenseById(expenseId: number) {
    const query = `
      SELECT id, amount, currency, date, description, "userId", "categoryId", "conversionRate"
      FROM expenses
      WHERE id = $1
    `;
    const result = await queryRaw(query, [expenseId]);
    return result[0] || null;
  }

  static async findAllExpensesForMigration(batchSize: number = 100, lastProcessedId: number = 0) {
    const query = `
      SELECT id, amount, currency, date, "conversionRate"
      FROM expenses
      WHERE id > $1
      ORDER BY id ASC
      LIMIT $2
    `;
    const result = await queryRaw(query, [lastProcessedId, batchSize]);
    return result;
  }

  static async countAllExpenses() {
    const query = `
      SELECT COUNT(*)::int as count
      FROM expenses
    `;
    const result = await queryRaw(query, []);
    return result[0]?.count || 0;
  }

  static async getLatestExchangeRate(fromCurrency: string, toCurrency: string) {
    const query = `
      SELECT rate, date, "fromCurrency", "toCurrency"
      FROM exchange_rates
      WHERE "fromCurrency" = $1 AND "toCurrency" = $2
      ORDER BY date DESC
      LIMIT 1
    `;
    const result = await queryRaw(query, [fromCurrency, toCurrency]);
    return result[0] || null;
  }
}

// Gestione graceful shutdown
process.on('beforeExit', closePool);
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
}); 