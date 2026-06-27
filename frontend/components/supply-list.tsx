'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, X, Check, Plus, Search } from 'lucide-react';

interface Props {
  jobId: string;
  items: any[];
}

export function SupplyList({ jobId, items }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [customDesc, setCustomDesc] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customCost, setCustomCost] = useState('');
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supply-items', jobId] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, approved }: { itemId: string; approved: boolean }) =>
      jobsApi.updateSupplyItem(itemId, { is_approved: approved }),
    onSuccess: invalidate,
  });

  const qtyMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      jobsApi.updateSupplyItem(itemId, { quantity }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => jobsApi.deleteSupplyItem(itemId),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => jobsApi.addSupplyItem(jobId, data),
    onSuccess: () => {
      invalidate();
      setCustomDesc('');
      setCustomQty('1');
      setCustomCost('');
      setSearch('');
      setShowSearch(false);
    },
  });

  const confirmed = items.filter(i => i.is_approved);
  const unconfirmed = items.filter(i => !i.is_approved);

  // Filter unconfirmed items by search
  const filtered = search
    ? unconfirmed.filter(i =>
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(search.toLowerCase()))
      )
    : unconfirmed;

  const handleQtyBlur = (itemId: string) => {
    const qty = parseFloat(editingQtyValue);
    if (!isNaN(qty) && qty > 0) {
      qtyMutation.mutate({ itemId, quantity: qty });
    }
    setEditingQty(null);
  };

  const addFromSearch = (item: any) => {
    toggleMutation.mutate({ itemId: item.item_id, approved: true });
    setSearch('');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Package size={14} className="text-[#1A6E45]" />
          Supply List
          <span className="ml-auto text-xs font-normal text-gray-400">
            {confirmed.length} confirmed · {unconfirmed.length} pending
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Confirmed items */}
        {confirmed.length > 0 && (
          <div className="space-y-1">
            {confirmed.map((item: any) => (
              <div
                key={item.item_id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[#E8F5EE] group"
              >
                <button
                  onClick={() => toggleMutation.mutate({ itemId: item.item_id, approved: false })}
                  className="w-5 h-5 rounded-full bg-[#1A6E45] flex items-center justify-center flex-shrink-0 hover:bg-red-500 transition-colors"
                >
                  <Check size={10} className="text-white group-hover:hidden" />
                  <X size={10} className="text-white hidden group-hover:block" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.description}</p>
                  {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingQty === item.item_id ? (
                    <input
                      autoFocus
                      type="number"
                      value={editingQtyValue}
                      onChange={e => setEditingQtyValue(e.target.value)}
                      onBlur={() => handleQtyBlur(item.item_id)}
                      onKeyDown={e => e.key === 'Enter' && handleQtyBlur(item.item_id)}
                      className="w-12 text-xs text-center border border-[#1A6E45] rounded px-1 py-0.5"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingQty(item.item_id);
                        setEditingQtyValue(String(item.quantity));
                      }}
                      className="text-xs text-gray-600 hover:text-[#1A6E45] hover:underline min-w-[2rem] text-right"
                    >
                      {item.quantity} {item.unit}
                    </button>
                  )}
                  {item.unit_cost && (
                    <span className="text-xs text-gray-500 min-w-[3rem] text-right">
                      ${(item.unit_cost * item.quantity).toFixed(0)}
                    </span>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(item.item_id)}
                    className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                  >
                    <X size={10} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Divider if both sections have items */}
        {confirmed.length > 0 && unconfirmed.length > 0 && (
          <div className="border-t border-gray-100 pt-2">
            <p className="text-xs text-gray-400 mb-2">AI Suggestions — tap to confirm</p>
          </div>
        )}

        {/* Unconfirmed items */}
        {unconfirmed.length > 0 && (
          <div className="space-y-1">
            {(search ? filtered : unconfirmed).map((item: any) => (
              <div
                key={item.item_id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group cursor-pointer"
                onClick={() => toggleMutation.mutate({ itemId: item.item_id, approved: true })}
              >
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0 group-hover:border-[#1A6E45]">
                  <Check size={10} className="text-gray-300 group-hover:text-[#1A6E45]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 truncate">{item.description}</p>
                  {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{item.quantity} {item.unit}</span>
                  {item.unit_cost && (
                    <span className="text-xs text-gray-400">${item.unit_cost}</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(item.item_id);
                    }}
                    className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                  >
                    <X size={10} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search / Add section */}
        <div className="pt-2 border-t border-gray-100">
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-lg border border-dashed border-gray-300 hover:border-[#1A6E45] hover:bg-[#E8F5EE] transition-colors text-xs text-gray-500 hover:text-[#1A6E45]"
            >
              <Plus size={12} />
              Add item or search suggestions
            </button>
          ) : (
            <div className="space-y-2">
              {/* Search existing AI items */}
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search AI suggestions..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                />
              </div>

              {/* Search results */}
              {search && filtered.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {filtered.slice(0, 5).map(item => (
                    <button
                      key={item.item_id}
                      onClick={() => addFromSearch(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#E8F5EE] text-left border-b border-gray-100 last:border-0"
                    >
                      <Plus size={10} className="text-[#1A6E45] flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{item.description}</span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{item.quantity} {item.unit}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom item entry */}
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-400">Or add a custom item:</p>
                <input
                  type="text"
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  placeholder="Description"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={customQty}
                    onChange={e => setCustomQty(e.target.value)}
                    placeholder="Qty"
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                  />
                  <input
                    type="number"
                    value={customCost}
                    onChange={e => setCustomCost(e.target.value)}
                    placeholder="Unit cost $"
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
                    disabled={!customDesc || addMutation.isPending}
                    onClick={() => addMutation.mutate({
                      description: customDesc,
                      quantity: parseFloat(customQty) || 1,
                      unit_cost: customCost ? parseFloat(customCost) : null,
                      unit: 'ea',
                    })}
                  >
                    Add Item
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => {
                      setShowSearch(false);
                      setSearch('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {confirmed.length > 0 && (
          <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-gray-500">{confirmed.length} items confirmed</span>
            <span className="font-semibold text-gray-700">
              ${confirmed.reduce((sum, i) => sum + ((i.unit_cost || 0) * (i.quantity || 1)), 0).toFixed(2)} materials
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}