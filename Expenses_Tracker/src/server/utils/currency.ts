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
