export const BASE_CURRENCIES = ['ZAR', 'EUR'];
export const TARGET_CURRENCIES = ['USD', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN'];
export const ALL_CURRENCIES = [...BASE_CURRENCIES, ...TARGET_CURRENCIES];

export const CURRENCY_NAMES: { [key: string]: string } = {
  ZAR: 'South African Rand (ZAR)',
  EUR: 'Euro (EUR)',
  USD: 'US Dollar (USD)',
  JPY: 'Japanese Yen (JPY)',
  GBP: 'British Pound (GBP)',
  AUD: 'Australian Dollar (AUD)',
  CAD: 'Canadian Dollar (CAD)',
  CHF: 'Swiss Franc (CHF)',
  CNY: 'Chinese Yuan (CNY)',
  SEK: 'Swedish Krona (SEK)',
  NZD: 'New Zealand Dollar (NZD)',
  MXN: 'Mexican Peso (MXN)',
}; 