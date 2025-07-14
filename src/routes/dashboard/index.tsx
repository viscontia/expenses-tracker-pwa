import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, Pie, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ResponsiveModal from '~/components/ResponsiveModal';
import { ResponsiveTable } from '~/components/ResponsiveTable';
import { useTRPC } from '~/trpc/react';

// Add states for modal, selectedCategory, selectedPeriod, sortBy, sortOrder
// Add queries for details, monthlyTrends, yearlyTrends

// Inside Dashboard function, after const data = analyticsQuery.data;
if (data) {
  const trpc = useTRPC();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{start: string; end: string} | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const detailsQuery = useQuery(trpc.getExpensesByCategoryAndPeriod.queryOptions({
    token,
    categoryId: selectedCategory!,
    startDate: selectedPeriod?.start!,
    endDate: selectedPeriod?.end!,
    sortBy,
    sortOrder,
  }), { enabled: !!selectedCategory && !!selectedPeriod });

  const monthlyTrendsQuery = useQuery(trpc.getMonthlyTrends.queryOptions({ token }));
  const yearlyTrendsQuery = useQuery(trpc.getYearlyTrends.queryOptions({ token }));

  const handleChartClick = (event: any, elements: any[], periodType: string) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const label = currentMonthData.labels[index]; // Adjust per chart
      const categoryItem = data.categories[periodType].find((i: any) => i.category?.name === label);
      if (categoryItem) {
        setSelectedCategory(categoryItem.categoryId);
        setSelectedPeriod(getPeriodDates(periodType));
        setIsModalOpen(true);
      }
    }
  };

  const currentMonthData = {
    labels: data.categories.currentMonth.map((item: any) => item.category?.name || 'Unknown'),
    datasets: [{
      data: data.categories.currentMonth.map((item: any) => item.total),
      backgroundColor: data.categories.currentMonth.map((_: any, i: number) => `hsl(${i * 360 / data.categories.currentMonth.length}, 70%, 50%)`),
    }],
  };

  // Similar for previousMonthData, currentYearData, previousYearData

  // Render in return JSX:
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h3>Current Month Expenses</h3>
      <Pie data={currentMonthData} options={{ responsive: true, onClick: (e, elements) => handleChartClick(e, elements, 'currentMonth') }} />
    </div>
    {/* Add other Pie/Bar/Line charts */}
  </div>

  <ResponsiveModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Expense Details">
    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
      <option value="date">Date</option>
      <option value="amount">Amount</option>
      <option value="description">Description</option>
    </select>
    <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}>
      <option value="desc">Descending</option>
      <option value="asc">Ascending</option>
    </select>
    <button onClick={() => exportToPDF('details-table')}>Export PDF</button>
    <div id='details-table'>
      <ResponsiveTable columns={expenseColumns} data={detailsQuery.data || []} />
    </div>
  </ResponsiveModal>
}

const expenseColumns = [
  { key: 'date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount', render: (value, row) => formatCurrency(value, row.currency) },
];

const getPeriodDates = (periodType) => {
  const now = new Date();
  switch (periodType) {
    case 'currentMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: now.toISOString() };
    // Add cases for others
  }
};