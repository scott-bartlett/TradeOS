'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { jobsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Download, Sparkles } from 'lucide-react';

// ── PDF PREVIEW RENDERER ──────────────────────────────────────────────────────

function QuotePDFPreview({ data, notes }: { data: any; notes: string }) {
  const company = {
    name: "Alki Electric",
    address: "Seattle, WA",
    phone: "(206) 250-0248",
    email: "info@alkielectric.com",
    license: "EL-XXXXXXX",
  };

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden font-sans text-gray-800"
         style={{ fontFamily: 'Helvetica, Arial, sans-serif', maxWidth: '100%' }}>

      {/* Header — logo left, doc info right */}
      <div className="px-10 pt-8 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img src="/alki-logo.png" alt="Alki Electric"
                 className="w-16 h-16 rounded-full object-cover"
                 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-xs text-gray-500">{company.address}</p>
              <p className="text-xs text-gray-500">{company.phone}</p>
              <p className="text-xs text-gray-500">{company.email}</p>
              <p className="text-xs text-gray-500">Lic: {company.license}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">QUOTE</p>
            <p className="text-sm text-gray-500">#{data.quote_number}</p>
            <p className="text-xs text-gray-500 mt-1">Date: {today}</p>
            <p className="text-xs text-gray-500">Valid for {data.quote_valid_days || 30} days</p>
          </div>
        </div>
      </div>

      <div className="px-10">
        <hr className="border-gray-200" />
      </div>

      {/* Bill To + Job */}
      <div className="px-10 py-5 grid grid-cols-2 gap-8">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
          <p className="text-sm font-semibold">{data.customer?.display_name}</p>
          <p className="text-xs text-gray-500">{data.customer?.billing_street}</p>
          <p className="text-xs text-gray-500">
            {data.customer?.billing_city}, {data.customer?.billing_state} {data.customer?.billing_zip}
          </p>
          <p className="text-xs text-gray-500">{data.customer?.email}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Job</p>
          <p className="text-sm font-semibold">{data.title}</p>
          <p className="text-xs text-gray-500">{data.service_location?.street}</p>
          <p className="text-xs text-gray-500">
            {data.service_location?.city}, {data.service_location?.state}
          </p>
        </div>
      </div>

      <div className="px-10">
        <hr className="border-gray-100" />
      </div>

      {/* AI Summary */}
      {data.ai_summary && (
        <div className="px-10 py-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            About This Quote
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{data.ai_summary}</p>
        </div>
      )}

      {/* Materials */}
      {data.supply_items?.length > 0 && (
        <div className="px-10 pb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Materials & Equipment
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-1.5 font-semibold">Description</th>
                <th className="text-left py-1.5 font-semibold">SKU</th>
                <th className="text-right py-1.5 font-semibold">Qty</th>
                <th className="text-right py-1.5 font-semibold">Unit</th>
              </tr>
            </thead>
            <tbody>
              {data.supply_items.map((item: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="py-1.5 pr-4">{item.description}</td>
                  <td className="py-1.5 pr-4 text-gray-400">{item.sku || '—'}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right text-gray-500">{item.unit || 'ea'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Labor */}
      {data.estimated_hours > 0 && (
        <div className="px-10 pb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Labor</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-1.5 font-semibold">Description</th>
                <th className="text-right py-1.5 font-semibold">Estimated Hours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1.5">Electrical Service — {data.title}</td>
                <td className="py-1.5 text-right">{data.estimated_hours} hrs</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Change Orders */}
      {data.change_orders?.length > 0 && (
        <div className="px-10 pb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Additional Work
          </p>
          {data.change_orders.map((co: any) => (
            <p key={co.co_number} className="text-xs py-1 border-b border-gray-100">
              CO #{co.co_number}: {co.description}
            </p>
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="px-10 pb-5">
        <hr className="border-gray-200 mb-3" />
        <div className="flex flex-col items-end gap-1">
          <div className="flex justify-between w-48">
            <span className="text-sm font-bold">Quote Total</span>
            <span className="text-base font-bold">${data.quote_total?.toLocaleString()}</span>
          </div>
          {data.deposit_required > 0 && (
            <>
              <div className="flex justify-between w-48 text-xs text-gray-500">
                <span>Deposit Required</span>
                <span>${data.deposit_required?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between w-48 text-xs text-gray-500">
                <span>Balance at Completion</span>
                <span>${Math.max(0, data.quote_total - data.deposit_required).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="px-10 pb-5">
          <hr className="border-gray-100 mb-3" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-xs text-gray-600 leading-relaxed">{notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-10 pb-6">
        <hr className="border-gray-100 mb-3" />
        <p className="text-xs text-gray-400 text-center">
          This quote is valid for {data.quote_valid_days || 30} days from the date issued.
          Questions? Contact us at {company.email} or {company.phone}.
          Thank you for choosing {company.name}.
        </p>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function QuotePreviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const jobId = id as string;

  const [notes, setNotes] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quote-preview', jobId],
    queryFn: () => jobsApi.getQuotePreview(jobId),
  });

  // Auto-populate email when data loads
  useEffect(() => {
    if (data?.customer?.email) setCustomerEmail(data.customer.email);
  }, [data?.customer?.email]);

  const sendMutation = useMutation({
    mutationFn: () => jobsApi.sendQuote(jobId, {
      customer_email: customerEmail,
      quote_total: data.quote_total,
      estimated_hours: data.estimated_hours,
      labor_rate: data.labor_rate,
      notes: notes || undefined,
    }),
    onSuccess: () => router.push(`/dashboard/jobs/${jobId}`),
  });

  if (isLoading) return (
    <div className="p-6 text-sm text-gray-400 flex items-center gap-2">
      <Sparkles size={14} className="animate-pulse" /> Generating preview...
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <p className="text-sm font-semibold text-gray-700">Quote Preview</p>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">
        {/* Left — PDF preview */}
        <div className="col-span-2">
          <QuotePDFPreview data={data} notes={notes} />
        </div>

        {/* Right — send panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Send Quote</h2>

            <div>
              <label className="text-xs text-gray-500">Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="customer@email.com"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
              />
              {data?.customer?.email && customerEmail === data.customer.email && (
                <p className="text-xs text-gray-400 mt-0.5">From customer record</p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500">Notes to Customer (optional)</label>
              <p className="text-xs text-gray-400 mb-1">
                Appears on the quote. No pricing changes here — edit those on the job page.
              </p>
              <textarea
                rows={5}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any specific details, access instructions, or notes for the customer..."
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] resize-none"
              />
            </div>

            <Button
              className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
              disabled={!customerEmail || sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              <Send size={14} className="mr-2" />
              {sendMutation.isPending ? 'Sending...' : 'Send Quote to Customer'}
            </Button>

            {sendMutation.isError && (
              <p className="text-xs text-red-500 text-center">
                Failed to send — check email and try again
              </p>
            )}
          </div>

          {/* AI summary note */}
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-purple-500" />
              <p className="text-xs font-semibold text-purple-700">AI Generated Summary</p>
            </div>
            <p className="text-xs text-purple-600">
              The "About This Quote" section was written by Claude based on the job scope and materials.
              You can edit it by updating the scope of work on the job page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
