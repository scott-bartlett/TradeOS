'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { customersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Building2, Home, MapPin, Phone, Mail } from 'lucide-react';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const customerId = id as string;

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading customer...</div>;
  }

  if (!customer) {
    return <div className="p-6 text-sm text-red-500">Customer not found</div>;
  }

  const isCommercial = customer.customer_type === 'commercial';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          <ArrowLeft size={15} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-3">
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
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left — contact info */}
        <div className="col-span-2 space-y-5">

          {/* Contact */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isCommercial && customer.company_name && (
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{customer.company_name}</span>
                </div>
              )}
              {(customer.first_name || customer.last_name) && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    {customer.first_name} {customer.last_name}
                    {isCommercial && <span className="text-gray-400 ml-1">(primary contact)</span>}
                  </span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{customer.phone}</span>
                </div>
              )}
              {customer.mobile && customer.mobile !== customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{customer.mobile} (mobile)</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Address */}
          {customer.billing_street && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Billing Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-gray-400 mt-0.5" />
                  <div className="text-sm text-gray-700">
                    <p>{customer.billing_street}</p>
                    <p>{customer.billing_city}, {customer.billing_state} {customer.billing_zip}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service Locations */}
          {customer.service_locations?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Service Locations ({customer.service_locations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {customer.service_locations.map((loc: any) => (
                    <div key={loc.location_id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {loc.location_name || loc.street}
                        </p>
                        {!loc.is_active && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin size={12} className="text-gray-400 mt-0.5" />
                        <p className="text-xs text-gray-600">
                          {loc.street}, {loc.city}, {loc.state} {loc.zip_code}
                        </p>
                      </div>
                      {loc.contact_name && (
                        <p className="text-xs text-gray-500">Contact: {loc.contact_name} {loc.contact_phone && `· ${loc.contact_phone}`}</p>
                      )}
                      {loc.access_notes && (
                        <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                          🔑 {loc.access_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {customer.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{customer.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — meta */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Type', customer.customer_type],
                ['Status', customer.is_active ? 'Active' : 'Inactive'],
                ['QB ID', customer.quickbooks_id || 'Not synced'],
                ['Since', new Date(customer.created_at).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-700 capitalize">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}