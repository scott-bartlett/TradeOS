'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StateSelect, ZipInput } from '@/components/address-inputs';

interface Props {
  open: boolean;
  onClose: () => void;
}

const emptyForm = {
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
  location_name: '',
  location_contact_name: '',
  location_contact_phone: '',
  location_street: '',
  location_city: '',
  location_state: '',
  location_zip: '',
  access_notes: '',
};

export function NewCustomerDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });

  const set = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isCommercial = form.customer_type === 'commercial';

  const handleNameChange = (key: string, value: string) => {
    set(key, value);
    if (!isCommercial) {
      const first = key === 'first_name' ? value : form.first_name;
      const last  = key === 'last_name'  ? value : form.last_name;
      set('display_name', `${first} ${last}`.trim());
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const customer = await customersApi.create({
        customer_type:  form.customer_type,
        display_name:   form.display_name,
        first_name:     form.first_name   || null,
        last_name:      form.last_name    || null,
        company_name:   form.company_name || null,
        email:          form.email        || null,
        phone:          form.phone        || null,
        billing_street: form.billing_street || null,
        billing_city:   form.billing_city   || null,
        billing_state:  form.billing_state  || null,
        billing_zip:    form.billing_zip    || null,
      });

      if (isCommercial) {
        await customersApi.addLocation(customer.customer_id, {
          location_name:  form.location_name || form.company_name,
          contact_name:   form.location_contact_name  || null,
          contact_phone:  form.location_contact_phone || null,
          street:         form.location_street || form.billing_street,
          city:           form.location_city   || form.billing_city,
          state:          form.location_state  || form.billing_state,
          zip_code:       form.location_zip    || form.billing_zip,
          access_notes:   form.access_notes    || null,
        });
      } else {
        if (form.billing_street) {
          await customersApi.addLocation(customer.customer_id, {
            location_name:  `${form.first_name} ${form.last_name}`.trim(),
            contact_name:   `${form.first_name} ${form.last_name}`.trim(),
            contact_phone:  form.phone || null,
            street:         form.billing_street,
            city:           form.billing_city,
            state:          form.billing_state,
            zip_code:       form.billing_zip,
            access_notes:   null,
          });
        }
      }

      return customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setForm({ ...emptyForm });
      onClose();
    },
  });

  const validZip = (zip: string) => /^\d{5}(-\d{4})?$/.test(zip);

  const canSubmit = form.display_name &&
    form.billing_street &&
    form.billing_city &&
    form.billing_state &&
    validZip(form.billing_zip) && (
      isCommercial
        ? form.location_street && form.location_city &&
          form.location_state && validZip(form.location_zip)
        : true
    );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Type */}
          <div>
            <Label className="text-xs">Customer Type</Label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6E45]"
              value={form.customer_type}
              onChange={e => set('customer_type', e.target.value)}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          {isCommercial && (
            <div>
              <Label className="text-xs">Company Name</Label>
              <Input
                className="mt-1"
                placeholder="Company Name"
                value={form.company_name}
                onChange={e => {
                  set('company_name', e.target.value);
                  set('display_name', e.target.value);
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{isCommercial ? 'Contact First Name' : 'First Name'}</Label>
              <Input
                className="mt-1"
                placeholder="First Name"
                value={form.first_name}
                onChange={e => handleNameChange('first_name', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{isCommercial ? 'Contact Last Name' : 'Last Name'}</Label>
              <Input
                className="mt-1"
                placeholder="Last Name"
                value={form.last_name}
                onChange={e => handleNameChange('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input className="mt-1" type="email" placeholder="email@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input className="mt-1" placeholder="(555) 000-0000"
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>

          {/* Billing address */}
          <div>
            <Label className="text-xs">{isCommercial ? 'Billing Address' : 'Address'} *</Label>
            <Input className="mt-1" placeholder="123 Main St"
              value={form.billing_street} onChange={e => set('billing_street', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs">City *</Label>
              <Input className="mt-1" placeholder="City"
                value={form.billing_city} onChange={e => set('billing_city', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">State *</Label>
              <StateSelect
                className="mt-1 w-full"
                value={form.billing_state}
                onChange={v => set('billing_state', v)}
              />
            </div>
            <div>
              <Label className="text-xs">ZIP *</Label>
              <ZipInput
                className="mt-1 w-full"
                value={form.billing_zip}
                onChange={v => set('billing_zip', v)}
              />
            </div>
          </div>

          {/* Commercial service location */}
          {isCommercial && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">First Service Location</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Location Name</Label>
                  <Input className="mt-1" placeholder="Riverside Plaza"
                    value={form.location_name} onChange={e => set('location_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">On-site Contact</Label>
                    <Input className="mt-1" placeholder="Name"
                      value={form.location_contact_name}
                      onChange={e => set('location_contact_name', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Contact Phone</Label>
                    <Input className="mt-1" placeholder="(555) 000-0000"
                      value={form.location_contact_phone}
                      onChange={e => set('location_contact_phone', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Service Address *</Label>
                  <Input className="mt-1" placeholder="1200 Riverside Dr"
                    value={form.location_street}
                    onChange={e => set('location_street', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label className="text-xs">City *</Label>
                    <Input className="mt-1" placeholder="City"
                      value={form.location_city}
                      onChange={e => set('location_city', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">State *</Label>
                    <StateSelect
                      className="mt-1 w-full"
                      value={form.location_state}
                      onChange={v => set('location_state', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ZIP *</Label>
                    <ZipInput
                      className="mt-1 w-full"
                      value={form.location_zip}
                      onChange={v => set('location_zip', v)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Access Notes (optional)</Label>
                  <Textarea className="mt-1 min-h-[60px]"
                    placeholder="Gate code 4821. Call Maria on arrival."
                    value={form.access_notes}
                    onChange={e => set('access_notes', e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#1A6E45] hover:bg-[#145a38]"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create Customer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
