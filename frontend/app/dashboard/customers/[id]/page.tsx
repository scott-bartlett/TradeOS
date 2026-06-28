'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { customersApi, jobsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Building2, Home, MapPin, Phone, Mail,
  Pencil, Plus, Check, X, ChevronRight, Briefcase
} from 'lucide-react';
import { StateSelect, ZipInput } from '@/components/address-inputs';

const statusColor: Record<string, string> = {
  estimate:    'bg-gray-100 text-gray-600',
  quoted:      'bg-blue-100 text-blue-700',
  approved:    'bg-green-100 text-green-700',
  scheduled:   'bg-purple-100 text-purple-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  complete:    'bg-emerald-100 text-emerald-700',
  invoiced:    'bg-teal-100 text-teal-700',
  paid:        'bg-green-100 text-green-800',
  cancelled:   'bg-red-100 text-red-700',
};

function EditableField({
  label, value, onSave, type = 'text', placeholder = ''
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-0.5">{label}</p>
          {type === 'state' ? (
            <StateSelect value={draft} onChange={setDraft} className="w-full text-sm py-1" />
          ) : type === 'zip' ? (
            <ZipInput value={draft} onChange={setDraft} className="w-full text-sm py-1" />
          ) : (
            <input
              autoFocus
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onSave(draft); setEditing(false); }
                if (e.key === 'Escape') { setDraft(value); setEditing(false); }
              }}
              className="w-full text-sm px-2 py-1 border border-[#1A6E45] rounded focus:outline-none"
            />
          )}
        </div>
        <button onClick={() => { onSave(draft); setEditing(false); }} className="text-[#1A6E45] mt-4">
          <Check size={14} />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="text-gray-400 mt-4">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 py-0.5"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-700">{value || <span className="text-gray-300 italic">—</span>}</p>
      </div>
      <Pencil size={12} className="text-gray-300 group-hover:text-[#1A6E45] flex-shrink-0 ml-2" />
    </div>
  );
}

