'use client';

import { useState } from 'react';
import { SupplyList } from '@/components/supply-list';
import { QuoteBuilder } from '@/components/quote-builder';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { jobsApi, photosApi, changeOrdersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, FileText, AlertTriangle, Plus } from 'lucide-react';
import { PhotoUpload } from '@/components/photo-upload';
import { formatDate, formatTime } from '@/lib/date-utils';

function ChangeOrdersCard({ jobId, changeOrders }: { jobId: string; changeOrders: any[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', additional_price: '' });

  const createMutation = useMutation({
    mutationFn: () => changeOrdersApi.create(jobId, {
      description: form.description,
      additional_price: parseFloat(form.additional_price) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-orders', jobId] });
      setForm({ description: '', additional_price: '' });
      setShowForm(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (coId: string) => changeOrdersApi.approve(coId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-orders', jobId] }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Change Orders {changeOrders.length > 0 && `(${changeOrders.length})`}
          </CardTitle>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-[#1A6E45] hover:underline flex items-center gap-1"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/30 space-y-2">
            <p className="text-xs font-semibold text-amber-700">New Change Order</p>
            <textarea
              autoFocus
              rows={2}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the additional work..."
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] resize-none"
            />
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <input
                  type="number"
                  value={form.additional_price}
                  onChange={e => setForm(p => ({ ...p, additional_price: e.target.value }))}
                  placeholder="Additional price $"
                  className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                />
              </div>
              <Button size="sm" className="bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
                disabled={!form.description || createMutation.isPending}
                onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8"
                onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {changeOrders.length === 0 && !showForm && (
          <p className="text-xs text-gray-400 text-center py-2">No change orders yet</p>
        )}

        {changeOrders.map((co: any) => (
          <div key={co.change_order_id} className="flex items-start justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-700 mb-1">CO #{co.co_number}</p>
              <p className="text-sm text-gray-700">{co.description}</p>
            </div>
            <div className="text-right ml-4 flex-shrink-0 space-y-1">
              <p className="text-sm font-bold text-gray-900">${co.additional_price}</p>
              <span className={`text-xs font-semibold ${
                co.status === 'approved' ? 'text-green-600' :
                co.status === 'declined' ? 'text-red-600' :
                'text-amber-600'
              }`}>{co.status}</span>
              {co.status === 'pending' && (
                <div>
                  <button
                    onClick={() => approveMutation.mutate(co.change_order_id)}
                    className="text-xs text-green-600 hover:underline block"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const statusColor: Record<string, string> = {
  estimate:    'bg-gray-100 text-gray-700',
  quoted:      'bg-blue-100 text-blue-700',
  approved:    'bg-green-100 text-green-700',
  scheduled:   'bg-purple-100 text-purple-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  complete:    'bg-emerald-100 text-emerald-700',
  invoiced:    'bg-teal-100 text-teal-700',
  paid:        'bg-green-100 text-green-800',
  cancelled:   'bg-red-100 text-red-700',
};

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = id as string;

  const [editingHours, setEditingHours] = useState(false);
  const [actualHours, setActualHours] = useState('');

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.get(jobId),
  });

  const { data: photosData } = useQuery({
    queryKey: ['photos', jobId],
    queryFn: () => photosApi.list(jobId),
  });

  const { data: fieldNotesData } = useQuery({
    queryKey: ['field-notes', jobId],
    queryFn: () => jobsApi.getFieldNotes(jobId),
  });

  const { data: changeOrdersData } = useQuery({
    queryKey: ['change-orders', jobId],
    queryFn: () => changeOrdersApi.list(jobId),
  });

  const { data: supplyData } = useQuery({
    queryKey: ['supply-items', jobId],
    queryFn: () => jobsApi.getSupplyItems(jobId),
  });

  const updateHoursMutation = useMutation({
    mutationFn: (hours: number) => jobsApi.updatePricing(jobId, { estimated_hours: hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      setEditingHours(false);
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading job...</div>;
  if (!job) return <div className="p-6 text-sm text-red-500">Job not found</div>;

  const photos = photosData?.photos || [];
  const fieldNotes = fieldNotesData?.notes || [];
  const changeOrders = changeOrdersData?.change_orders || [];
  const supplyItems = supplyData?.items || [];
  const analysis = job.ai_analysis;

  return (
    <div className="p-6 max-w-5xl mx-auto">
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
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[job.status] || 'bg-gray-100 text-gray-600'}`}>
              {job.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{job.job_number} · {job.vertical?.toUpperCase()}</p>
        </div>
        {job.quote_total && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Quote Total</p>
            <p className="text-xl font-bold text-[#1A6E45]">${job.quote_total.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left column */}
        <div className="col-span-2 space-y-5">

          {/* Photos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Camera size={14} className="text-[#1A6E45]" />
                Photos {photos.length > 0 && `(${photos.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoUpload jobId={jobId} photos={photos} />
            </CardContent>
          </Card>

          {/* Scope */}
          {job.scope_of_work && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Scope of Work</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 leading-relaxed">{job.scope_of_work}</p>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis */}
          {analysis && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Camera size={14} className="text-[#1A6E45]" />
                  Equipment Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    ['Manufacturer', analysis.manufacturer],
                    ['Model',        analysis.model_number],
                    ['Serial',       analysis.serial_number],
                    ['Year',         analysis.manufacture_year],
                    ['Refrigerant',  analysis.refrigerant],
                    ['Tonnage',      analysis.tonnage],
                    ['Voltage',      analysis.voltage],
                    ['Condition',    analysis.condition],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-medium text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
                {analysis.flags?.length > 0 && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                    {analysis.flags.map((flag: any, i: number) => (
                      <div key={i} className={`flex gap-2 p-2 rounded-lg text-xs ${
                        flag.severity === 'critical' ? 'bg-red-50 text-red-700' :
                        flag.severity === 'warning'  ? 'bg-amber-50 text-amber-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        {flag.message}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Supply List */}
          {supplyItems.length > 0 && (
            <SupplyList jobId={jobId} items={supplyItems} />
          )}

          {/* Field Notes */}
          {fieldNotes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Field Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fieldNotes.map((note: any) => (
                    <div key={note.note_id} className="border-l-2 border-[#A8D5BC] pl-3">
                      <p className="text-xs text-gray-400 mb-1">
                        {note.captured_at
                          ? formatTime(note.captured_at)
                          : formatTime(note.created_at)}
                      </p>
                      <p className="text-sm text-gray-700">{note.note_text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Change Orders */}
          <ChangeOrdersCard jobId={jobId} changeOrders={changeOrders} />
        </div>

        {/* Right column */}
        <div className="space-y-5">

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Actual hours — editable */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Actual Hours</span>
                {editingHours ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      step="0.5"
                      value={actualHours}
                      onChange={e => setActualHours(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateHoursMutation.mutate(parseFloat(actualHours));
                        if (e.key === 'Escape') setEditingHours(false);
                      }}
                      className="w-16 text-xs px-2 py-0.5 border border-[#1A6E45] rounded focus:outline-none text-right"
                    />
                    <button onClick={() => updateHoursMutation.mutate(parseFloat(actualHours))}
                      className="text-[#1A6E45]">
                      <Plus size={12} className="rotate-45" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActualHours(String(job.actual_hours || job.estimated_hours || '')); setEditingHours(true); }}
                    className="text-xs font-medium text-gray-700 hover:text-[#1A6E45] cursor-pointer"
                  >
                    {job.actual_hours ? `${job.actual_hours} hrs` : job.estimated_hours ? `${job.estimated_hours} hrs (est)` : '— set hours'}
                  </button>
                )}
              </div>
              {[
                ['Created',      formatDate(job.created_at)],
                ['Deposit',      job.deposit_required ? `$${job.deposit_required}` : null],
                ['Deposit Rcvd', job.deposit_received ? '✓ Yes' : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-700">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quote Builder — always show once supply items exist */}
          {supplyItems.length > 0 && (
            <QuoteBuilder
              jobId={jobId}
              supplyItems={supplyItems}
              job={job}
            />
          )}

          {/* Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => router.push(`/dashboard/jobs/${jobId}/invoice`)}
              >
                <FileText size={13} className="mr-2" />
                View / Build Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
