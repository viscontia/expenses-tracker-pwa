/**
 * Utility per formattazione numeri e valute
 * Formato italiano: 1.234,56 (punto per migliaia, virgola per decimali)
 */

/**
 * Formatta un numero con separatori delle migliaia in formato italiano
 * @param value - Il numero da formattare
 * @param decimals - Numero di decimali (default: 2)
 * @returns Stringa formattata (es: "1.234,56")
 */
export const formatNumber = (value: number | string, decimals: number = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0,00';
  
  return num.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formatta un numero come valuta con simbolo
 * @param value - Il numero da formattare  
 * @param currency - Codice valuta (EUR, USD, ZAR, etc.)
 * @param decimals - Numero di decimali (default: 2)
 * @returns Stringa formattata con simbolo (es: "€ 1.234,56")
 */
export const formatCurrency = (value: number | string, currency: string, decimals: number = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return getCurrencySymbol(currency) + ' 0,00';
  
  const formattedNumber = formatNumber(num, decimals);
  const symbol = getCurrencySymbol(currency);
  
  return `${symbol} ${formattedNumber}`;
};

/**
 * Ottiene il simbolo della valuta
 * @param currency - Codice valuta
 * @returns Simbolo valuta
 */
export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    'EUR': '€',
    'USD': '$',
    'ZAR': 'R',
    'GBP': '£',
    'JPY': '¥',
    'CHF': 'CHF',
    'CAD': 'C$',
    'AUD': 'A$',
  };
  
  return symbols[currency] || currency;
};

/**
 * Formatta un numero per input form (senza simbolo valuta)
 * @param value - Il numero da formattare
 * @returns Stringa formattata per input
 */
export const formatNumberForInput = (value: number | string): string => {
  return formatNumber(value, 2);
}; 