function AddLocationForm({ customerId, onSuccess, onCancel }: {
  customerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    location_name: '', contact_name: '', contact_phone: '',
    street: '', city: '', state: '', zip_code: '', access_notes: '',
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => customersApi.addLocation(customerId, form),
    onSuccess,
  });

  const canSubmit = form.street && form.city && form.state && form.zip_code;

  return (
    <div className="border border-[#1A6E45] rounded-lg p-4 space-y-3 bg-[#E8F5EE]/30">
      <p className="text-xs font-semibold text-[#1A6E45]">New Service Location</p>
      <div>
        <label className="text-xs text-gray-500">Location Name (optional)</label>
        <input value={form.location_name} onChange={e => set('location_name', e.target.value)}
          placeholder="Main Office, Unit 4B..."
          className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">On-site Contact</label>
          <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
            placeholder="Name"
            className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Contact Phone</label>
          <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
            placeholder="(555) 000-0000"
            className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Street *</label>
        <input value={form.street} onChange={e => set('street', e.target.value)}
          placeholder="123 Main St"
          className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-xs text-gray-500">City *</label>
          <input value={form.city} onChange={e => set('city', e.target.value)}
            placeholder="City"
            className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]" />
        </div>
        <div>
          <label className="text-xs text-gray-500">State *</label>
          <StateSelect
            value={form.state}
            onChange={v => set('state', v)}
            className="mt-1 w-full text-sm py-1.5"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">ZIP *</label>
          <ZipInput
            value={form.zip_code}
            onChange={v => set('zip_code', v)}
            className="mt-1 w-full text-sm py-1.5"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Access Notes</label>
        <textarea value={form.access_notes} onChange={e => set('access_notes', e.target.value)}
          placeholder="Gate code 1234, ring bell on arrival..."
          rows={2}
          className="mt-1 w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] resize-none" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving...' : 'Add Location'}
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerId = id as string;
  const [showAddLocation, setShowAddLocation] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId),
  });

  const { data: jobsData } = useQuery({
    queryKey: ['customer-jobs', customerId],
    queryFn: () => customersApi.getJobs(customerId),
    enabled: !!customerId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => customersApi.update(customerId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', customerId] }),
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ locationId, data }: { locationId: string; data: any }) =>
      customersApi.updateLocation(locationId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', customerId] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading customer...</div>;
  if (!customer) return <div className="p-6 text-sm text-red-500">Customer not found</div>;

  const isCommercial = customer.customer_type === 'commercial';
  const jobs = jobsData?.jobs || [];

  const save = (field: string) => (value: string) =>
    updateMutation.mutate({ [field]: value || null });

  const saveLocation = (locationId: string, field: string) => (value: string) =>
    updateLocationMutation.mutate({ locationId, data: { [field]: value || null } });

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
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isCommercial ? 'bg-blue-50' : 'bg-[#E8F5EE]'
          }`}>
            {isCommercial
              ? <Building2 size={18} className="text-blue-600" />
              : <Home size={18} className="text-[#1A6E45]" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{customer.display_name}</h1>
            <p className="text-sm text-gray-400 capitalize">{customer.customer_type} customer</p>
          </div>
        </div>
        <Button
          className="bg-[#1A6E45] hover:bg-[#145a38] text-sm"
          onClick={() => router.push(`/dashboard/jobs?new=1&customer=${customerId}`)}
        >
          <Plus size={14} className="mr-2" />
          New Job
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left column */}
        <div className="col-span-2 space-y-5">

          {/* Contact Info — editable */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isCommercial && (
                <EditableField label="Company Name" value={customer.company_name || ''}
                  onSave={save('company_name')} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <EditableField
                  label={isCommercial ? 'Contact First Name' : 'First Name'}
                  value={customer.first_name || ''} onSave={save('first_name')} />
                <EditableField
                  label={isCommercial ? 'Contact Last Name' : 'Last Name'}
                  value={customer.last_name || ''} onSave={save('last_name')} />
              </div>
              <EditableField label="Email" value={customer.email || ''}
                onSave={save('email')} type="email" />
              <EditableField label="Phone" value={customer.phone || ''}
                onSave={save('phone')} />
              <EditableField label="Mobile" value={customer.mobile || ''}
                onSave={save('mobile')} />
            </CardContent>
          </Card>

          {/* Billing Address — editable */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <EditableField label="Street" value={customer.billing_street || ''}
                onSave={save('billing_street')} />
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <EditableField label="City" value={customer.billing_city || ''}
                    onSave={save('billing_city')} />
                </div>
                <EditableField label="State" value={customer.billing_state || ''}
                  onSave={save('billing_state')} type="state" />
                <EditableField label="ZIP" value={customer.billing_zip || ''}
                  onSave={save('billing_zip')} type="zip" />
              </div>
            </CardContent>
          </Card>

          {/* Service Locations — editable + add */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Service Locations ({customer.service_locations?.length || 0})
                </CardTitle>
                <button
                  onClick={() => setShowAddLocation(true)}
                  className="text-xs text-[#1A6E45] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add Location
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddLocation && (
                <AddLocationForm
                  customerId={customerId}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
                    setShowAddLocation(false);
                  }}
                  onCancel={() => setShowAddLocation(false)}
                />
              )}

              {customer.service_locations?.length === 0 && !showAddLocation && (
                <p className="text-xs text-gray-400 text-center py-3">No service locations yet</p>
              )}

              {customer.service_locations?.map((loc: any) => (
                <div key={loc.location_id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#1A6E45]">
                      {loc.location_name || `${loc.street}, ${loc.city}`}
                    </p>
                    {!loc.is_active && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">inactive</span>
                    )}
                  </div>
                  <EditableField label="Location Name" value={loc.location_name || ''}
                    onSave={saveLocation(loc.location_id, 'location_name')} />
                  <EditableField label="Street" value={loc.street || ''}
                    onSave={saveLocation(loc.location_id, 'street')} />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <EditableField label="City" value={loc.city || ''}
                        onSave={saveLocation(loc.location_id, 'city')} />
                    </div>
                    <EditableField label="State" value={loc.state || ''}
                      onSave={saveLocation(loc.location_id, 'state')} type="state" />
                    <EditableField label="ZIP" value={loc.zip_code || ''}
                      onSave={saveLocation(loc.location_id, 'zip_code')} type="zip" />
                  </div>
                  <EditableField label="On-site Contact" value={loc.contact_name || ''}
                    onSave={saveLocation(loc.location_id, 'contact_name')} />
                  <EditableField label="Contact Phone" value={loc.contact_phone || ''}
                    onSave={saveLocation(loc.location_id, 'contact_phone')} />
                  <EditableField label="Access Notes" value={loc.access_notes || ''}
                    onSave={saveLocation(loc.location_id, 'access_notes')}
                    placeholder="Gate code, entry instructions..." />
                  {loc.access_notes && (
                    <div className="mt-1 p-2 bg-amber-50 rounded text-xs text-amber-700">
                      🔑 {loc.access_notes}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Job History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Briefcase size={14} className="text-[#1A6E45]" />
                Job History ({jobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No jobs yet for this customer</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {jobs.map((job: any) => (
                    <div
                      key={job.job_id}
                      onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{job.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {job.job_number} · {new Date(job.created_at).toLocaleDateString()}
                          {job.quote_total && ` · $${Number(job.quote_total).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          statusColor[job.status] || 'bg-gray-100 text-gray-600'
                        }`}>
                          {job.status.replace('_', ' ')}
                        </span>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <EditableField label="Internal notes" value={customer.notes || ''}
                onSave={save('notes')} />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Type',  customer.customer_type],
                ['QB ID', customer.quickbooks_id || 'Not synced'],
                ['Since', new Date(customer.created_at).toLocaleDateString()],
                ['Jobs',  jobs.length ? `${jobs.length} total` : '0'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-700 capitalize">{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => updateMutation.mutate({ is_active: !customer.is_active })}
                  disabled={updateMutation.isPending}
                  className={`w-full text-xs font-medium py-1.5 rounded-lg border transition-colors ${
                    customer.is_active
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {customer.is_active ? 'Mark Inactive' : 'Mark Active'}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          {jobs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Revenue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  ['Total Quoted', `$${jobs.reduce((s: number, j: any) => s + (Number(j.quote_total) || 0), 0).toLocaleString()}`],
                  ['Open Jobs',   jobs.filter((j: any) => !['paid', 'cancelled'].includes(j.status)).length],
                  ['Completed',   jobs.filter((j: any) => j.status === 'paid').length],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-700">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
