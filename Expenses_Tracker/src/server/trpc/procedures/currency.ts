import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { fetchExchangeRate, convertAmount } from "~/server/utils/currency";

const getExchangeRateSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
});

const convertAmountSchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
});

export const getExchangeRate = baseProcedure
  .input(getExchangeRateSchema)
  .query(async ({ input }) => {
    const rate = await fetchExchangeRate(input.fromCurrency, input.toCurrency);
    return {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      rate,
    };
  });

export const convertCurrency = baseProcedure
  .input(convertAmountSchema)
  .query(async ({ input }) => {
    const result = await convertAmount(
      input.amount,
      input.fromCurrency,
      input.toCurrency,
    );
    
    return {
      originalAmount: input.amount,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      convertedAmount: result.convertedAmount,
      rate: result.rate,
    };
  });
