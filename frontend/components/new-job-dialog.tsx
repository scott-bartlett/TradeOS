'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi, customersApi } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  prefilledCustomerId?: string;
  prefilledCustomerName?: string;
  onSuccess?: (jobId: string) => void;
}

export function NewJobDialog({
  open,
  onClose,
  prefilledCustomerId,
  prefilledCustomerName,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState(prefilledCustomerId || '');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    vertical: 'hvac',
    scope_of_work: '',
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
    enabled: open && !prefilledCustomerId,
  });

  const customers = customersData?.customers || [];

  // Load locations when customer changes or prefilled customer is set
  useEffect(() => {
    const cid = prefilledCustomerId || selectedCustomerId;
    if (!cid) {
      setLocations([]);
      setSelectedLocationId('');
      return;
    }
    customersApi.get(cid).then(data => {
      const locs = data.service_locations || [];
      setLocations(locs);
      // Auto-select if only one location
      if (locs.length === 1) {
        setSelectedLocationId(locs[0].location_id);
      } else {
        setSelectedLocationId('');
      }
    });
  }, [selectedCustomerId, prefilledCustomerId]);

  // Sync prefilled customer on open
  useEffect(() => {
    if (open && prefilledCustomerId) {
      setSelectedCustomerId(prefilledCustomerId);
    }
    if (!open) {
      // Reset on close unless prefilled
      setForm({ title: '', vertical: 'hvac', scope_of_work: '' });
      if (!prefilledCustomerId) {
        setSelectedCustomerId('');
        setSelectedLocationId('');
        setLocations([]);
      }
    }
  }, [open, prefilledCustomerId]);

  const mutation = useMutation({
    mutationFn: () => jobsApi.create({
      title: form.title,
      customer_id: prefilledCustomerId || selectedCustomerId,
      service_location_id: selectedLocationId,
      vertical: form.vertical,
      scope_of_work: form.scope_of_work || null,
      labor_rate: 110,
      material_markup: 30,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (onSuccess && data?.job_id) {
        onSuccess(data.job_id);
      } else {
        onClose();
      }
      setForm({ title: '', vertical: 'hvac', scope_of_work: '' });
      if (!prefilledCustomerId) {
        setSelectedCustomerId('');
        setSelectedLocationId('');
        setLocations([]);
      }
    },
  });

  const set = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const effectiveCustomerId = prefilledCustomerId || selectedCustomerId;
  const canSubmit = form.title && effectiveCustomerId && selectedLocationId;

  // Format location label — show address prominently
  const locationLabel = (l: any) => {
    const addr = `${l.street}, ${l.city}`;
    return l.location_name && l.location_name !== l.street
      ? `${l.location_name} — ${addr}`
      : addr;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div>
            <Label className="text-xs">Job Title</Label>
            <Input
              className="mt-1"
              placeholder="Condenser Replacement"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          {/* Vertical */}
          <div>
            <Label className="text-xs">Trade Vertical</Label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6E45]"
              value={form.vertical}
              onChange={e => set('vertical', e.target.value)}
            >
              <option value="hvac">HVAC</option>
              <option value="electrical">Electrical</option>
              <option value="pipefitting">Pipefitting</option>
            </select>
          </div>

          {/* Customer — locked if prefilled */}
          {prefilledCustomerId ? (
            <div>
              <Label className="text-xs">Customer</Label>
              <div className="mt-1 w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                {prefilledCustomerName}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Customer</Label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6E45]"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Select customer...</option>
                {customers.map((c: any) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Service Location */}
          {effectiveCustomerId && (
            <div>
              <Label className="text-xs">Service Location</Label>
              {locations.length === 1 ? (
                // Auto-selected — show as locked field
                <div className="mt-1 w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                  📍 {locationLabel(locations[0])}
                </div>
              ) : (
                <select
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6E45]"
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                >
                  <option value="">Select location...</option>
                  {locations.map((l: any) => (
                    <option key={l.location_id} value={l.location_id}>
                      {locationLabel(l)}
                    </option>
                  ))}
                </select>
              )}
              {locations.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No service locations for this customer. Add one first.
                </p>
              )}
            </div>
          )}

          {/* Scope */}
          <div>
            <Label className="text-xs">Scope of Work (optional)</Label>
            <Textarea
              className="mt-1 min-h-[80px]"
              placeholder="Brief description of the work to be done..."
              value={form.scope_of_work}
              onChange={e => set('scope_of_work', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#1A6E45] hover:bg-[#145a38]"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create Job'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
