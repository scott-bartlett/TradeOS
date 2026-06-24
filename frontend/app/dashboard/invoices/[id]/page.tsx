'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { invoicesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Circle, Send } from 'lucide-react';
import { useState } from 'react';

const checklistItems = [
  { key: 'review_lines_verified',    label: 'Line items match approved quote and change orders' },
  { key: 'review_hours_verified',    label: 'Labor hours match close note' },
  { key: 'review_co_verified',       label: 'All approved change orders included' },
  { key: 'review_nocharge_verified', label: 'No-charge items confirmed at $0.00' },
  { key: 'review_total_verified',    label: 'Total amount is correct' },
];

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invoiceId = id as string;
  const [sending, setSending] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.get(invoiceId),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: any) => invoicesApi.updateReview(invoiceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] }),
  });

  const sendMutation = useMutation({
    mutationFn: () => invoicesApi.send(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSending(false);
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading invoice...</div>;
  if (!invoice) return <div className="p-6 text-sm text-red-500">Invoice not found</div>;

  const checklist = invoice.checklist || {};
  const allChecked = invoice.diana_approved;
  const alreadySent = invoice.status === 'sent' || invoice.status === 'paid';

  const toggleCheck = (key: string) => {
    if (alreadySent) return;
    reviewMutation.mutate({ [key]: !checklist[key] });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          <ArrowLeft size={15} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              invoice.status === 'sent'   ? 'bg-blue-100 text-blue-700' :
              invoice.status === 'paid'   ? 'bg-green-100 text-green-700' :
              invoice.status === 'review' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {invoice.sent_at
              ? `Sent ${new Date(invoice.sent_at).toLocaleDateString()}`
              : 'Draft — pending review'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900">
            ${(invoice.total_amount || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Diana Review Checklist */}
      {!alreadySent && (
        <Card className="mb-5 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700">
              Diana — Review Before Sending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {checklistItems.map(({ key, label }) => {
                const checked = checklist[key.replace('review_', '').replace('_verified', '') + '_verified'] 
                  || checklist[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleCheck(key)}
                    className="w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
                  >
                    {checked
                      ? <CheckCircle size={16} className="text-[#1A6E45] flex-shrink-0" />
                      : <Circle size={16} className="text-gray-300 flex-shrink-0" />
                    }
                    <span className={`text-sm ${checked ? 'text-gray-700' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <Button
                className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
                disabled={!allChecked || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                <Send size={14} className="mr-2" />
                {sendMutation.isPending ? 'Sending...' : 'Send Invoice'}
              </Button>
              {!allChecked && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Complete all checklist items to send
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sent confirmation */}
      {alreadySent && (
        <Card className="mb-5 border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-700">Invoice Sent</p>
                <p className="text-xs text-green-600">
                  {invoice.sent_at && `Sent on ${new Date(invoice.sent_at).toLocaleString()}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ['Invoice #',  invoice.invoice_number],
            ['Status',     invoice.status],
            ['Subtotal',   invoice.subtotal ? `$${invoice.subtotal.toLocaleString()}` : null],
            ['Tax',        invoice.tax_amount ? `$${invoice.tax_amount.toLocaleString()}` : '$0.00'],
            ['Total',      `$${(invoice.total_amount || 0).toLocaleString()}`],
            ['Balance Due',invoice.balance_due ? `$${invoice.balance_due.toLocaleString()}` : null],
            ['Due Date',   invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : null],
            ['QB Synced',  invoice.quickbooks_invoice_id ? 'Yes' : 'Pending'],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} className="flex justify-between">
              <span className="text-xs text-gray-400">{label}</span>
              <span className={`text-xs font-semibold ${
                label === 'Total' || label === 'Balance Due' ? 'text-gray-900' : 'text-gray-700'
              }`}>{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}