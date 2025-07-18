import { createFileRoute } from "@tanstack/react-router";
import { useState } from 'react';
import { trpc } from "~/trpc/react";
import { ResponsiveTable } from '~/components/ResponsiveTable';
import { RateIndicator } from '~/components/RateIndicator';
import { ExpenseDetailTable } from '~/components/ExpenseDetailTable';
import { ResponsiveModal } from '~/components/ResponsiveModal';
import { Calendar, Filter, Search, Eye } from 'lucide-react';

export const Route = createFileRoute("/_authenticated/expenses/")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const [selectedExpenses, setSelectedExpenses] = useState<any[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{start?: string, end?: string}>({});

  // Fetch expenses with filters
  const { data: expensesData, isLoading } = trpc.expenses.getExpenses.useQuery({
    categoryIds: selectedCategory ? [selectedCategory] : undefined,
    startDate: dateRange.start,
    endDate: dateRange.end,
    limit: 100,
  });

  // Fetch categories for filter
  const { data: categories } = trpc.categories.getAll.useQuery();

  const expenses = expensesData?.expenses || [];

  // Filter expenses by search term
  const filteredExpenses = expenses.filter(expense => 
    !searchTerm || 
    expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (categoryName: string, categoryExpenses: any[]) => {
    setSelectedExpenses(categoryExpenses);
    setDetailTitle(`Spese - ${categoryName}`);
    setShowDetailModal(true);
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
      render: (value: number, row: any) => 
        new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: row.currency,
        }).format(value),
    },
    {
      key: 'conversionRate',
      label: 'Tasso di Cambio',
      render: (value: number, row: any) => (
        <RateIndicator
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
        <button
          onClick={() => handleViewDetails(row.category.name, [row])}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <Eye className="h-4 w-4" />
        </button>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
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
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateRange.start || ''}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value || undefined }))}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={dateRange.end || ''}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value || undefined }))}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <ResponsiveTable
        columns={columns}
        data={filteredExpenses}
        keyField="id"
        emptyMessage="Nessuna spesa trovata"
      />

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Riepilogo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Totale Spese</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {filteredExpenses.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Importo Totale (EUR)</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              €{filteredExpenses.reduce((sum, expense) => sum + (expense.amount / expense.conversionRate), 0).toFixed(2)}
            </p>
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
    </div>
  );
}
