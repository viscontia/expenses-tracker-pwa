import { ReactNode } from 'react';

interface ResponsiveCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function ResponsiveCard({
  children,
  title,
  subtitle,
  headerAction,
  padding = 'md',
  className = "",
  onClick,
  hoverable = false
}: ResponsiveCardProps) {
  const getPaddingClasses = () => {
    switch (padding) {
      case 'sm':
        return 'p-3 sm:p-4';
      case 'lg':
        return 'p-6 sm:p-8';
      default:
        return 'p-4 sm:p-6';
    }
  };

  const baseClasses = `
    bg-white dark:bg-gray-800 
    rounded-lg 
    shadow-sm 
    border border-gray-200 dark:border-gray-700
    transition-all duration-200
    ${hoverable ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `;

  const CardContent = () => (
    <div className={baseClasses} onClick={onClick}>
      {(title || subtitle || headerAction) && (
        <div className={`${getPaddingClasses()} border-b border-gray-200 dark:border-gray-700`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="flex-shrink-0 ml-4">
                {headerAction}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={title || subtitle || headerAction ? getPaddingClasses() : getPaddingClasses()}>
        {children}
      </div>
    </div>
  );

  return <CardContent />;
}
