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
  groupBy?: string; // Campo per il grouping
  groupHeader?: (value: any, row: any) => ReactNode; // Renderer per l'header del gruppo
}

export function ResponsiveTable({
  columns,
  data,
  keyField,
  emptyMessage = "No data available",
  className = "",
  groupBy,
  groupHeader
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

    data.forEach((row, index) => {
      const groupValue = row[groupBy];
      
      // Se il gruppo cambia, aggiungi un header
      if (currentGroup !== groupValue) {
        currentGroup = groupValue;
        
        // Aggiungi header del gruppo
        rows.push(
          <tr key={`group-${groupValue}-${index}`} className="bg-blue-50 dark:bg-blue-900/20">
            <td colSpan={columns.length} className="px-6 py-3">
              {groupHeader ? groupHeader(groupValue, row) : (
                <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  {groupValue}
                </div>
              )}
            </td>
          </tr>
        );
      }

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

    data.forEach((row, index) => {
      const groupValue = row[groupBy];
      
      // Se il gruppo cambia, aggiungi un header mobile
      if (currentGroup !== groupValue) {
        currentGroup = groupValue;
        
        // Aggiungi header del gruppo mobile
        rows.push(
          <div key={`mobile-group-${groupValue}-${index}`} className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-200 dark:border-blue-700">
            {groupHeader ? groupHeader(groupValue, row) : (
              <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                {groupValue}
              </div>
            )}
          </div>
        );
      }

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
