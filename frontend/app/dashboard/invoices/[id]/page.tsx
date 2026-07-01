'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { invoicesApi, jobsApi, changeOrdersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Circle, Send, DollarSign, Package, Wrench, RotateCcw, AlertTriangle } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/date-utils';

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

  const [showSendForm, setShowSendForm] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.get(invoiceId),
  });

  // Fetch job to get customer email
  const { data: job } = useQuery({
    queryKey: ['job', invoice?.job_id],
    queryFn: () => jobsApi.get(invoice!.job_id),
    enabled: !!invoice?.job_id,
  });

  // Fetch change orders for this job to show field-approved ones
  const { data: coData } = useQuery({
    queryKey: ['change-orders', invoice?.job_id],
    queryFn: () => changeOrdersApi.list(invoice!.job_id),
    enabled: !!invoice?.job_id,
  });

  // Auto-populate customer email when job loads
  useEffect(() => {
    if (job?.customer_email && !customerEmail) {
      setCustomerEmail(job.customer_email);
    }
  }, [job]);

  const reviewMutation = useMutation({
    mutationFn: (data: any) => invoicesApi.updateReview(invoiceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] }),
  });

  const sendMutation = useMutation({
    mutationFn: () => invoicesApi.send(invoiceId, customerEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowSendForm(false);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: () => invoicesApi.markPaid(invoiceId,
      paidAmount ? parseFloat(paidAmount) : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowMarkPaid(false);
    },
  });

  // Undo — revert invoice back to draft so Jamie can fix mistakes
  const undoMutation = useMutation({
    mutationFn: () => invoicesApi.revertToDraft(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowUndoConfirm(false);
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading invoice...</div>;
  if (!invoice) return <div className="p-6 text-sm text-red-500">Invoice not found</div>;

  const checklist = invoice.checklist || {};
  const allChecked = invoice.diana_approved;
  const alreadySent = ['sent', 'paid', 'overdue'].includes(invoice.status);
  const isPaid = invoice.status === 'paid';

  const lineItems = invoice.line_items || {};
  const labor = lineItems.labor || {};
  const materials = lineItems.materials || [];
  const changeOrders = lineItems.change_orders || [];

  // Field-approved COs not yet priced — show as warning
  const fieldApprovedCOs = (coData?.change_orders || []).filter(
    (co: any) => co.status === 'field_approved'
  );

  const toggleCheck = (key: string) => {
    if (alreadySent) return;
    reviewMutation.mutate({ [key]: !checklist[key] });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
              isPaid                       ? 'bg-green-100 text-green-700' :
              invoice.status === 'sent'    ? 'bg-blue-100 text-blue-700' :
              invoice.status === 'review'  ? 'bg-yellow-100 text-yellow-700' :
              invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {invoice.customer_name && `${invoice.customer_name} · `}
            {invoice.job_title && `${invoice.job_title} · `}
            {invoice.sent_at
              ? `Sent ${formatDate(invoice.sent_at)}`
              : 'Draft — pending review'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900">
            ${(invoice.total_amount || 0).toLocaleString()}
          </p>
          {invoice.balance_due > 0 && !isPaid && (
            <p className="text-xs text-gray-400">${invoice.balance_due.toLocaleString()} due</p>
          )}
        </div>
      </div>

      {/* Field-approved CO warning */}
      {fieldApprovedCOs.length > 0 && !isPaid && (
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              {fieldApprovedCOs.length} field change order{fieldApprovedCOs.length > 1 ? 's' : ''} need pricing
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              These were captured in the field but haven't been priced yet. Price and approve them before sending this invoice.
            </p>
            {fieldApprovedCOs.map((co: any) => (
              <p key={co.change_order_id} className="text-xs text-amber-700 mt-1 font-medium">
                · CO #{co.co_number}: {co.description}
                {co.rough_hours && ` (~${co.rough_hours} hrs)`}
              </p>
            ))}
            <button
              onClick={() => router.push(`/dashboard/jobs/${invoice.job_id}`)}
              className="text-xs text-amber-700 underline mt-1"
            >
              Go to job to price change orders →
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Left — line items + actions */}
        <div className="col-span-2 space-y-5">

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Labor */}
              {labor.hours > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench size={13} className="text-[#1A6E45]" />
                    <p className="text-xs font-semibold text-gray-600">Labor</p>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {labor.hours} hrs × ${labor.rate}/hr
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      ${(labor.total || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Materials */}
              {materials.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={13} className="text-[#1A6E45]" />
                    <p className="text-xs font-semibold text-gray-600">
                      Materials ({materials.length} items)
                    </p>
                  </div>
                  <div className="space-y-1">
                    {materials.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                        <div>
                          <p className="text-xs text-gray-700">{item.description}</p>
                          {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                        </div>
                        <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Change Orders */}
              {changeOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={13} className="text-amber-500" />
                    <p className="text-xs font-semibold text-gray-600">Change Orders</p>
                  </div>
                  <div className="space-y-1">
                    {changeOrders.map((co: any) => (
                      <div key={co.co_number} className="flex items-center justify-between py-1.5 px-2 bg-amber-50 rounded-lg">
                        <p className="text-xs text-gray-700">CO #{co.co_number}: {co.description}</p>
                        <p className="text-xs font-semibold text-gray-900 flex-shrink-0 ml-2">
                          ${co.amount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {materials.length === 0 && labor.hours === 0 && changeOrders.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No line items</p>
              )}
            </CardContent>
          </Card>

          {/* Diana's Checklist */}
          {!alreadySent && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-700">
                  Diana — Review Before Sending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                  {!showSendForm ? (
                    <Button
                      className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
                      disabled={!allChecked}
                      onClick={() => setShowSendForm(true)}
                    >
                      <Send size={14} className="mr-2" />
                      Send Invoice
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500">Customer Email</label>
                        <input
                          autoFocus
                          type="email"
                          value={customerEmail}
                          onChange={e => setCustomerEmail(e.target.value)}
                          placeholder="customer@email.com"
                          className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                        />
                        {job?.customer_email && customerEmail === job.customer_email && (
                          <p className="text-xs text-gray-400 mt-0.5">Auto-filled from customer record</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
                          disabled={!customerEmail || sendMutation.isPending}
                          onClick={() => sendMutation.mutate()}
                        >
                          {sendMutation.isPending ? 'Sending...' : 'Send Invoice'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-8"
                          onClick={() => setShowSendForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {!allChecked && (
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Complete all checklist items to send
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sent — with undo option */}
          {alreadySent && !isPaid && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={16} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-blue-700">Invoice Sent</p>
                      <p className="text-xs text-blue-500">
                        {invoice.sent_at && formatDateTime(invoice.sent_at)}
                      </p>
                    </div>
                  </div>
                  {!showUndoConfirm ? (
                    <button
                      onClick={() => setShowUndoConfirm(true)}
                      className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Undo
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-600">Revert to draft?</p>
                      <button
                        onClick={() => undoMutation.mutate()}
                        disabled={undoMutation.isPending}
                        className="text-xs text-red-600 font-semibold hover:underline"
                      >
                        {undoMutation.isPending ? 'Reverting...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setShowUndoConfirm(false)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paid confirmation */}
          {isPaid && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Paid in Full</p>
                    <p className="text-xs text-green-500">
                      {invoice.paid_at && formatDateTime(invoice.paid_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — summary + actions */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ['Subtotal',    invoice.subtotal ? `$${Number(invoice.subtotal).toLocaleString()}` : null],
                ['Tax',         `$${(invoice.tax_amount || 0).toLocaleString()}`],
                ['Total',       `$${(invoice.total_amount || 0).toLocaleString()}`],
                ['Amount Paid', invoice.amount_paid > 0 ? `$${invoice.amount_paid.toLocaleString()}` : null],
                ['Balance Due', invoice.balance_due != null ? `$${invoice.balance_due.toLocaleString()}` : null],
                ['Due Date',    invoice.due_date ? formatDate(invoice.due_date) : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className={`text-xs font-semibold ${
                    label === 'Balance Due' ? 'text-gray-900' :
                    label === 'Total' ? 'text-[#1A6E45]' : 'text-gray-700'
                  }`}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Mark Paid */}
          {alreadySent && !isPaid && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Payment</CardTitle>
              </CardHeader>
              <CardContent>
                {!showMarkPaid ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setPaidAmount(String(invoice.balance_due || invoice.total_amount));
                      setShowMarkPaid(true);
                    }}
                  >
                    <CheckCircle size={13} className="mr-2" />
                    Mark as Paid
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">Amount Received</label>
                      <input
                        type="number"
                        value={paidAmount}
                        onChange={e => setPaidAmount(e.target.value)}
                        className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
                        disabled={markPaidMutation.isPending}
                        onClick={() => markPaidMutation.mutate()}
                      >
                        {markPaidMutation.isPending ? 'Saving...' : 'Confirm'}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-8"
                        onClick={() => setShowMarkPaid(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job link */}
          {invoice.job_id && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => router.push(`/dashboard/jobs/${invoice.job_id}`)}
            >
              View Job
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
