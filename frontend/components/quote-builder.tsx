'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, CheckCircle, TrendingUp, Clock } from 'lucide-react';

interface Props {
  jobId: string;
  supplyItems: any[];
  job: any;
}

export function QuoteBuilder({ jobId, supplyItems, job }: Props) {
  const queryClient = useQueryClient();

  const laborRate = job?.labor_rate || 110;
  const estimatedHours = job?.estimated_hours || 0;
  const markup = job?.material_markup || 30;

  // Calculate material cost from supply items
  const materialCost = supplyItems.reduce((sum, item) => {
    return sum + ((item.unit_cost || 0) * (item.quantity || 1));
  }, 0);

  const materialWithMarkup = materialCost * (1 + markup / 100);
  const laborCost = laborRate * estimatedHours;
  const suggestedTotal = materialWithMarkup + laborCost;

  const [customerPrice, setCustomerPrice] = useState(
    job?.quote_total ? String(job.quote_total) : String(Math.round(suggestedTotal))
  );

  useEffect(() => {
    if (!job?.quote_total && suggestedTotal > 0) {
      setCustomerPrice(String(Math.round(suggestedTotal)));
    }
  }, [suggestedTotal, job?.quote_total]);

  const margin = customerPrice
    ? (((parseFloat(customerPrice) - materialCost - laborCost) / parseFloat(customerPrice)) * 100)
    : 0;

  const mutation = useMutation({
    mutationFn: () => jobsApi.setQuoteTotal(jobId, {
      quote_total: parseFloat(customerPrice),
      estimated_hours: estimatedHours,
      labor_rate: laborRate,
      material_markup: markup,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  const isSet = job?.quote_total && job.quote_total > 0;

  return (
    <Card className={isSet ? 'border-green-200' : 'border-[#A8D5BC]'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <DollarSign size={14} className="text-[#1A6E45]" />
          Quote Builder
          {isSet && <CheckCircle size={14} className="text-green-500 ml-auto" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Cost breakdown */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Materials ({supplyItems.length} items)</span>
            <span className="font-medium text-gray-700">${materialCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Markup ({markup}%)</span>
            <span className="font-medium text-gray-700">+${(materialWithMarkup - materialCost).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Clock size={10} />
              Labor ({estimatedHours}hrs @ ${laborRate}/hr)
            </span>
            <span className="font-medium text-gray-700">${laborCost.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between text-xs">
            <span className="font-semibold text-gray-700">Suggested Price</span>
            <span className="font-bold text-[#1A6E45]">${Math.round(suggestedTotal).toLocaleString()}</span>
          </div>
        </div>

        {/* Customer price input */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Customer Price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <Input
              type="number"
              value={customerPrice}
              onChange={e => setCustomerPrice(e.target.value)}
              className="pl-7 text-lg font-bold"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Margin indicator */}
        {parseFloat(customerPrice) > 0 && (
          <div className={`flex items-center justify-between p-2 rounded-lg text-xs ${
            margin >= 30 ? 'bg-green-50' :
            margin >= 15 ? 'bg-amber-50' :
            'bg-red-50'
          }`}>
            <div className="flex items-center gap-1">
              <TrendingUp size={12} className={
                margin >= 30 ? 'text-green-600' :
                margin >= 15 ? 'text-amber-600' :
                'text-red-600'
              } />
              <span className={
                margin >= 30 ? 'text-green-700' :
                margin >= 15 ? 'text-amber-700' :
                'text-red-700'
              }>
                {margin.toFixed(1)}% margin
              </span>
            </div>
            <span className="text-gray-500">
              {margin >= 30 ? 'Healthy' : margin >= 15 ? 'Thin' : 'Below cost'}
            </span>
          </div>
        )}

        {/* Save button */}
        <Button
          className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
          onClick={() => mutation.mutate()}
          disabled={!customerPrice || parseFloat(customerPrice) <= 0 || mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' :
           isSet ? 'Update Quote Total' : 'Set Quote Total'}
        </Button>

        {isSet && (
          <p className="text-xs text-center text-green-600 font-medium">
            Quote set at ${parseFloat(customerPrice).toLocaleString()} — ready to invoice
          </p>
        )}
      </CardContent>
    </Card>
  );
}