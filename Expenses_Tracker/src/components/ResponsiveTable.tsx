import { ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => ReactNode;
  className?: string;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  keyField: string;
  emptyMessage?: string;
  className?: string;
  groupBy?: string | ((row: any) => any); // Campo per il grouping o funzione
  groupHeader?: (value: any, row: any, groupTotal?: number, groupCount?: number) => ReactNode; // Renderer per l'header del gruppo
  calculateGroupTotal?: (groupValue: any, groupData: any[]) => number; // Funzione per calcolare il totale del gruppo
  formatCurrency?: (amount: number, currency: string) => string; // Funzione per formattare la valuta
  selectedCurrency?: string; // Valuta selezionata per il formato
}

export function ResponsiveTable({
  columns,
  data,
  keyField,
  emptyMessage = "No data available",
  className = "",
  groupBy,
  groupHeader,
  calculateGroupTotal,
  formatCurrency,
  selectedCurrency
}: ResponsiveTableProps) {
  if (data.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  // Funzione per raggruppare i dati se groupBy è specificato
  const renderRows = () => {
    if (!groupBy) {
      return data.map((row) => (
        <tr key={row[keyField]} className="hover:bg-gray-50 dark:hover:bg-gray-700">
          {columns.map((column) => (
            <td
              key={column.key}
              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white ${column.className || ''}`}
            >
              {column.render ? column.render(row[column.key], row) : row[column.key]}
            </td>
          ))}
        </tr>
      ));
    }

    // Raggruppa i dati per il campo specificato
    const rows: ReactNode[] = [];
    let currentGroup: any = null;
    let currentGroupData: any[] = [];

    // Prima passata: raggruppa tutti i dati per calcolare i totali
    const groupTotals = new Map<string, number>();
    const groupCounts = new Map<string, number>();
    
    data.forEach((row) => {
      const groupValue = typeof groupBy === 'function' ? groupBy(row) : row[groupBy];
      const key = groupValue || 'Senza categoria';
      
      if (!groupCounts.has(key)) {
        groupCounts.set(key, 0);
        groupTotals.set(key, 0);
      }
      
      groupCounts.set(key, groupCounts.get(key)! + 1);
      
      if (calculateGroupTotal) {
        // Per il calcolo del totale, creiamo un array temporaneo con solo questa riga
        const tempData = [row];
        const groupTotal = calculateGroupTotal(groupValue, tempData);
        groupTotals.set(key, groupTotals.get(key)! + groupTotal);
      }
    });

    data.forEach((row, index) => {
      const groupValue = typeof groupBy === 'function' ? groupBy(row) : row[groupBy];
      
      // Se il gruppo cambia, aggiungi un header con totale del gruppo precedente
      if (currentGroup !== groupValue) {
        // Aggiungi totale del gruppo precedente se esiste
        if (currentGroup && currentGroupData.length > 0 && calculateGroupTotal && formatCurrency && selectedCurrency) {
          const groupTotal = calculateGroupTotal(currentGroup, currentGroupData);
          rows.push(
            <tr key={`group-total-${currentGroup}-${index}`} className="bg-green-50 dark:bg-green-900/20">
              <td colSpan={columns.length} className="px-6 py-2 text-right">
                <div className="text-sm font-semibold text-green-800 dark:text-green-200">
                  Totale {currentGroup}: {formatCurrency(groupTotal, selectedCurrency)}
                </div>
              </td>
            </tr>
          );
        }
        
        currentGroup = groupValue;
        currentGroupData = [];
        
        // Aggiungi header del gruppo con totale
        const groupKey = groupValue || 'Senza categoria';
        const groupTotal = groupTotals.get(groupKey) || 0;
        const groupCount = groupCounts.get(groupKey) || 0;
        
        rows.push(
          <tr key={`group-${groupValue}-${index}`} className="bg-blue-50 dark:bg-blue-900/20">
            <td colSpan={columns.length} className="px-6 py-3">
              {groupHeader ? groupHeader(groupValue, row, groupTotal, groupCount) : (
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    {groupValue}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-300">
                    {groupCount} spese
                    {formatCurrency && selectedCurrency && (
                      <span className="ml-2 text-green-700 dark:text-green-300">
                        • {formatCurrency(groupTotal, selectedCurrency)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </td>
          </tr>
        );
      }

      currentGroupData.push(row);

      // Aggiungi la riga normale
      rows.push(
        <tr key={row[keyField]} className="hover:bg-gray-50 dark:hover:bg-gray-700">
          {columns.map((column) => (
            <td
              key={column.key}
              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white ${column.className || ''}`}
            >
              {column.render ? column.render(row[column.key], row) : row[column.key]}
            </td>
          ))}
        </tr>
      );
    });

    // Aggiungi totale dell'ultimo gruppo
    if (currentGroup && currentGroupData.length > 0 && calculateGroupTotal && formatCurrency && selectedCurrency) {
      const groupTotal = calculateGroupTotal(currentGroup, currentGroupData);
      rows.push(
        <tr key={`group-total-${currentGroup}-final`} className="bg-green-50 dark:bg-green-900/20">
          <td colSpan={columns.length} className="px-6 py-2 text-right">
            <div className="text-sm font-semibold text-green-800 dark:text-green-200">
              Totale {currentGroup}: {formatCurrency(groupTotal, selectedCurrency)}
            </div>
          </td>
        </tr>
      );
    }

    return rows;
  };

  // Funzione per raggruppare i dati mobile se groupBy è specificato
  const renderMobileRows = () => {
    if (!groupBy) {
      return data.map((row) => (
        <div key={row[keyField]} className="p-4 space-y-3">
          {columns.map((column) => (
            <div key={column.key} className="flex justify-between items-start">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0 mr-3">
                {column.label}:
              </span>
              <span className="text-sm text-gray-900 dark:text-white text-right min-w-0 flex-1">
                {column.render ? column.render(row[column.key], row) : row[column.key]}
              </span>
            </div>
          ))}
        </div>
      ));
    }

    // Raggruppa i dati mobile per il campo specificato
    const rows: ReactNode[] = [];
    let currentGroup: any = null;
    let currentGroupData: any[] = [];

    // Prima passata: raggruppa tutti i dati per calcolare i totali (mobile)
    const groupTotals = new Map<string, number>();
    const groupCounts = new Map<string, number>();
    
    data.forEach((row) => {
      const groupValue = typeof groupBy === 'function' ? groupBy(row) : row[groupBy];
      const key = groupValue || 'Senza categoria';
      
      if (!groupCounts.has(key)) {
        groupCounts.set(key, 0);
        groupTotals.set(key, 0);
      }
      
      groupCounts.set(key, groupCounts.get(key)! + 1);
      
      if (calculateGroupTotal) {
        // Per il calcolo del totale, creiamo un array temporaneo con solo questa riga
        const tempData = [row];
        const groupTotal = calculateGroupTotal(groupValue, tempData);
        groupTotals.set(key, groupTotals.get(key)! + groupTotal);
      }
    });

    data.forEach((row, index) => {
      const groupValue = typeof groupBy === 'function' ? groupBy(row) : row[groupBy];
      
      // Se il gruppo cambia, aggiungi un header mobile con totale del gruppo precedente
      if (currentGroup !== groupValue) {
        // Aggiungi totale del gruppo precedente se esiste
        if (currentGroup && currentGroupData.length > 0 && calculateGroupTotal && formatCurrency && selectedCurrency) {
          const groupTotal = calculateGroupTotal(currentGroup, currentGroupData);
          rows.push(
            <div key={`mobile-group-total-${currentGroup}-${index}`} className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b border-green-200 dark:border-green-700">
              <div className="text-sm font-semibold text-green-800 dark:text-green-200 text-right">
                Totale {currentGroup}: {formatCurrency(groupTotal, selectedCurrency)}
              </div>
            </div>
          );
        }
        
        currentGroup = groupValue;
        currentGroupData = [];
        
        // Aggiungi header del gruppo mobile con totale
        const groupKey = groupValue || 'Senza categoria';
        const groupTotal = groupTotals.get(groupKey) || 0;
        const groupCount = groupCounts.get(groupKey) || 0;
        
        rows.push(
          <div key={`mobile-group-${groupValue}-${index}`} className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-200 dark:border-blue-700">
            {groupHeader ? groupHeader(groupValue, row, groupTotal, groupCount) : (
              <div className="flex justify-between items-center">
                <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  {groupValue}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-300">
                  {groupCount} spese
                  {formatCurrency && selectedCurrency && (
                    <span className="ml-2 text-green-700 dark:text-green-300">
                      • {formatCurrency(groupTotal, selectedCurrency)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      currentGroupData.push(row);

      // Aggiungi la card normale
      rows.push(
        <div key={row[keyField]} className="p-4 space-y-3">
          {columns.map((column) => (
            <div key={column.key} className="flex justify-between items-start">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0 mr-3">
                {column.label}:
              </span>
              <span className="text-sm text-gray-900 dark:text-white text-right min-w-0 flex-1">
                {column.render ? column.render(row[column.key], row) : row[column.key]}
              </span>
            </div>
          ))}
        </div>
      );
    });

    // Aggiungi totale dell'ultimo gruppo mobile
    if (currentGroup && currentGroupData.length > 0 && calculateGroupTotal && formatCurrency && selectedCurrency) {
      const groupTotal = calculateGroupTotal(currentGroup, currentGroupData);
      rows.push(
        <div key={`mobile-group-total-${currentGroup}-final`} className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b border-green-200 dark:border-green-700">
          <div className="text-sm font-semibold text-green-800 dark:text-green-200 text-right">
            Totale {currentGroup}: {formatCurrency(groupTotal, selectedCurrency)}
          </div>
        </div>
      );
    }

    return rows;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {renderRows()}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
        {renderMobileRows()}
      </div>
    </div>
  );
}
