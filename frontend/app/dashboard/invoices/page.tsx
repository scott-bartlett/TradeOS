'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoicesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { useRouter } from 'next/navigation';

const statusColor: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  review:  'bg-yellow-100 text-yellow-700',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

const STATUS_FILTERS = ['all', 'draft', 'review', 'sent', 'overdue', 'paid'];

export default function InvoicesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const invoices = data?.invoices || [];

  // Summary stats
  const outstanding = invoices
    .filter((i: any) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum: number, i: any) => sum + (i.balance_due || i.total_amount || 0), 0);
  const overdue = invoices.filter((i: any) => i.status === 'overdue').length;
  const paidThisMonth = invoices
    .filter((i: any) => {
      if (i.status !== 'paid' || !i.paid_at) return false;
      const paid = new Date(i.paid_at);
      const now = new Date();
      return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
    })
    .reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);
  const awaitingReview = invoices.filter((i: any) => i.status === 'draft' || i.status === 'review').length;

  const filtered = filter === 'all'
    ? invoices
    : invoices.filter((i: any) => i.status === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">{invoices.length} total</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Outstanding',
            value: `$${outstanding.toLocaleString()}`,
            icon: <DollarSign size={16} className="text-blue-600" />,
            bg: 'bg-blue-50',
          },
          {
            label: 'Overdue',
            value: overdue,
            icon: <AlertCircle size={16} className="text-red-500" />,
            bg: 'bg-red-50',
          },
          {
            label: 'Awaiting Review',
            value: awaitingReview,
            icon: <Clock size={16} className="text-amber-500" />,
            bg: 'bg-amber-50',
          },
          {
            label: 'Paid This Month',
            value: `$${paidThisMonth.toLocaleString()}`,
            icon: <CheckCircle size={16} className="text-green-600" />,
            bg: 'bg-green-50',
          },
        ].map(({ label, value, icon, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                  {icon}
                </div>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
              filter === s
                ? 'text-[#1A6E45] border-b-2 border-[#1A6E45]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s}
            {s !== 'all' && (
              <span className="ml-1.5 text-gray-400">
                ({invoices.filter((i: any) => i.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading invoices...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No {filter === 'all' ? '' : filter} invoices
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((inv: any) => {
                const isOverdue = inv.status === 'sent' && inv.due_date &&
                  new Date(inv.due_date) < new Date();
                return (
                  <div
                    key={inv.invoice_id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.invoice_id}`)}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        inv.status === 'paid' ? 'bg-green-50' :
                        isOverdue ? 'bg-red-50' : 'bg-blue-50'
                      }`}>
                        <DollarSign size={15} className={
                          inv.status === 'paid' ? 'text-green-600' :
                          isOverdue ? 'text-red-500' : 'text-blue-600'
                        } />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {inv.sent_at
                          ? `Sent ${formatDate(inv.sent_at)}`
                          : `Created ${formatDate(inv.created_at)}`}
                        {inv.due_date && ` · Due ${formatDate(inv.due_date)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          ${(inv.total_amount || 0).toLocaleString()}
                        </p>
                        {inv.balance_due > 0 && inv.status !== 'paid' && (
                          <p className="text-xs text-gray-400">
                            ${inv.balance_due.toLocaleString()} due
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isOverdue ? 'bg-red-100 text-red-700' :
                        statusColor[inv.status] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {isOverdue ? 'overdue' : inv.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
