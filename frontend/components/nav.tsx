'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Wrench,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard',           label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/jobs',      label: 'Jobs',       icon: Briefcase },
  { href: '/dashboard/customers', label: 'Customers',  icon: Users },
  { href: '/dashboard/invoices',  label: 'Invoices',   icon: FileText },
  { href: '/dashboard/field',     label: 'Field App',  icon: Wrench },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col w-56 min-h-screen bg-[#1e2d24] text-white">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
        <div className="w-7 h-7 rounded-md bg-[#1A6E45] flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">TradeOS</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-[#1A6E45] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="text-xs text-white/40">HVAC Vertical · Pilot</div>
        <div className="text-xs text-white/60 font-medium mt-1">Jamie (Owner)</div>
      </div>
    </div>
  );
}