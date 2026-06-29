import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOfflineQueue } from './OfflineQueueContext';
import { MenuItem } from '../types';
import { Plus, Edit, Trash2, CheckSquare, Square, Search, Filter, Sparkles, Sliders, CheckCircle2, X, AlertTriangle } from 'lucide-react';

export const CentralizedMenuView: React.FC = () => {
  const {
    menu,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    tenants
  } = useOfflineQueue();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modals / Form states
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form input states
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [price, setPrice] = useState<number>(10);
  const [category, setCategory] = useState('BBQ');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [available, setAvailable] = useState(true);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [successToast, setSuccessToast] = useState('');

  // Custom menu item deletion confirmation modal state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    isOpen: boolean;
    item: MenuItem | null;
  }>({
    isOpen: false,
    item: null
  });

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setId('menu-' + Math.random().toString(36).substring(2, 9));
    setName('');
    setNameEn('');
    setPrice(10);
    setCategory('BBQ');
    setDescription('');
    setDescriptionEn('');
    setAvailable(true);
    // Default to all branches
    setAssignedBranches(tenants.map(t => t.id));
    setShowForm(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setId(item.id);
    setName(item.name);
    setNameEn(item.nameEn);
    setPrice(item.price);
    setCategory(item.category);
    setDescription(item.description || '');
    setDescriptionEn(item.descriptionEn || '');
    setAvailable(item.available);
    setAssignedBranches(item.assignedBranches || tenants.map(t => t.id));
    setShowForm(true);
  };

  const handleToggleBranch = (branchId: string) => {
    if (assignedBranches.includes(branchId)) {
      setAssignedBranches(assignedBranches.filter(id => id !== branchId));
    } else {
      setAssignedBranches([...assignedBranches, branchId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nameEn.trim()) {
      alert('請填寫完整中英文品項名稱！');
      return;
    }

    const itemPayload: MenuItem = {
      id,
      name: name.trim(),
      nameEn: nameEn.trim(),
      price: Number(price),
      category,
      description: description.trim() || undefined,
      descriptionEn: descriptionEn.trim() || undefined,
      available,
      assignedBranches
    };

    if (editingItem) {
      await updateMenuItem(itemPayload);
      triggerToast(`「${name}」修改成功並已發送分流同步信號！`);
    } else {
      await addMenuItem(itemPayload);
      triggerToast(`「${name}」新增成功，已分流至指定的 ${assignedBranches.length} 個店組！`);
    }

    setShowForm(false);
  };

  const handleDelete = (item: MenuItem) => {
    setDeleteConfirmItem({
      isOpen: true,
      item
    });
  };

  // Category filters
  const categories = ['All', 'BBQ', 'Appetizers', 'Beverages'];

  const filteredMenu = menu.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-24 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-xl border border-emerald-400 animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-indigo-400 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-400" />
            集團中央菜單分發中心 (Centralized Menu Hub)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            由 Super Admin 控制的中央總部：可在下方管理全集團菜單品項，並將特定餐點彈性分發至各實體分店 (Branches) 上架展示。
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 cursor-pointer self-start md:self-center"
        >
          <Plus className="h-4 w-4" />
          <span>新增餐點並分發</span>
        </button>
      </div>

      {/* Filters HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜尋餐點中文 / 英文 / 備註內容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-800 text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'All' ? '全部類別' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end text-[10.5px] text-slate-400 font-mono gap-1.5 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl">
          <Sliders className="h-3.5 w-3.5 text-indigo-400" />
          <span>集團菜單池計：{menu.length} 個品項 (已過濾出 {filteredMenu.length} 個)</span>
        </div>
      </div>

      {/* Grid of Central Menu Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMenu.map(item => (
          <div
            key={item.id}
            className={`bg-slate-950/60 border rounded-2xl p-5 hover:border-indigo-500/40 transition-all flex flex-col justify-between group relative overflow-hidden ${
              item.available ? 'border-slate-800' : 'border-red-950 opacity-60'
            }`}
          >
            {/* Top Tag & Category */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] bg-slate-800 px-2.5 py-0.5 rounded-full font-black text-slate-300 uppercase tracking-wider">
                  {item.category}
                </span>
                <span className="text-[11px] font-extrabold text-indigo-400 font-mono">
                  ${item.price}
                </span>
              </div>

              {/* Names */}
              <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">
                {item.name}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5 font-mono">
                {item.nameEn}
              </p>

              {/* Description */}
              {item.description && (
                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}

              {/* Branch Distribution HUD */}
              <div className="mt-4 border-t border-slate-900 pt-3.5">
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2">
                  已上架分店 (Branch Scope)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tenants.map(t => {
                    const isDistributed = item.assignedBranches?.includes(t.id);
                    return (
                      <span
                        key={t.id}
                        className={`text-[9.5px] px-2 py-0.5 rounded-lg font-bold border transition-all ${
                          isDistributed
                            ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
                            : 'bg-slate-950 border-slate-900 text-slate-600 line-through'
                        }`}
                      >
                        {t.name.split(' - ')[1] || t.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between border-t border-slate-900 pt-4 mt-5">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                item.available
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30'
                  : 'bg-red-950 text-red-400 border border-red-900/30'
              }`}>
                {item.available ? '營運中 (Active)' : '暫停供應 (Disabled)'}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="編輯餐點配置與分流"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="完全刪除此餐點"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Central Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6.5 shadow-2xl relative">
            <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              {editingItem ? '編輯餐點與分發配置' : '新增餐點與分發分店'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Row 1: Name & Eng */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1.5">品項中文名稱 *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：泰式香烤松阪豬"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1.5">英文品項名稱 *</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Grilled Pork Neck"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Price & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1.5">定價 ($ USD) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1.5">餐點類別 *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="BBQ">BBQ (精選燒烤)</option>
                    <option value="Appetizers">Appetizers (精緻開胃菜)</option>
                    <option value="Beverages">Beverages (泰式特調飲品)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Description */}
              <div>
                <label className="block text-[11px] text-slate-400 font-bold mb-1.5">中文描述 (選填)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="請輸入餐點說明與成分調味特色..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white h-16 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-bold mb-1.5">英文描述 (選填)</label>
                <textarea
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="Enter English description..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white h-16 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Available Check */}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="form-avail"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="h-4 w-4 bg-slate-950 border-slate-800 text-indigo-500 rounded focus:ring-0"
                />
                <label htmlFor="form-avail" className="text-xs font-bold text-slate-300 cursor-pointer">
                  此商品立即可用 / 上架狀態 (Active)
                </label>
              </div>

              {/* Branch Selector Section */}
              <div className="border-t border-slate-800 pt-3.5">
                <span className="block text-[11px] text-slate-400 font-black uppercase tracking-wider mb-2">
                  分流分發目標 (Select Target Branches to Distribute) *
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tenants.map(t => {
                    const isChecked = assignedBranches.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => handleToggleBranch(t.id)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                          isChecked
                            ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200'
                            : 'bg-slate-950 border-slate-850 text-slate-500'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-black">{t.name}</span>
                          <span className="text-[9.5px] opacity-70 font-mono">{t.id}</span>
                        </div>
                        {isChecked ? (
                          <CheckSquare className="h-4.5 w-4.5 text-indigo-400 flex-shrink-0 ml-2" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-700 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {assignedBranches.length === 0 && (
                  <p className="text-[10px] text-rose-400 font-extrabold mt-1.5">
                    ⚠️ 請至少勾選一個店組，否則此商品將無法顯示在任何點餐頁面！
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={assignedBranches.length === 0}
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white transition-all shadow-md ${
                    assignedBranches.length === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-indigo-600/10'
                  }`}
                >
                  確認並儲存發佈
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: DELETE MENU ITEM CONFIRMATION */}
      <AnimatePresence>
        {deleteConfirmItem.isOpen && deleteConfirmItem.item && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setDeleteConfirmItem({ isOpen: false, item: null })}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-3 text-red-400 mb-2">
                <div className="bg-red-500/15 p-2 rounded-xl border border-red-500/30">
                  <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
                </div>
                <h2 className="text-lg font-black text-slate-100">
                  確認刪除菜單品項？
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                您確定要刪除「<span className="text-slate-100 font-bold">{deleteConfirmItem.item.name}</span>」嗎？
              </p>

              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 mb-6 space-y-2 leading-relaxed">
                <h4 className="font-bold">⚠️ 重要影響：</h4>
                <p>此動作將會立即將該商品從 **所有分店/店組** 的點餐菜單中徹底撤除與下架。分店端的顧客與收銀人員將立刻無法再點選此菜單品項！</p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem({ isOpen: false, item: null })}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetItem = deleteConfirmItem.item;
                    if (targetItem) {
                      try {
                        await deleteMenuItem(targetItem.id);
                        triggerToast(`「${targetItem.name}」已完全下架。`);
                      } catch (err: any) {
                        alert('下架失敗: ' + err.message);
                      }
                    }
                    setDeleteConfirmItem({ isOpen: false, item: null });
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>確認永久刪除</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
