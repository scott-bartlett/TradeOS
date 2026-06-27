'use client';

import { QuoteBuilder } from '@/components/quote-builder';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { jobsApi, photosApi, changeOrdersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, FileText, AlertTriangle, Package } from 'lucide-react';
import { PhotoUpload } from '@/components/photo-upload';

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
  const jobId = id as string;

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

          {/* Supply Items */}
          {supplyItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Package size={14} className="text-[#1A6E45]" />
                  Supply List ({supplyItems.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {supplyItems.map((item: any) => (
                    <div key={item.item_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.description}</p>
                        {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <span className="text-xs text-gray-500">{item.quantity} {item.unit}</span>
                        {item.unit_cost && (
                          <span className="text-xs font-medium text-gray-700">${item.unit_cost}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                          ? new Date(note.captured_at).toLocaleTimeString()
                          : new Date(note.created_at).toLocaleTimeString()}
                      </p>
                      <p className="text-sm text-gray-700">{note.note_text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Change Orders */}
          {changeOrders.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {changeOrders.map((co: any) => (
                    <div key={co.change_order_id} className="flex items-start justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-700 mb-1">CO #{co.co_number}</p>
                        <p className="text-sm text-gray-700">{co.description}</p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">${co.additional_price}</p>
                        <span className={`text-xs font-semibold ${
                          co.status === 'approved' ? 'text-green-600' :
                          co.status === 'declined' ? 'text-red-600' :
                          'text-amber-600'
                        }`}>{co.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Job details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Est. Hours',   job.estimated_hours  ? `${job.estimated_hours} hrs`  : null],
                ['Actual Hours', job.actual_hours      ? `${job.actual_hours} hrs`     : null],
                ['Labor Rate',   job.labor_rate        ? `$${job.labor_rate}/hr`       : null],
                ['Markup',       job.material_markup   ? `${job.material_markup}%`     : null],
                ['Created',      new Date(job.created_at).toLocaleDateString()],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-700">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          {/* Quote Builder */}
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