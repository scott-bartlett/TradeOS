'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, X, Plus, CheckCircle } from 'lucide-react';

interface Props {
  jobId: string;
  items: any[];
}

export function SupplyList({ jobId, items }: Props) {
  const queryClient = useQueryClient();
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [customDesc, setCustomDesc] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customCost, setCustomCost] = useState('');
  const [approved, setApproved] = useState(items.some(i => i.is_approved));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['supply-items', jobId] });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => jobsApi.deleteSupplyItem(itemId),
    onSuccess: invalidate,
  });

  const qtyMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      jobsApi.updateSupplyItem(itemId, { quantity }),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => jobsApi.addSupplyItem(jobId, data),
    onSuccess: () => {
      invalidate();
      setCustomDesc('');
      setCustomQty('1');
      setCustomCost('');
      setShowAdd(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      // Approve all items at once
      await Promise.all(
        items.map(item =>
          jobsApi.updateSupplyItem(item.item_id, { is_approved: true })
        )
      );
    },
    onSuccess: () => {
      invalidate();
      setApproved(true);
    },
  });

  const handleQtyBlur = (itemId: string) => {
    const qty = parseFloat(editingQtyValue);
    if (!isNaN(qty) && qty > 0) {
      qtyMutation.mutate({ itemId, quantity: qty });
    }
    setEditingQty(null);
  };

  const totalCost = items.reduce(
    (sum, i) => sum + ((i.unit_cost || 0) * (i.quantity || 1)), 0
  );

  const isApproved = approved || items.every(i => i.is_approved);

  return (
    <Card className={isApproved ? 'border-green-200' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Package size={14} className="text-[#1A6E45]" />
          Supply List ({items.length} items)
          {isApproved && (
            <CheckCircle size={14} className="text-green-500 ml-auto" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">

        {/* Item list */}
        {items.map((item: any) => (
          <div
            key={item.item_id}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {item.description}
              </p>
              {item.sku && (
                <p className="text-xs text-gray-400">{item.sku}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Editable quantity */}
              {editingQty === item.item_id ? (
                <input
                  autoFocus
                  type="number"
                  value={editingQtyValue}
                  onChange={e => setEditingQtyValue(e.target.value)}
                  onBlur={() => handleQtyBlur(item.item_id)}
                  onKeyDown={e => e.key === 'Enter' && handleQtyBlur(item.item_id)}
                  className="w-14 text-xs text-center border border-[#1A6E45] rounded px-1 py-0.5"
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingQty(item.item_id);
                    setEditingQtyValue(String(item.quantity));
                  }}
                  className="text-xs text-gray-500 hover:text-[#1A6E45] hover:underline min-w-[3rem] text-right"
                >
                  {item.quantity} {item.unit}
                </button>
              )}
              {item.unit_cost && (
                <span className="text-xs text-gray-400 min-w-[3rem] text-right">
                  ${((item.unit_cost || 0) * (item.quantity || 1)).toFixed(0)}
                </span>
              )}
              <button
                onClick={() => deleteMutation.mutate(item.item_id)}
                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all flex-shrink-0"
              >
                <X size={11} className="text-red-400" />
              </button>
            </div>
          </div>
        ))}

        {/* Add item */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center gap-2 py-2 px-2 rounded-lg border border-dashed border-gray-200 hover:border-[#1A6E45] hover:bg-[#E8F5EE] transition-colors text-xs text-gray-400 hover:text-[#1A6E45] mt-2"
          >
            <Plus size={12} />
            Add custom item
          </button>
        ) : (
          <div className="space-y-2 pt-2 border-t border-gray-100 mt-2">
            <input
              autoFocus
              type="text"
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Item description"
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
                {addMutation.isPending ? 'Adding...' : 'Add Item'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                onClick={() => {
                  setShowAdd(false);
                  setCustomDesc('');
                  setCustomQty('1');
                  setCustomCost('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 mt-2">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-gray-500">{items.length} items</span>
            <span className="font-semibold text-gray-700">
              ${totalCost.toFixed(2)} materials
            </span>
          </div>

          {isApproved ? (
            <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-50">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-xs font-medium text-green-700">
                Supply list approved
              </span>
            </div>
          ) : (
            <Button
              className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || items.length === 0}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Supply List'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}