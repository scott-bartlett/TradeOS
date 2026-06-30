'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NewJobDialog } from '@/components/new-job-dialog';

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

export default function JobsPage() {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
  });

  const jobs = data?.jobs || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{jobs.length} total</p>
        </div>
        <Button
          className="bg-[#1A6E45] hover:bg-[#145a38]"
          onClick={() => setShowNew(true)}
        >
          <Plus size={16} className="mr-2" />
          New Job
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No jobs yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {jobs.map((job: any) => (
                <div
                  key={job.job_id}
                  onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-[#E8F5EE] flex items-center justify-center flex-shrink-0">
                      <Briefcase size={15} className="text-[#1A6E45]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {job.customer_name && `${job.customer_name} · `}
                        {job.service_city && `${job.service_city} · `}
                        {job.vertical?.toUpperCase()}
                      </p>
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

      <NewJobDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
