import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from 'react';
import { trpc } from "~/trpc/react";
import { useAuthStore } from '~/stores/auth';
import { ResponsiveTable } from '~/components/ResponsiveTable';
import { RateIndicator } from '~/components/RateIndicator';
import { ExpenseDetailTable } from '~/components/ExpenseDetailTable';
import { ResponsiveModal } from '~/components/ResponsiveModal';
import { Calendar, Filter, Search, Eye, Edit2, Trash2, X, FileText, Download, Globe } from 'lucide-react';
import { formatCurrency } from '~/utils/formatters';
import { usePersistedFilters } from '~/hooks/usePersistedFilters';
import { calculateTotalInCurrency, ExpenseForCalculation } from '~/utils/currencyCalculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Available currencies for summary
const CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

export const Route = createFileRoute("/_authenticated/expenses/")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const navigate = useNavigate();
  
  // Get user's default currency preference
  const defaultCurrency = useAuthStore((state) => state.user?.preferences?.defaultCurrency);
  
  const [selectedExpenses, setSelectedExpenses] = useState<any[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  
  // Get user ID for filter persistence
  const userId = useAuthStore((state) => state.user?.id?.toString());
  
  // 🎯 HOOK PERSISTENZA FILTRI - Sostituisce tutta la logica filtri precedente
  const {
    stagedFilters,
    activeFilters,
    setStagedFilters,
    applyFilters,
    resetFilters,
    getCurrentMonthRange
  } = usePersistedFilters(userId);
  
  // 🚨 STATO ERRORE per validazione date
  const [dateError, setDateError] = useState<string | null>(null);
  
  // States for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
  
  // State for summary currency selection - initialized with user's default currency
  const [summaryCurrency, setSummaryCurrency] = useState<string>(defaultCurrency || 'EUR');

  // Sync summary currency with user's default currency preference changes
  useEffect(() => {
    if (defaultCurrency) {
      setSummaryCurrency(defaultCurrency);
    }
  }, [defaultCurrency]);

  // ✅ VALIDAZIONE DATE
  const validateDateRange = useCallback((startDate: string, endDate: string): string | null => {
    if (!startDate || !endDate) return null;
    
    if (new Date(startDate) > new Date(endDate)) {
      return "La data di fine deve essere successiva alla data di inizio";
    }
    
    return null;
  }, []);

  // 🔄 HANDLER per applicare i filtri staged con validazione
  const handleApplyFilters = useCallback(() => {
    const error = validateDateRange(stagedFilters.dateRange.start, stagedFilters.dateRange.end);
    
    if (error) {
      setDateError(error);
      return;
    }
    
    setDateError(null);
    applyFilters();
  }, [stagedFilters, validateDateRange, applyFilters]);

  // 🧹 HANDLER per reset filtri al mese corrente
  const handleClearFilters = useCallback(() => {
    setDateError(null);
    resetFilters();
  }, [resetFilters]);

  // ⌨️ HANDLER per ENTER sui campi input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyFilters();
    }
  }, [handleApplyFilters]);

  // 📅 HELPER: Formatta data per input HTML
  const formatDateForInput = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // 🎯 HANDLER per aggiornamento date con validazione real-time
  const handleDateChange = useCallback((type: 'start' | 'end', value: string) => {
    setStagedFilters(prev => {
      const newDateRange = { 
        ...prev.dateRange, 
        [type]: value || '' 
      };
      
      // Valida le date in tempo reale per feedback immediato (solo se entrambe sono compilate)
      const error = newDateRange.start && newDateRange.end ? 
        validateDateRange(newDateRange.start, newDateRange.end) : null;
      setDateError(error);
      
      return {
        ...prev,
        dateRange: newDateRange
      };
    });
  }, [validateDateRange, setStagedFilters]);

  // 📊 Fetch expenses with ONLY active filters (no auto-refetch)
  const { data: expensesData, isLoading, refetch: refetchExpenses } = trpc.expenses.getExpenses.useQuery({
    categoryIds: activeFilters.selectedCategory ? [activeFilters.selectedCategory] : undefined,
    startDate: activeFilters.dateRange.start,
    endDate: activeFilters.dateRange.end,
  }, {
    // Disabilita refetch automatico sui cambiamenti di parametri
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch categories for filter
  const { data: categories } = trpc.categories.getAll.useQuery();
  
  // Fetch available currencies for display
  const { data: availableCurrencies } = trpc.currency.getAvailableCurrencies.useQuery();

  // Delete expense mutation
  const deleteExpenseMutation = trpc.expenses.deleteExpense.useMutation({
    onSuccess: () => {
      console.log('✅ Expense deleted successfully');
      setShowDeleteConfirm(false);
      setExpenseToDelete(null);
      // Refetch expenses to update the list
      void refetchExpenses();
    },
    onError: (error) => {
      console.error('❌ Error deleting expense:', error);
      alert('Errore durante la cancellazione della spesa: ' + error.message);
    }
  });

  const expenses = expensesData?.expenses || [];
  
  // 🔍 DEBUG: Log per verificare le spese caricate nell'elenco (solo per test)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Expenses List Debug - expensesCount:', expenses.length);
    console.log('🔍 Expenses List Debug - totalCalculated:', calculateTotalInCurrency(expenses as ExpenseForCalculation[], summaryCurrency));
  }

  // Function to check if any conversions are needed
  const hasConversions = (expenses: any[], targetCurrency: string): boolean => {
    return expenses.some(expense => expense.currency !== targetCurrency);
  };

  // Filter expenses by search term and sort by category and date ASC
  const filteredExpenses = expenses
    .filter(expense => 
      !activeFilters.searchTerm || 
      expense.description?.toLowerCase().includes(activeFilters.searchTerm.toLowerCase()) ||
      expense.category.name.toLowerCase().includes(activeFilters.searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Prima ordina per categoria (alfabetico)
      const categoryA = a.category?.name || '';
      const categoryB = b.category?.name || '';
      const categoryComparison = categoryA.localeCompare(categoryB, 'it');
      
      // Se le categorie sono uguali, ordina per data ASC
      if (categoryComparison === 0) {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      }
      
      return categoryComparison;
    });

  // 📊 FUNZIONI DI ESPORTAZIONE
  const exportToCSV = useCallback(() => {
    if (!filteredExpenses.length) {
      alert('Nessuna spesa da esportare');
      return;
    }

    // Intestazioni CSV
    const headers = [
      'ID',
      'Data',
      'Descrizione',
      'Importo',
      'Valuta',
      'Categoria',
      'Tasso di Cambio',
      'Importo in EUR'
    ];

    // Dati CSV
    const csvData = filteredExpenses.map(expense => {
      // Calcola l'importo in EUR con formattazione corretta
      const amountInEUR = expense.currency === 'EUR' ? 
        expense.amount : 
        (expense.amount / (expense.conversionRate || 1));
      
      // Controllo di sicurezza per evitare valori anomali
      if (amountInEUR > 1000000) {
        console.warn(`⚠️ Valore EUR anomalo per spesa ${expense.id}: ${amountInEUR}`);
      }
      
      return [
        expense.id,
        new Date(expense.date).toLocaleDateString('it-IT'),
        expense.description || '',
        calculateTotalInCurrency([expense as ExpenseForCalculation], summaryCurrency),
        summaryCurrency,
        expense.category?.name || '',
        expense.conversionRate || 1,
        // Formatta il numero con 2 decimali e mantieni il punto come separatore decimale per CSV
        amountInEUR.toFixed(2)
      ];
    });

    // Crea contenuto CSV
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Genera nome file con timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `spese_${timestamp}.csv`;

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredExpenses]);

  const exportToPDF = useCallback(() => {
    if (!filteredExpenses.length) {
      alert('Nessuna spesa da esportare');
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Titolo
      doc.setFontSize(18);
      doc.text('Elenco Spese', 14, 22);
      
      // Informazioni sui filtri
      doc.setFontSize(10);
      let yPosition = 35;
      
      if (activeFilters.searchTerm) {
        doc.text(`Ricerca: "${activeFilters.searchTerm}"`, 14, yPosition);
        yPosition += 7;
      }
      
      if (activeFilters.selectedCategory) {
        const categoryName = categories?.find(c => c.id === activeFilters.selectedCategory)?.name;
        doc.text(`Categoria: ${categoryName}`, 14, yPosition);
        yPosition += 7;
      }
      
      if (activeFilters.dateRange.start || activeFilters.dateRange.end) {
        const dateRange = `${activeFilters.dateRange.start ? new Date(activeFilters.dateRange.start).toLocaleDateString('it-IT') : ''} - ${activeFilters.dateRange.end ? new Date(activeFilters.dateRange.end).toLocaleDateString('it-IT') : ''}`;
        doc.text(`Periodo: ${dateRange}`, 14, yPosition);
        yPosition += 7;
      }
      
              // Riepilogo
        const totalAmount = calculateTotalInCurrency(filteredExpenses as ExpenseForCalculation[], summaryCurrency);
        doc.text(`Totale: ${formatCurrency(totalAmount, summaryCurrency)} (${filteredExpenses.length} spese)`, 14, yPosition);
        yPosition += 15;
        
        // Raggruppa le spese per categoria
        const groupedExpenses = new Map<string, any[]>();
        filteredExpenses.forEach(expense => {
          const categoryName = expense.category?.name || 'Senza categoria';
          if (!groupedExpenses.has(categoryName)) {
            groupedExpenses.set(categoryName, []);
          }
          groupedExpenses.get(categoryName)!.push(expense);
        });

        // Crea dati tabella con rotture di controllo e gestione salti pagina
        const tableData: any[] = [];
        let currentY = yPosition;
        const pageHeight = doc.internal.pageSize.height;
        const rowHeight = 12; // Altezza stimata per riga
        const minSpaceForGroup = 8 * rowHeight; // Spazio minimo per un gruppo completo
        
        groupedExpenses.forEach((categoryExpenses, categoryName) => {
          // Calcola totale per categoria
          const categoryTotal = calculateTotalInCurrency(categoryExpenses as ExpenseForCalculation[], summaryCurrency);
          
          // Calcola spazio necessario per questo gruppo
          const groupRows = 1 + categoryExpenses.length + 2; // header + spese + totale + riga vuota
          const spaceNeeded = groupRows * rowHeight;
          
          // Se non c'è spazio sufficiente, aggiungi un salto pagina
          if (currentY + spaceNeeded > pageHeight - 50) {
            tableData.push([
              {
                content: '',
                colSpan: 5,
                styles: {
                  fillColor: [255, 255, 255],
                  textColor: 0,
                  fontSize: 1
                }
              }
            ]);
            // Forza salto pagina
            currentY = 20;
          }
          
          // Aggiungi header categoria
          tableData.push([
            {
              content: `${categoryName} (${categoryExpenses.length} spese • ${formatCurrency(categoryTotal, summaryCurrency)})`,
              colSpan: 5,
              styles: {
                fillColor: [59, 130, 246], // Blu
                textColor: 255, // Bianco
                fontStyle: 'bold',
                fontSize: 10
              }
            }
          ]);
          currentY += rowHeight;
          
          // Aggiungi spese della categoria
          categoryExpenses.forEach(expense => {
            tableData.push([
              new Date(expense.date).toLocaleDateString('it-IT'),
              expense.description || '',
              `${formatCurrency(calculateTotalInCurrency([expense as ExpenseForCalculation], summaryCurrency), summaryCurrency)}`,
              expense.category?.name || '',
              expense.conversionRate ? `${expense.conversionRate}` : '1'
            ]);
            currentY += rowHeight;
          });
          
          // Aggiungi totale categoria
          tableData.push([
            {
              content: `Totale ${categoryName}: ${formatCurrency(categoryTotal, summaryCurrency)}`,
              colSpan: 5,
              styles: {
                fillColor: [34, 197, 94], // Verde
                textColor: 255, // Bianco
                fontStyle: 'bold',
                fontSize: 9
              }
            }
          ]);
          currentY += rowHeight;
          
          // Aggiungi riga vuota dopo il totale categoria per leggibilità
          tableData.push([
            {
              content: '',
              colSpan: 5,
              styles: {
                fillColor: [255, 255, 255], // Bianco
                textColor: 0,
                fontSize: 4
              }
            }
          ]);
          currentY += rowHeight;
        });
        
        // Aggiungi riga del totale generale alla fine
        tableData.push([
          {
            content: `TOTALE GENERALE: ${formatCurrency(totalAmount, summaryCurrency)}`,
            colSpan: 5,
            styles: {
              fillColor: [239, 68, 68], // Rosso
              textColor: 255, // Bianco
              fontStyle: 'bold',
              fontSize: 10
            }
          }
        ]);
      
              autoTable(doc, {
          head: [['Data', 'Descrizione', 'Importo', 'Categoria', 'Tasso']],
          body: tableData,
          startY: yPosition,
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          // Gestione salti pagina per evitare testate orfane
          didParseCell: function(data) {
            // Gestisci righe con colSpan (header categoria e totali)
            if (data.cell.colSpan && data.cell.colSpan > 1) {
              // Applica stili personalizzati per header categoria e totali
              if (data.cell.styles.fillColor) {
                data.cell.styles.fillColor = data.cell.styles.fillColor;
              }
              if (data.cell.styles.textColor) {
                data.cell.styles.textColor = data.cell.styles.textColor;
              }
              if (data.cell.styles.fontStyle) {
                data.cell.styles.fontStyle = data.cell.styles.fontStyle;
              }
              if (data.cell.styles.fontSize) {
                data.cell.styles.fontSize = data.cell.styles.fontSize;
              }
            }
          },
          // Gestione salti pagina intelligenti
          pageBreak: 'auto',
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          // Forza salto pagina se necessario
          didDrawPage: function(data) {
            // Aggiungi margine extra per evitare testate orfane
            if (data.cursor && data.cursor.y) {
              data.cursor.y = Math.max(data.cursor.y, 30);
            }
          }
        });
      
      // Genera nome file con timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `spese_${timestamp}.pdf`;
      
      // Download file
      doc.save(fileName);
    } catch (error) {
      console.error('Errore durante l\'esportazione PDF:', error);
      alert('Errore durante l\'esportazione PDF. Verifica che jsPDF sia installato correttamente.');
    }
  }, [filteredExpenses, activeFilters, categories, summaryCurrency]);

  const handleViewDetails = (categoryName: string, categoryExpenses: any[]) => {
    setSelectedExpenses(categoryExpenses);
    setDetailTitle(`Spese - ${categoryName}`);
    setShowDetailModal(true);
  };

  const handleDeleteExpense = (expense: any) => {
    setExpenseToDelete(expense);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteExpense = () => {
    if (expenseToDelete) {
      deleteExpenseMutation.mutate({ id: expenseToDelete.id });
    }
  };

  const handleEditExpense = (expense: any) => {
    console.log('🔄 Edit expense:', expense);
    // Navigate to edit route - mantiene i filtri grazie al localStorage
    navigate({ to: `/expenses/edit/${expense.id}` });
  };

  const columns = [
    {
      key: 'date',
      label: 'Data',
      render: (value: string) => new Date(value).toLocaleDateString('it-IT'),
    },
    {
      key: 'description',
      label: 'Descrizione',
      render: (value: string) => value || 'N/A',
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (value: any) => value?.name || 'N/A',
    },
    {
      key: 'amount',
      label: 'Importo',
      render: (value: number, row: any) => {
        // Calcola l'importo convertito nella valuta selezionata
        const convertedAmount = calculateTotalInCurrency([row as ExpenseForCalculation], summaryCurrency);
        return formatCurrency(convertedAmount, summaryCurrency);
      },
    },
    {
      key: 'conversionRate',
      label: 'Tasso di Cambio',
      render: (value: number, row: any) => (
        <RateIndicator
          source="historical"
          rate={value}
          fromCurrency={row.currency}
          toCurrency="EUR"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Azioni',
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewDetails(row.category.name, [row])}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="Visualizza dettagli"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleEditExpense(row)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
            title="Modifica spesa"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteExpense(row)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            title="Elimina spesa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tutte le Spese</h1>
        
        {/* Controllo valuta */}
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-400">Valuta</span>
          <select
            value={summaryCurrency}
            onChange={(e) => setSummaryCurrency(e.target.value)}
            className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableCurrencies?.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          <Filter className="h-5 w-5 inline mr-2" />
          Filtri
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Search className="h-4 w-4 inline mr-1" />
              Cerca
            </label>
                          <input
                type="text"
                value={stagedFilters.searchTerm}
                onChange={(e) => setStagedFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="Descrizione o categoria..."
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categoria
            </label>
            <select
              value={stagedFilters.selectedCategory || ''}
              onChange={(e) => setStagedFilters(prev => ({ ...prev, selectedCategory: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutte le categorie</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Periodo
            </label>
            
            {/* 🎯 SHORTCUTS DATE RAPIDI */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  const currentMonth = getCurrentMonthRange();
                  setStagedFilters(prev => ({
                    ...prev,
                    dateRange: currentMonth
                  }));
                  setDateError(null);
                }}
                className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Mese corrente
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                  setStagedFilters(prev => ({
                    ...prev,
                    dateRange: {
                      start: formatDateForInput(lastMonth),
                      end: formatDateForInput(endLastMonth)
                    }
                  }));
                  setDateError(null);
                }}
                className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Mese scorso
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const startOfYear = new Date(now.getFullYear(), 0, 1);
                  setStagedFilters(prev => ({
                    ...prev,
                    dateRange: {
                      start: formatDateForInput(startOfYear),
                      end: formatDateForInput(now)
                    }
                  }));
                  setDateError(null);
                }}
                className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                Anno corrente
              </button>
            </div>
            
            <div className="flex space-x-2">
              <input
                type="date"
                value={stagedFilters.dateRange.start || ''}
                onChange={(e) => handleDateChange('start', e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Data inizio"
              />
              <input
                type="date"
                value={stagedFilters.dateRange.end || ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Data fine"
              />
            </div>
            {dateError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{dateError}</p>
            )}
          </div>

          {/* 🎯 PULSANTI CONTROLLO FILTRI */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleApplyFilters}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              disabled={isLoading}
            >
              <Search className="h-4 w-4" />
              {isLoading ? 'Ricerca...' : 'Applica Filtri'}
            </button>
            
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Reset
            </button>
          </div>

          {/* 📊 PULSANTI ESPORTAZIONE */}
          {filteredExpenses.length > 0 && (
            <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400 self-center">Esporta:</span>
              
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                title="Esporta in formato CSV"
              >
                <FileText className="h-4 w-4" />
                CSV
              </button>
              
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                title="Esporta in formato PDF"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
            </div>
          )}
        </div>

        {/* 📊 FILTRI ATTIVI - Indicatori visivi */}
        {(activeFilters.searchTerm || activeFilters.selectedCategory || activeFilters.dateRange.start || activeFilters.dateRange.end) && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Filtri attivi:</span>
            
            {activeFilters.searchTerm && (
              <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
                <Search className="h-3 w-3" />
                "{activeFilters.searchTerm}"
              </span>
            )}
            
            {activeFilters.selectedCategory && (
              <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-1 rounded-full">
                <Filter className="h-3 w-3" />
                {categories?.find(c => c.id === activeFilters.selectedCategory)?.name}
              </span>
            )}
            
            {(activeFilters.dateRange.start || activeFilters.dateRange.end) && (
              <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs px-2 py-1 rounded-full">
                <Calendar className="h-3 w-3" />
                {activeFilters.dateRange.start && new Date(activeFilters.dateRange.start).toLocaleDateString('it-IT')}
                {activeFilters.dateRange.start && activeFilters.dateRange.end && ' - '}
                {activeFilters.dateRange.end && new Date(activeFilters.dateRange.end).toLocaleDateString('it-IT')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <ResponsiveTable
        columns={columns}
        data={filteredExpenses}
        keyField="id"
        emptyMessage="Nessuna spesa trovata"
        groupBy={(row) => row.category?.name || 'Senza categoria'}
        groupHeader={(categoryName, expense, groupTotal, groupCount) => (
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              📂 {categoryName}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-300">
              {groupCount} spese
              {groupTotal !== undefined && (
                <span className="ml-2 text-green-700 dark:text-green-300">
                  • {formatCurrency(groupTotal, summaryCurrency)}
                </span>
              )}
            </div>
          </div>
        )}
        calculateGroupTotal={(categoryName, groupData) => {
          return calculateTotalInCurrency(groupData as ExpenseForCalculation[], summaryCurrency);
        }}
        formatCurrency={formatCurrency}
        selectedCurrency={summaryCurrency}
      />

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Riepilogo
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Totale Spese</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {filteredExpenses.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Importo Totale ({summaryCurrency})
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(calculateTotalInCurrency(filteredExpenses as ExpenseForCalculation[], summaryCurrency), summaryCurrency)}
            </p>
            {hasConversions(filteredExpenses, summaryCurrency) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚠️ Conversioni approssimate - basate sui tassi storici
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Categorie Coinvolte</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {new Set(filteredExpenses.map(e => e.category.id)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <ResponsiveModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={detailTitle}
      >
        <ExpenseDetailTable
          title={detailTitle}
          data={selectedExpenses}
          onClose={() => setShowDetailModal(false)}
        />
      </ResponsiveModal>

      {/* Delete Confirmation Modal */}
      <ResponsiveModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Conferma Cancellazione"
      >
        <div className="space-y-4">
          <p className="text-gray-900 dark:text-white">
            Sei sicuro di voler eliminare questa spesa?
          </p>
          {expenseToDelete && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Descrizione:</span> {expenseToDelete.description || 'N/A'}</p>
                <p><span className="font-medium">Importo:</span> {expenseToDelete.amount} {expenseToDelete.currency}</p>
                <p><span className="font-medium">Data:</span> {new Date(expenseToDelete.date).toLocaleDateString('it-IT')}</p>
                <p><span className="font-medium">Categoria:</span> {expenseToDelete.category?.name}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-red-600 dark:text-red-400">
            ⚠️ Questa azione non può essere annullata.
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Annulla
            </button>
            <button
              onClick={confirmDeleteExpense}
              disabled={deleteExpenseMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteExpenseMutation.isPending ? 'Eliminando...' : 'Elimina'}
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
