'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Home, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NewCustomerDialog } from '@/components/new-customer-dialog';

export default function CustomersPage() {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  });

  const customers = data?.customers || [];

  const filtered = search.trim()
    ? customers.filter((c: any) =>
        c.display_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.billing_city?.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} total</p>
        </div>
        <Button
          className="bg-[#1A6E45] hover:bg-[#145a38]"
          onClick={() => setShowNew(true)}
        >
          <Plus size={16} className="mr-2" />
          New Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, or city..."
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X size={13} className="text-gray-400" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading customers...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {search ? `No customers match "${search}"` : 'No customers yet'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((customer: any) => (
                <div
                  key={customer.customer_id}
                  onClick={() => router.push(`/dashboard/customers/${customer.customer_id}`)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      customer.customer_type === 'commercial'
                        ? 'bg-blue-50' : 'bg-[#E8F5EE]'
                    }`}>
                      {customer.customer_type === 'commercial'
                        ? <Building2 size={15} className="text-blue-600" />
                        : <Home size={15} className="text-[#1A6E45]" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{customer.display_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {customer.email || customer.phone || '—'}
                        {customer.billing_city && ` · ${customer.billing_city}, ${customer.billing_state}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    customer.customer_type === 'commercial'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-[#E8F5EE] text-[#1A6E45]'
                  }`}>
                    {customer.customer_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewCustomerDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
