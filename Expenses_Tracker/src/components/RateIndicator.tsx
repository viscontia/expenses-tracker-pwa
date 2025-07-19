/**
 * Rate Indicator Component
 * Shows whether historical or current rates are being used
 */

import React from 'react';
import { ClockIcon, TrendingUpIcon } from 'lucide-react';
import { formatNumber } from '~/utils/formatters';

interface RateIndicatorProps {
  source: 'historical' | 'current';
  rate?: number;
  fromCurrency?: string;
  toCurrency?: string;
  className?: string;
  showTooltip?: boolean;
}

export const RateIndicator: React.FC<RateIndicatorProps> = ({
  source,
  rate,
  fromCurrency,
  toCurrency,
  className = '',
  showTooltip = true
}) => {
  const isHistorical = source === 'historical';
  
  const baseClasses = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className}`;
  const colorClasses = isHistorical 
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  
  const Icon = isHistorical ? ClockIcon : TrendingUpIcon;
  const label = isHistorical ? 'Historical' : 'Current';
  
  const tooltipText = isHistorical
    ? 'Using historical exchange rate from expense date'
    : 'Using current exchange rate (historical rate not available)';

  const rateText = rate && fromCurrency && toCurrency 
            ? `${formatNumber(rate, 4)} ${fromCurrency}/${toCurrency}`
    : '';

  return (
    <div className="relative group">
      <span className={`${baseClasses} ${colorClasses}`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
        {rate && (
          <span className="ml-1 font-mono">
            {formatNumber(rate, 4)}
          </span>
        )}
      </span>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          <div className="text-center">
            <div>{tooltipText}</div>
            {rateText && (
              <div className="font-mono mt-1">{rateText}</div>
            )}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default RateIndicator;