'use client';

import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus, Building2, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CustomersPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  });

  const customers = data?.customers || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} total</p>
        </div>
        <Button className="bg-[#1A6E45] hover:bg-[#145a38]">
          <Plus size={16} className="mr-2" />
          New Customer
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No customers yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {customers.map((customer: any) => (
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
    </div>
  );
}