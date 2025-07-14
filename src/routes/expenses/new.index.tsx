import React, { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, DollarSign, Plus } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTRPC } from '~/trpc/react';
import { useAuthStore } from '~/stores/auth';
import { Layout } from '~/components/Layout';

const expenseSchema = z.object({
  categoryId: z.number().min(1, 'Please select a category'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['ZAR', 'EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR']),
  date: z.string().min(1, 'Date is required'),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export const Route = createFileRoute('/expenses/new/')({
  component: NewExpense,
});

function NewExpense() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { token, isAuthenticated } = useAuthStore();
  const [conversionRate, setConversionRate] = useState(1);

  if (!isAuthenticated || !token) {
    navigate({ to: '/login' });
    return null;
  }

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      categoryId: 0,
      amount: 0,
      currency: 'ZAR',
      date: new Date().toISOString().split('T')[0],
      description: '',
    },
  });

  const selectedCurrency = form.watch('currency');

  const categoriesQuery = useQuery(trpc.getCategories.queryOptions({ token }));

  const exchangeRateQuery = useQuery(trpc.getExchangeRate.queryOptions({
    fromCurrency: selectedCurrency,
    toCurrency: 'ZAR', // Assume base is ZAR
  }));

  const createExpenseMutation = useMutation(trpc.createExpense.mutationOptions({
    onSuccess: () => {
      toast.success('Expense added!');
      navigate({ to: '/dashboard' });
    },
  }));

  useEffect(() => {
    if (exchangeRateQuery.data) {
      setConversionRate(exchangeRateQuery.data.rate);
    }
  }, [exchangeRateQuery.data]);

  const onSubmit = (data: ExpenseForm) => {
    createExpenseMutation.mutate({
      token,
      ...data,
      conversionRate,
      date: new Date(data.date).toISOString(),
    });
  };

  return (
    <Layout>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Currency select as above */}
        {/* Amount input */}
        {/* Date picker as above */}
        {/* Category select */}
        {/* Description textarea */}
        {/* Submit button */}
      </form>
    </Layout>
  );
}