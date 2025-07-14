import { createTRPCRouter } from "~/server/trpc/main";
import { 
  getExchangeRate, 
  convertCurrency 
} from "~/server/trpc/procedures/currency";

export const currencyRouter = createTRPCRouter({
  getExchangeRate,
  convertCurrency,
}); 