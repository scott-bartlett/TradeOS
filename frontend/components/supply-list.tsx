'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, X, Plus, CheckCircle, Search } from 'lucide-react';

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
  const [filter, setFilter] = useState('');
  const [localApproved, setLocalApproved] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const descInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

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
      setSearchResults([]);
      setShowSearchResults(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        items.map(item =>
          jobsApi.updateSupplyItem(item.item_id, { is_approved: true })
        )
      );
    },
    onSuccess: () => {
      invalidate();
      setLocalApproved(true);
    },
  });

  const handleQtyBlur = (itemId: string) => {
    const qty = parseFloat(editingQtyValue);
    if (!isNaN(qty) && qty > 0) {
      qtyMutation.mutate({ itemId, quantity: qty });
    }
    setEditingQty(null);
  };

  // Search existing items as user types in the description field
  const handleDescChange = (value: string) => {
    setCustomDesc(value);
    if (value.trim().length >= 2) {
      const matches = items.filter(i =>
        i.description.toLowerCase().includes(value.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(value.toLowerCase()))
      );
      setSearchResults(matches);
      setShowSearchResults(matches.length > 0);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Dismiss search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(e.target as Node) &&
        descInputRef.current &&
        !descInputRef.current.contains(e.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCancelAdd = () => {
    setShowAdd(false);
    setCustomDesc('');
    setCustomQty('1');
    setCustomCost('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const isApproved = localApproved;

  const visibleItems = filter
    ? items.filter(i =>
        i.description.toLowerCase().includes(filter.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(filter.toLowerCase()))
      )
    : items;

  const totalCost = items.reduce(
    (sum, i) => sum + ((i.unit_cost || 0) * (i.quantity || 1)), 0
  );

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

        {/* Filter */}
        {items.length > 5 && (
          <div className="relative mb-3">
            <input
              type="text"
              value={filter}
              placeholder="Filter items..."
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] pr-8"
              onChange={e => setFilter(e.target.value)}
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X size={12} className="text-gray-400" />
              </button>
            )}
          </div>
        )}

        {/* Item list */}
        {visibleItems.map((item: any) => (
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

        {/* No results */}
        {filter && visibleItems.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">
            No items match "{filter}"
          </p>
        )}

        {/* Add item */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center gap-2 py-2 px-2 rounded-lg border border-dashed border-gray-200 hover:border-[#1A6E45] hover:bg-[#E8F5EE] transition-colors text-xs text-gray-400 hover:text-[#1A6E45] mt-2"
          >
            <Plus size={12} />
            Add item
          </button>
        ) : (
          <div className="space-y-2 pt-2 border-t border-gray-100 mt-2">

            {/* Description with live search */}
            <div className="relative">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={descInputRef}
                  autoFocus
                  type="text"
                  value={customDesc}
                  onChange={e => handleDescChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  placeholder="Search or describe item..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
                />
              </div>

              {/* Search results dropdown */}
              {showSearchResults && (
                <div
                  ref={searchResultsRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden"
                >
                  <p className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    Already on your list
                  </p>
                  {searchResults.map(item => (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-[#E8F5EE] cursor-pointer group/result"
                      onClick={() => {
                        // Scroll to the item in the list and close add form
                        setShowSearchResults(false);
                        setCustomDesc('');
                        setShowAdd(false);
                        // Briefly highlight by setting filter to the description
                        setFilter(item.description);
                        setTimeout(() => setFilter(''), 2000);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {item.description}
                        </p>
                        {item.sku && (
                          <p className="text-xs text-gray-400">{item.sku}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs text-gray-400">
                          {item.quantity} {item.unit}
                        </span>
                        <span className="text-xs text-[#1A6E45] opacity-0 group-hover/result:opacity-100">
                          Already added ✓
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-400">
                      Not what you need? Fill in the details below to add a new item.
                    </p>
                  </div>
                </div>
              )}
            </div>

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
                onClick={handleCancelAdd}
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
