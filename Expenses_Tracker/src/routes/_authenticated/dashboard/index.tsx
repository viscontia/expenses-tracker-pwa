import { createFileRoute } from "@tanstack/react-router";
import { Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import { trpc } from "~/trpc/react";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = trpc.dashboard.getKpis.useQuery();
  const { data: chartData, isLoading: chartLoading } = trpc.dashboard.getChartData.useQuery();
  const { data: recentExpenses, isLoading: expensesLoading } = trpc.dashboard.getRecentExpenses.useQuery();

  if (kpisLoading || chartLoading || expensesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Calcolo month-over-month change
  const monthOverMonthChange = kpis?.totalPreviousMonth 
    ? ((kpis.totalCurrentMonth - kpis.totalPreviousMonth) / kpis.totalPreviousMonth) * 100
    : 0;

  // Calcolo media giornaliera
  const currentDate = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const averageDaily = kpis?.totalCurrentMonth ? kpis.totalCurrentMonth / daysInMonth : 0;

  // Trova la categoria top
  const topCategory = chartData?.categoryExpenses?.length > 0 
    ? chartData.categoryExpenses.reduce((prev: any, current: any) => (prev.amount > current.amount) ? prev : current)
    : null;

  const doughnutData = {
    labels: chartData?.categoryExpenses?.map((item: any) => item.name) || [],
    datasets: [
      {
        data: chartData?.categoryExpenses?.map((item: any) => item.amount) || [],
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
          "#FF9F40",
        ],
        borderWidth: 2,
      },
    ],
  };

  const lineData = {
    labels: chartData?.monthlyTrend?.map((item: any) => item.month) || [],
    datasets: [
      {
        label: "Spese Mensili",
        data: chartData?.monthlyTrend?.map((item: any) => item.amount) || [],
        borderColor: "#36A2EB",
        backgroundColor: "rgba(54, 162, 235, 0.1)",
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Spese Questo Mese</h3>
          <p className="text-2xl font-bold text-gray-900">€{kpis?.totalCurrentMonth?.toFixed(2) || '0.00'}</p>
          <p className={`text-sm ${monthOverMonthChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {monthOverMonthChange >= 0 ? '+' : ''}{monthOverMonthChange.toFixed(1)}% dal mese scorso
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Transazioni</h3>
          <p className="text-2xl font-bold text-gray-900">{kpis?.transactionCount || 0}</p>
          <p className="text-sm text-gray-600">Questo mese</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Media Giornaliera</h3>
          <p className="text-2xl font-bold text-gray-900">€{averageDaily.toFixed(2)}</p>
          <p className="text-sm text-gray-600">Basata su questo mese</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Categoria Top</h3>
          <p className="text-2xl font-bold text-gray-900">{topCategory?.name || 'N/A'}</p>
          <p className="text-sm text-gray-600">€{topCategory?.amount?.toFixed(2) || '0.00'}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Spese per Categoria</h3>
          <div className="h-64">
            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Trend Mensile</h3>
          <div className="h-64">
            <Line data={lineData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Spese Recenti</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrizione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importo
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentExpenses?.map((expense: any) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(expense.date).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.description || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.category?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{expense.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
