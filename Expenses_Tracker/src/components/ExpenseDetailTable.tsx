import { X } from 'lucide-react';
import type { AppRouter } from '~/server/trpc/root';
import type { inferRouterOutputs } from '@trpc/server';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type RouterOutput = inferRouterOutputs<AppRouter>;
type Expense = RouterOutput['expenses']['getExpenses']['expenses'][number];

export function ExpenseDetailTable({
  title,
  data,
  onClose,
}: {
  title: string;
  data: Expense[];
  onClose: () => void;
}) {
  const exportToPdf = () => {
    const doc = new jsPDF();
    doc.text(title, 14, 16);
    (doc as any).autoTable({
      head: [['Data', 'Descrizione', 'Categoria', 'Importo']],
      body: data.map(e => [
        new Date(e.date).toLocaleDateString('it-IT'),
        e.description,
        e.category.name,
        new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: e.currency,
        }).format(e.amount),
      ]),
      startY: 20,
    });
    doc.save(`dettaglio-spese-${title.replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={exportToPdf}
            className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
          >
            Esporta PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-200"
          >
            <span className="h-6 w-6 text-gray-600">X</span>
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-md border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Descrizione</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Categoria</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Importo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map(expense => (
              <tr key={expense.id}>
                <td className="whitespace-nowrap px-6 py-4">
                  {new Date(expense.date).toLocaleDateString('it-IT')}
                </td>
                <td className="whitespace-nowrap px-6 py-4">{expense.description}</td>
                <td className="whitespace-nowrap px-6 py-4">{expense.category.name}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  {new Intl.NumberFormat('it-IT', {
                    style: 'currency',
                    currency: expense.currency,
                  }).format(expense.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 