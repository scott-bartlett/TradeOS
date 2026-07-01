'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calculator, Send, CheckCircle, ShoppingCart,
  Lock, Unlock, Phone
} from 'lucide-react';
import { formatDate } from '@/lib/date-utils';

interface Props {
  jobId: string;
  supplyItems: any[];
  job: any;
}

export function QuoteBuilder({ jobId, supplyItems, job }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [hours, setHours] = useState<string>(job.estimated_hours?.toString() || '');
  const [rate, setRate] = useState<string>(job.labor_rate?.toString() || '110');
  const [markup, setMarkup] = useState<string>(job.material_markup?.toString() || '30');
  const [quoteTotalOverride, setQuoteTotalOverride] = useState<string>(
    job.quote_total?.toString() || ''
  );
  const [overriding, setOverriding] = useState(!!job.quote_total);

  const [showSendForm, setShowSendForm] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(job.customer_email || '');
  const [quoteNotes, setQuoteNotes] = useState('');

  const [depositAmount, setDepositAmount] = useState<string>(
    job.deposit_required?.toString() || ''
  );
  const [depositReceived, setDepositReceived] = useState(job.deposit_received || false);

  // Supply order state
  const [poCalledIn, setPoCalledIn] = useState(false);

  // Auto-populate email when job loads customer email
  useEffect(() => {
    if (job.customer_email && !customerEmail) {
      setCustomerEmail(job.customer_email);
    }
  }, [job.customer_email]);

  const invalidateJob = () => queryClient.invalidateQueries({ queryKey: ['job', jobId] });

  // ── Calculations ──────────────────────────────────────────────────────────

  const supplyCost = supplyItems.reduce(
    (sum, i) => sum + ((i.unit_cost || 0) * (i.quantity || 1)), 0
  );
  const markupPct = parseFloat(markup) || 0;
  const supplyWithMarkup = supplyCost * (1 + markupPct / 100);
  const laborCost = (parseFloat(hours) || 0) * (parseFloat(rate) || 0);
  const suggestedTotal = supplyWithMarkup + laborCost;
  const finalTotal = overriding && quoteTotalOverride
    ? parseFloat(quoteTotalOverride) || suggestedTotal
    : suggestedTotal;
  const internalCost = supplyCost + laborCost;
  const grossProfit = finalTotal - internalCost;
  const marginPct = finalTotal > 0 ? (grossProfit / finalTotal) * 100 : 0;

  const marginColor =
    marginPct >= 30 ? 'text-green-600' :
    marginPct >= 15 ? 'text-amber-500' :
    'text-red-500';

  // ── Mutations ─────────────────────────────────────────────────────────────

  const savePricingMutation = useMutation({
    mutationFn: () => jobsApi.updatePricing(jobId, {
      estimated_hours: parseFloat(hours) || undefined,
      labor_rate: parseFloat(rate) || undefined,
      material_markup: parseFloat(markup) || undefined,
      quote_total: overriding ? parseFloat(quoteTotalOverride) || undefined : undefined,
      deposit_required: parseFloat(depositAmount) || undefined,
    }),
    onSuccess: invalidateJob,
  });

  const sendQuoteMutation = useMutation({
    mutationFn: () => jobsApi.sendQuote(jobId, {
      customer_email: customerEmail,
      quote_total: finalTotal,
      estimated_hours: parseFloat(hours) || undefined,
      labor_rate: parseFloat(rate) || undefined,
      material_markup: parseFloat(markup) || undefined,
      notes: quoteNotes || undefined,
    }),
    onSuccess: () => {
      invalidateJob();
      setShowSendForm(false);
    },
  });

  const depositMutation = useMutation({
    mutationFn: (received: boolean) => jobsApi.updateDeposit(jobId, {
      deposit_received: received,
      deposit_required: parseFloat(depositAmount) || undefined,
    }),
    onSuccess: (_, received) => {
      setDepositReceived(received);
      invalidateJob();
    },
  });

  const sendPOMutation = useMutation({
    mutationFn: () => jobsApi.sendPO(jobId),
    onSuccess: invalidateJob,
  });

  const isQuoteSent = ['quoted', 'approved', 'scheduled', 'in_progress',
                        'complete', 'ready_to_invoice', 'invoiced', 'paid'].includes(job.status);
  const poAlreadySent = supplyItems.some((i: any) => i.po_sent) || poCalledIn;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calculator size={14} className="text-[#1A6E45]" />
          Quote Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── Pricing inputs ── */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Est. Hours</label>
              <input
                type="number"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Rate $/hr</label>
              <input
                type="number"
                value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="110"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
              />
            </div>
          </div>

          {/* Markup slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium">Material Markup</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={markup}
                  onChange={e => setMarkup(e.target.value)}
                  className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] text-right"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={markup}
              onChange={e => setMarkup(e.target.value)}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1A6E45 0%, #1A6E45 ${(parseFloat(markup) / 60) * 100}%, #e5e7eb ${(parseFloat(markup) / 60) * 100}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-300">
              <span>0%</span><span>30%</span><span>60%</span>
            </div>
          </div>
        </div>

        {/* ── Cost breakdown ── */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Internal Breakdown
          </p>
          {[
            ['Materials (cost)', `$${supplyCost.toFixed(2)}`],
            [`Materials + ${markup}% markup`, `$${supplyWithMarkup.toFixed(2)}`],
            [`Labor (${hours || 0} hrs × $${rate}/hr)`, `$${laborCost.toFixed(2)}`],
            ['Suggested Total', `$${suggestedTotal.toFixed(2)}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs font-medium text-gray-700">{value}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-1.5 mt-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Gross Profit</span>
              <span className={`text-xs font-semibold ${marginColor}`}>
                ${grossProfit.toFixed(2)} ({marginPct.toFixed(0)}%)
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 italic">
              Labor rate includes tech overhead &amp; profit
            </p>
          </div>
        </div>

        {/* ── Quote total ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Customer Quote Total</label>
            <button
              onClick={() => setOverriding(!overriding)}
              className="text-xs text-gray-400 hover:text-[#1A6E45] flex items-center gap-1"
            >
              {overriding ? <><Unlock size={11} /> Using override</> : <><Lock size={11} /> Use suggested</>}
            </button>
          </div>
          {overriding ? (
            <input
              type="number"
              value={quoteTotalOverride}
              onChange={e => setQuoteTotalOverride(e.target.value)}
              placeholder={suggestedTotal.toFixed(2)}
              className="w-full px-3 py-2 text-sm font-semibold border-2 border-[#1A6E45] rounded-lg focus:outline-none"
            />
          ) : (
            <div className="w-full px-3 py-2 text-sm font-semibold bg-[#E8F5EE] text-[#1A6E45] rounded-lg">
              ${suggestedTotal.toFixed(2)}
            </div>
          )}
        </div>

        {/* ── Save pricing ── */}
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={() => savePricingMutation.mutate()}
          disabled={savePricingMutation.isPending}
        >
          {savePricingMutation.isPending ? 'Saving...' : 'Save Pricing'}
        </Button>

        {/* ── Send Quote ── */}
        <div className="border-t border-gray-100 pt-3">
          {isQuoteSent ? (
            <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-lg">
              <CheckCircle size={13} className="text-blue-500" />
              <span className="text-xs text-blue-700 font-medium">
                Quote sent {job.quote_sent_at ? formatDate(job.quote_sent_at) : ''}
              </span>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                className="w-full bg-[#1A6E45] hover:bg-[#145a38] text-xs"
                onClick={() => window.location.href = `/dashboard/jobs/${jobId}/quote-preview`}
              >
                <Send size={12} className="mr-2" />
                Preview &amp; Send Quote
              </Button>
            </>
          )}
        </div>

        {/* ── Deposit ── */}
        {isQuoteSent && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Deposit</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="Amount $"
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
              />
            </div>
            {depositReceived ? (
              <div className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg">
                <CheckCircle size={13} className="text-green-500" />
                <span className="text-xs text-green-700 font-medium">Deposit received</span>
                <button
                  onClick={() => depositMutation.mutate(false)}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  Undo
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs border-green-200 text-green-700 hover:bg-green-50"
                onClick={() => depositMutation.mutate(true)}
                disabled={depositMutation.isPending}
              >
                {depositMutation.isPending ? 'Saving...' : 'Mark Deposit Received'}
              </Button>
            )}
          </div>
        )}

        {/* ── Send Supply Order ── */}
        {isQuoteSent && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Supply Order</p>
            {!depositReceived ? (
              <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <Lock size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-400">
                  Locked until deposit received
                </span>
              </div>
            ) : poAlreadySent ? (
              <div className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg">
                <CheckCircle size={13} className="text-green-500" />
                <span className="text-xs text-green-700 font-medium">
                  Supply order sent to Johnstone
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full bg-[#1A6E45] hover:bg-[#145a38] text-xs"
                  onClick={() => sendPOMutation.mutate()}
                  disabled={sendPOMutation.isPending}
                >
                  <ShoppingCart size={12} className="mr-2" />
                  {sendPOMutation.isPending ? 'Sending PO...' : 'Send Supply Order'}
                </Button>
                {/* Called in manually */}
                <button
                  onClick={() => setPoCalledIn(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1.5 border border-dashed border-gray-200 rounded-lg"
                >
                  <Phone size={11} />
                  Mark as Called In
                </button>
              </div>
            )}
            {sendPOMutation.isSuccess && (
              <p className="text-xs text-green-600 text-center mt-1">
                ✓ {sendPOMutation.data?.message || 'Supply order sent'}
              </p>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
