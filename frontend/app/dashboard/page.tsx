'use client';

import { useQuery } from '@tanstack/react-query';
import { jobsApi, invoicesApi, vanInventoryApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, DollarSign, AlertTriangle, 
  CheckCircle, Clock, Package
} from 'lucide-react';

export default function DashboardPage() {
  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const jobs = jobsData?.jobs || [];
  const invoices = invoicesData?.invoices || [];

  // Derived metrics
  const openJobs     = jobs.filter((j: any) => 
    ['estimate','approved','scheduled','in_progress'].includes(j.status)).length;
  const completedToday = jobs.filter((j: any) => j.status === 'complete').length;
  const sentInvoices   = invoices.filter((i: any) => i.status === 'sent');
  const totalOutstanding = sentInvoices.reduce(
    (sum: number, i: any) => sum + (i.total_amount || 0), 0
  );
  const overdueInvoices = invoices.filter((i: any) => {
    if (i.status !== 'sent' || !i.due_date) return false;
    return new Date(i.due_date) < new Date();
  });

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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', 
            month: 'long', day: 'numeric' 
          })}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Open Jobs</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{openJobs}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Briefcase size={18} className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  ${totalOutstanding.toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign size={18} className="text-[#1A6E45]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Overdue</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{overdueInvoices.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Complete</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{completedToday}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Active Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No jobs yet</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job: any) => (
                <div
                  key={job.job_id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/jobs/${job.job_id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-[#E8F5EE] flex items-center justify-center">
                      <Briefcase size={14} className="text-[#1A6E45]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-400">{job.job_number}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[job.status] || 'bg-gray-100 text-gray-600'}`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 5).map((inv: any) => (
                <div
                  key={inv.invoice_id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center">
                      <DollarSign size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400">
                        {inv.sent_at 
                          ? `Sent ${new Date(inv.sent_at).toLocaleDateString()}` 
                          : 'Draft'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      ${(inv.total_amount || 0).toLocaleString()}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}