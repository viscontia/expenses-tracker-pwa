import { createFileRoute } from '@tanstack/react-router';
import { ExpenseForm } from '~/components/ExpenseForm';

export const Route = createFileRoute('/_authenticated/expenses/new/')({
  component: NewExpense,
});

function NewExpense() {
  return (
    <ExpenseForm mode="insert" />
  );
}
