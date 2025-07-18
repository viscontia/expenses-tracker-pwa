import { db } from "~/server/db";

// Using a free exchange rate API
const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest';

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
}

export const fetchExchangeRate = async (
  fromCurrency: string,
  toCurrency: string,
): Promise<number> => {
  try {
    // Check if we have a recent rate (within last hour)
    const recentRate = await db.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        date: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (recentRate) {
      return recentRate.rate;
    }

    // Fetch from external API
    const response = await fetch(`${EXCHANGE_API_URL}/${fromCurrency}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
    }

    const data = await response.json();
    const rate = data.rates[toCurrency];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }

    // Store in database
    await db.exchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rate,
        date: new Date(),
      },
    });

    return rate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    
    // Fallback to last known rate
    const lastKnownRate = await db.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (lastKnownRate) {
      return lastKnownRate.rate;
    }

    // Ultimate fallback rates (approximate)
    const fallbackRates: Record<string, Record<string, number>> = {
      ZAR: { EUR: 0.05 },
      EUR: { ZAR: 20.0 },
    };

    return fallbackRates[fromCurrency]?.[toCurrency] || 1;
  }
};

export const convertAmount = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<{ convertedAmount: number; rate: number }> => {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, rate: 1 };
  }

  const rate = await fetchExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = amount * rate;

  return { convertedAmount, rate };
};

/**
 * Fetch all exchange rates for a specific date
 * Used for historical rate operations and migration
 */
export const fetchRatesForDate = async (
  baseCurrency: string,
  targetDate: Date,
  supportedCurrencies: string[] = ['EUR', 'ZAR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
): Promise<Record<string, number>> => {
  try {
    console.log(`Fetching rates for ${baseCurrency} on ${targetDate.toISOString()}`);
    
    // First, try to find rates from our database for the exact date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingRates = await db.exchangeRate.findMany({
      where: {
        fromCurrency: baseCurrency,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const rates: Record<string, number> = {};
    
    // Use existing rates if available
    for (const rate of existingRates) {
      rates[rate.toCurrency] = rate.rate;
    }

    // Fetch missing rates from API (this will get current rates, but it's the best we can do)
    const missingCurrencies = supportedCurrencies.filter(
      currency => currency !== baseCurrency && !rates[currency]
    );

    if (missingCurrencies.length > 0) {
      console.log(`Fetching current rates for missing currencies: ${missingCurrencies.join(', ')}`);
      
      for (const toCurrency of missingCurrencies) {
        try {
          const rate = await fetchExchangeRate(baseCurrency, toCurrency);
          rates[toCurrency] = rate;
        } catch (error) {
          console.warn(`Failed to fetch rate for ${baseCurrency} to ${toCurrency}:`, error);
        }
      }
    }

    console.log(`Retrieved ${Object.keys(rates).length} rates for ${baseCurrency}`);
    return rates;
  } catch (error) {
    console.error(`Error fetching rates for date ${targetDate.toISOString()}:`, error);
    throw new Error(`Failed to fetch rates for ${baseCurrency} on ${targetDate.toISOString()}`);
  }
};

/**
 * Find the closest historical rate to a given date
 * Used for migration when exact date rates are not available
 */
export const findClosestHistoricalRate = async (
  fromCurrency: string,
  toCurrency: string,
  targetDate: Date,
  maxDaysDifference: number = 7
): Promise<{ rate: number; date: Date; daysDifference: number } | null> => {
  try {
    if (fromCurrency === toCurrency) {
      return { rate: 1, date: targetDate, daysDifference: 0 };
    }

    console.log(`Finding closest historical rate for ${fromCurrency} to ${toCurrency} near ${targetDate.toISOString()}`);

    // Calculate date range
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - maxDaysDifference);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + maxDaysDifference);

    // Find all rates within the range
    const rates = await db.exchangeRate.findMany({
      where: {
        fromCurrency,
        toCurrency,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (rates.length === 0) {
      console.log(`No historical rates found for ${fromCurrency} to ${toCurrency} within ${maxDaysDifference} days of ${targetDate.toISOString()}`);
      return null;
    }

    // Find the rate with the smallest time difference
    let closestRate = rates[0];
    let smallestDifference = Math.abs(targetDate.getTime() - closestRate.date.getTime());

    for (const rate of rates) {
      const difference = Math.abs(targetDate.getTime() - rate.date.getTime());
      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestRate = rate;
      }
    }

    const daysDifference = Math.round(smallestDifference / (1000 * 60 * 60 * 24));
    
    console.log(`Found closest rate: ${closestRate.rate} from ${closestRate.date.toISOString()} (${daysDifference} days difference)`);
    
    return {
      rate: closestRate.rate,
      date: closestRate.date,
      daysDifference,
    };
  } catch (error) {
    console.error(`Error finding closest historical rate:`, error);
    throw new Error(`Failed to find closest historical rate for ${fromCurrency} to ${toCurrency}`);
  }
};

/**
 * Enhanced conversion function that supports historical rates
 * Extends the existing convertAmount function with historical rate support
 */
export const convertAmountWithHistory = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  expenseId?: number,
  fallbackToClosest: boolean = true
): Promise<{ 
  convertedAmount: number; 
  rate: number; 
  source: 'historical' | 'current' | 'closest' | 'fallback';
  sourceDate?: Date;
  daysDifference?: number;
}> => {
  if (fromCurrency === toCurrency) {
    return { 
      convertedAmount: amount, 
      rate: 1, 
      source: 'current' 
    };
  }

  // Try historical rate first if expenseId is provided
  if (expenseId) {
    try {
      const historicalRate = await db.expenseExchangeRate.findUnique({
        where: {
          expenseId_fromCurrency_toCurrency: {
            expenseId,
            fromCurrency,
            toCurrency,
          },
        },
      });

      if (historicalRate) {
        const rate = Number(historicalRate.rate);
        return {
          convertedAmount: amount * rate,
          rate,
          source: 'historical',
          sourceDate: historicalRate.createdAt,
        };
      }
    } catch (error) {
      console.warn(`Failed to retrieve historical rate for expense ${expenseId}:`, error);
    }

    // If historical rate not found and fallback is enabled, try to find closest rate
    if (fallbackToClosest) {
      try {
        const expense = await db.expense.findUnique({
          where: { id: expenseId },
          select: { date: true },
        });

        if (expense) {
          const closestRate = await findClosestHistoricalRate(fromCurrency, toCurrency, expense.date);
          if (closestRate) {
            return {
              convertedAmount: amount * closestRate.rate,
              rate: closestRate.rate,
              source: 'closest',
              sourceDate: closestRate.date,
              daysDifference: closestRate.daysDifference,
            };
          }
        }
      } catch (error) {
        console.warn(`Failed to find closest historical rate for expense ${expenseId}:`, error);
      }
    }
  }

  // Fallback to current rate
  try {
    const rate = await fetchExchangeRate(fromCurrency, toCurrency);
    return {
      convertedAmount: amount * rate,
      rate,
      source: 'current',
    };
  } catch (error) {
    console.error(`Failed to get current rate, using fallback:`, error);
    
    // Ultimate fallback rates
    const fallbackRates: Record<string, Record<string, number>> = {
      ZAR: { EUR: 0.05 },
      EUR: { ZAR: 20.0 },
    };

    const fallbackRate = fallbackRates[fromCurrency]?.[toCurrency] || 1;
    return {
      convertedAmount: amount * fallbackRate,
      rate: fallbackRate,
      source: 'fallback',
    };
  }
};
