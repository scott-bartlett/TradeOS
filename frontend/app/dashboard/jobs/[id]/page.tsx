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
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [form, setForm] = useState({ description: '', additional_price: '', extra_hours: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => changeOrdersApi.create(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-orders', jobId] });
      setForm({ description: '', additional_price: '', extra_hours: '' });
      setShowForm(false);
      setDraft(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (coId: string) => changeOrdersApi.approve(coId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-orders', jobId] }),
  });

  const declineMutation = useMutation({
    mutationFn: (coId: string) => changeOrdersApi.decline(coId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-orders', jobId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (coId: string) => changeOrdersApi.delete(coId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-orders', jobId] }),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setDraft(null);
    try {
      const result = await changeOrdersApi.generate(jobId);
      if (result.no_change_order) {
        setDraftMessage(result.message);
        setDraft(null);
      } else {
        setDraft(result.draft);
        setDraftMessage(result.message);
        // Pre-fill form with AI draft
        setForm({
          description: result.draft.description || '',
          additional_price: String(result.draft.additional_price || ''),
          extra_hours: String(result.draft.extra_hours || ''),
        });
        setShowForm(true);
      }
    } catch (e) {
      setDraftMessage('AI generation failed — add manually');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Change Orders {changeOrders.length > 0 && `(${changeOrders.length})`}
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1"
            >
              {generating ? '⏳ Analyzing...' : '✦ AI Draft'}
            </button>
            <button
              onClick={() => { setShowForm(true); setDraft(null); }}
              className="text-xs text-[#1A6E45] hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* AI message */}
        {draftMessage && !showForm && (
          <div className="text-xs text-purple-600 bg-purple-50 rounded-lg p-2">
            ✦ {draftMessage}
          </div>
        )}

        {/* Create/Edit form */}
        {showForm && (
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/30 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-700">
                {draft ? '✦ AI Draft — Review & Save' : 'New Change Order'}
              </p>
              {draft && (
                <span className="text-xs text-purple-500">AI generated</span>
              )}
            </div>

            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the additional work..."
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] resize-none"
            />

            {/* Line items from AI draft */}
            {draft?.line_items?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Parts & Materials:</p>
                {draft.line_items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border border-gray-100">
                    <span className="text-gray-700">{item.description}</span>
                    <div className="flex items-center gap-2 text-gray-500 flex-shrink-0 ml-2">
                      <span>{item.quantity} {item.unit}</span>
                      {item.from_van && (
                        <span className="text-amber-600 font-medium">from van</span>
                      )}
                      {item.unit_cost && (
                        <span>${item.unit_cost}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Extra Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.extra_hours}
                  onChange={e => setForm(p => ({ ...p, extra_hours: e.target.value }))}
                  placeholder="0"
                  className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Additional Price $</label>
                <input
                  type="number"
                  value={form.additional_price}
                  onChange={e => setForm(p => ({ ...p, additional_price: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
                disabled={!form.description || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  description: form.description,
                  additional_price: parseFloat(form.additional_price) || 0,
                  extra_hours: form.extra_hours ? parseFloat(form.extra_hours) : null,
                  line_items: draft?.line_items || null,
                })}>
                {createMutation.isPending ? 'Saving...' : 'Save Change Order'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8"
                onClick={() => { setShowForm(false); setDraft(null); setDraftMessage(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {changeOrders.length === 0 && !showForm && !draftMessage && (
          <p className="text-xs text-gray-400 text-center py-2">No change orders yet</p>
        )}

        {changeOrders.map((co: any) => (
          <div key={co.change_order_id} className={`p-3 rounded-lg border ${
            co.status === 'field_approved'
              ? 'bg-amber-50 border-amber-300'
              : 'bg-amber-50 border-amber-100'
          }`}>
            {co.status === 'field_approved' && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                  ⚡ Field Request — Needs Pricing
                </span>
                {co.customer_signed && (
                  <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    ✓ Signed
                  </span>
                )}
              </div>
            )}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-700 mb-1">CO #{co.co_number}</p>
                <p className="text-sm text-gray-700">{co.description}</p>
                {co.rough_hours > 0 && (
                  <p className="text-xs text-gray-500 mt-1">~{co.rough_hours} hrs (rough estimate)</p>
                )}
                {co.rough_parts && (
                  <p className="text-xs text-gray-500 mt-0.5">Parts: {co.rough_parts}</p>
                )}
                {co.extra_hours > 0 && (
                  <p className="text-xs text-gray-500 mt-1">+{co.extra_hours} hrs labor</p>
                )}
              </div>
              <div className="text-right ml-4 flex-shrink-0 space-y-1">
                {co.additional_price > 0 && (
                  <p className="text-sm font-bold text-gray-900">${co.additional_price}</p>
                )}
                <span className={`text-xs font-semibold ${
                  co.status === 'approved'       ? 'text-green-600' :
                  co.status === 'field_approved' ? 'text-amber-600' :
                  co.status === 'declined'       ? 'text-red-600' :
                  'text-amber-600'
                }`}>{co.status.replace('_', ' ')}</span>
                {(co.status === 'pending' || co.status === 'field_approved') && (
                  <div className="flex flex-col gap-0.5 mt-1">
                    <button
                      onClick={() => approveMutation.mutate(co.change_order_id)}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => declineMutation.mutate(co.change_order_id)}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this change order?')) {
                          deleteMutation.mutate(co.change_order_id);
                        }
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            {co.line_items?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-100 space-y-1">
                {co.line_items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{item.description}</span>
                    <span className="text-gray-400 ml-2">
                      {item.quantity} {item.unit}
                      {item.from_van && ' · from van'}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
