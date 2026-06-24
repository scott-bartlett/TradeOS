'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewCustomerDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer_type: 'residential',
    display_name: '',
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    billing_street: '',
    billing_city: '',
    billing_state: '',
    billing_zip: '',
  });

  const mutation = useMutation({
    mutationFn: () => customersApi.create(form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onClose();
      // Reset form
      setForm({
        customer_type: 'residential',
        display_name: '',
        first_name: '',
        last_name: '',
        company_name: '',
        email: '',
        phone: '',
        billing_street: '',
        billing_city: '',
        billing_state: '',
        billing_zip: '',
      });
    },
  });

  const set = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isCommercial = form.customer_type === 'commercial';

  // Auto-build display name
  const handleNameChange = (key: string, value: string) => {
    set(key, value);
    if (!isCommercial) {
      const first = key === 'first_name' ? value : form.first_name;
      const last = key === 'last_name' ? value : form.last_name;
      set('display_name', `${first} ${last}`.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Type */}
          <div>
            <Label className="text-xs">Customer Type</Label>
            <Select value={form.customer_type} onValueChange={v => set('customer_type', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Commercial fields */}
          {isCommercial && (
            <div>
              <Label className="text-xs">Company Name</Label>
              <Input
                className="mt-1"
                placeholder="Apex Property Management"
                value={form.company_name}
                onChange={e => {
                  set('company_name', e.target.value);
                  set('display_name', e.target.value);
                }}
              />
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{isCommercial ? 'Contact First Name' : 'First Name'}</Label>
              <Input
                className="mt-1"
                placeholder="Linda"
                value={form.first_name}
                onChange={e => handleNameChange('first_name', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{isCommercial ? 'Contact Last Name' : 'Last Name'}</Label>
              <Input
                className="mt-1"
                placeholder="Calloway"
                value={form.last_name}
                onChange={e => handleNameChange('last_name', e.target.value)}
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                className="mt-1"
                type="email"
                placeholder="linda@email.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                className="mt-1"
                placeholder="(253) 555-0182"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <Label className="text-xs">Billing Street</Label>
            <Input
              className="mt-1"
              placeholder="2847 Ridgewood Ct"
              value={form.billing_street}
              onChange={e => set('billing_street', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs">City</Label>
              <Input
                className="mt-1"
                placeholder="Tacoma"
                value={form.billing_city}
                onChange={e => set('billing_city', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Input
                className="mt-1"
                placeholder="WA"
                value={form.billing_state}
                onChange={e => set('billing_state', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">ZIP</Label>
              <Input
                className="mt-1"
                placeholder="98405"
                value={form.billing_zip}
                onChange={e => set('billing_zip', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#1A6E45] hover:bg-[#145a38]"
            onClick={() => mutation.mutate()}
            disabled={!form.display_name || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create Customer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}