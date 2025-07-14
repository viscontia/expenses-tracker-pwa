import { ReactNode } from 'react';

interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  gap?: number;
  className?: string;
}

export function ResponsiveGrid({
  children,
  cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5, '2xl': 6 },
  gap = 4,
  className = ""
}: ResponsiveGridProps) {
  const getGridClasses = () => {
    const gridClasses = ['grid'];
    
    // Add column classes
    if (cols.xs) gridClasses.push(`grid-cols-${cols.xs}`);
    if (cols.sm) gridClasses.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) gridClasses.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) gridClasses.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) gridClasses.push(`xl:grid-cols-${cols.xl}`);
    if (cols['2xl']) gridClasses.push(`2xl:grid-cols-${cols['2xl']}`);
    
    // Add gap class
    gridClasses.push(`gap-${gap}`);
    
    return gridClasses.join(' ');
  };

  return (
    <div className={`${getGridClasses()} ${className}`}>
      {children}
    </div>
  );
}
