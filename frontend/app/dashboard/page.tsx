'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { jobsApi, invoicesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Briefcase, DollarSign, AlertTriangle,
  CheckCircle, Sparkles, ChevronRight,
  RefreshCw, Circle
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const {
    data: flagsData,
    isPending: flagsLoading,
    mutate: loadFlags
  } = useMutation({
    mutationFn: () => jobsApi.generateFlags(),
  });

  const jobs = jobsData?.jobs || [];
  const invoices = invoicesData?.invoices || [];
  const flags = flagsData?.flags || [];

  const openJobs = jobs.filter((j: any) =>
  ['estimate', 'approved', 'scheduled', 'in_progress', 'invoiced'].includes(j.status)).length;
  const completedJobs = jobs.filter((j: any) => j.status === 'complete' || j.status === 'paid').length;
  const sentInvoices = invoices.filter((i: any) => i.status === 'sent');
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

  const flagColor: Record<string, string> = {
    high:   'border-red-300 bg-red-50',
    medium: 'border-amber-300 bg-amber-50',
    low:    'border-blue-200 bg-blue-50',
  };

  const flagTitleColor: Record<string, string> = {
    high:   'text-red-700',
    medium: 'text-amber-700',
    low:    'text-blue-700',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric',
              month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <Button
          onClick={() => loadFlags()}
          disabled={flagsLoading}
          className="bg-[#1A6E45] hover:bg-[#145a38]"
        >
          {flagsLoading
            ? <><RefreshCw size={14} className="mr-2 animate-spin" /> Analyzing...</>
            : <><Sparkles size={14} className="mr-2" /> Run AI Analysis</>
          }
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/dashboard/jobs')}
        >
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

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/dashboard/invoices')}
        >
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

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/dashboard/invoices')}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Overdue</p>
                <p className={`text-3xl font-bold mt-1 ${overdueInvoices.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {overdueInvoices.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/dashboard/jobs')}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Complete</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{completedJobs}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left — jobs + invoices */}
        <div className="col-span-2 space-y-5">

          {/* AI Flags */}
          {flags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Sparkles size={14} className="text-[#1A6E45]" />
                  TradeOS Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {flags.map((flag: any, i: number) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 ${flagColor[flag.priority] || 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${flagTitleColor[flag.priority] || 'text-gray-600'}`}>
                          {flag.title}
                        </p>
                        <p className="text-sm text-gray-700">{flag.message}</p>
                        {flag.reasoning && (
                          <p className="text-xs text-gray-500 mt-1 italic">{flag.reasoning}</p>
                        )}
                        {flag.suggested_action && (
                          <p className="text-xs font-medium text-[#1A6E45] mt-2">
                            → {flag.suggested_action}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {flagsLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-3 text-gray-400">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Claude is analyzing your business data...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Jobs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Active Jobs</CardTitle>
                <button
                  onClick={() => router.push('/dashboard/jobs')}
                  className="text-xs text-[#1A6E45] hover:underline"
                >
                  View all
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 px-5">No jobs yet</p>
              ) : (
                <div>
                  {jobs.slice(0, 5).map((job: any) => (
                    <div
                      key={job.job_id}
                      onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-[#E8F5EE] flex items-center justify-center">
                          <Briefcase size={12} className="text-[#1A6E45]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{job.title}</p>
                          <p className="text-xs text-gray-400">{job.job_number}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[job.status] || 'bg-gray-100 text-gray-600'}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Recent Invoices</CardTitle>
                <button
                  onClick={() => router.push('/dashboard/invoices')}
                  className="text-xs text-[#1A6E45] hover:underline"
                >
                  View all
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 px-5">No invoices yet</p>
              ) : (
                <div>
                  {invoices.slice(0, 5).map((inv: any) => (
                    <div
                      key={inv.invoice_id}
                      onClick={() => router.push(`/dashboard/invoices/${inv.invoice_id}`)}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                          <DollarSign size={12} className="text-blue-600" />
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
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
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

        {/* Right — suggested actions */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Suggested Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {flags.length === 0 ? (
                <div className="text-center py-4">
                  <Sparkles size={20} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    Click "Run AI Analysis" to get personalized suggestions
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {flags.map((flag: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCheckedActions(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="w-full flex items-start gap-3 text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
                    >
                      {checkedActions[i]
                        ? <CheckCircle size={15} className="text-[#1A6E45] flex-shrink-0 mt-0.5" />
                        : <Circle size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
                      }
                      <span className={`text-xs leading-relaxed ${checkedActions[i] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {flag.suggested_action}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Total Jobs',     jobs.length],
                ['Total Invoices', invoices.length],
                ['Invoiced',       invoices.filter((i: any) => i.status === 'sent').length],
                ['Paid',           invoices.filter((i: any) => i.status === 'paid').length],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-bold text-gray-800">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}F