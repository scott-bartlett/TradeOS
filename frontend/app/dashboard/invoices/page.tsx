'use client';

import { useQuery } from '@tanstack/react-query';
import { invoicesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

const statusColor: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  review:  'bg-yellow-100 text-yellow-700',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function InvoicesPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const invoices = data?.invoices || [];
  const totalOutstanding = invoices
    .filter((i: any) => i.status === 'sent')
    .reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            {invoices.length} total · ${totalOutstanding.toLocaleString()} outstanding
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No invoices yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv: any) => (
                <div
                  key={inv.invoice_id}
                  onClick={() => router.push(`/dashboard/invoices/${inv.invoice_id}`)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <DollarSign size={15} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inv.sent_at
                          ? `Sent ${new Date(inv.sent_at).toLocaleDateString()}`
                          : `Created ${new Date(inv.created_at || '').toLocaleDateString()}`}
                        {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString()}`}
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
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}