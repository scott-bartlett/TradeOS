'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { invoicesApi, jobsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';

export default function JobInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = id as string;

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.get(jobId),
  });

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['job-invoice', jobId],
    queryFn: () => invoicesApi.getForJob(jobId),
    retry: false,
  });

  const buildMutation = useMutation({
    mutationFn: () => invoicesApi.build(jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-invoice', jobId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      router.push(`/dashboard/invoices/${data.invoice_id}`);
    },
  });

  // If invoice exists, redirect to it
  if (invoice?.invoice_id) {
    router.push(`/dashboard/invoices/${invoice.invoice_id}`);
    return null;
  }

  const noInvoiceYet = error || !invoice;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          <ArrowLeft size={15} className="text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoice</h1>
          {job && <p className="text-sm text-gray-400">{job.title} · {job.job_number}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : noInvoiceYet ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-14 h-14 bg-[#E8F5EE] rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={24} className="text-[#1A6E45]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to Build Invoice</h2>
            <p className="text-sm text-gray-500 mb-1">
              This will create an invoice from:
            </p>
            <ul className="text-sm text-gray-500 mb-6 space-y-1">
              <li>✓ Approved quote total {job?.quote_total ? `($${Number(job.quote_total).toLocaleString()})` : ''}</li>
              <li>✓ Actual hours worked</li>
              <li>✓ Approved change orders</li>
              <li>✓ Deposit applied {job?.deposit_received ? '✓' : '(none)'}</li>
            </ul>
            <Button
              className="bg-[#1A6E45] hover:bg-[#145a38]"
              onClick={() => buildMutation.mutate()}
              disabled={buildMutation.isPending}
            >
              {buildMutation.isPending ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Building...</>
              ) : (
                <><FileText size={14} className="mr-2" /> Build Invoice</>
              )}
            </Button>
            {buildMutation.isError && (
              <p className="text-xs text-red-500 mt-3">
                {(buildMutation.error as any)?.response?.data?.detail || 'Failed to build invoice'}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
