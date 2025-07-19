import { createFileRoute } from '@tanstack/react-router';
import { ExpenseForm } from '~/components/ExpenseForm';

export const Route = createFileRoute('/_authenticated/expenses/edit/$id')({
  component: EditExpense,
});

function EditExpense() {
  const { id } = Route.useParams();
  
  return (
    <ExpenseForm 
      mode="update" 
      expenseId={parseInt(id)} 
    />
  );
} 