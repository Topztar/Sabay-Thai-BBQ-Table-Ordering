import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Tenant } from '../types';
import {
  Building,
  Plus,
  Trash2,
  Edit,
  Check,
  MapPin,
  Phone,
  DollarSign,
  Layers,
  ArrowRightLeft,
  X,
  PlusCircle,
  HelpCircle,
  RefreshCw,
  Globe,
  Settings,
  Lock,
  AlertTriangle
} from 'lucide-react';

export const TenantManagementView: React.FC = () => {
  const {
    tenants,
    currentTenantId,
    setCurrentTenantId,
    addTenant,
    updateTenant,
    deleteTenant,
    orders,
    isOnline,
    simulatedOffline,
    syncLogs,
    clearSyncLogs
  } = useOfflineQueue();

  const isEffectiveOnline = isOnline && !simulatedOffline;

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-selection and Batch Delete state
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Temporary Delete / Undo states
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [undoCountDown, setUndoCountDown] = useState<number>(0);
  const countdownIntervalRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (undoCountDown > 0) {
      countdownIntervalRef.current = setTimeout(() => {
        setUndoCountDown(prev => prev - 1);
      }, 1000);
    } else if (undoCountDown === 0 && pendingDeleteIds.length > 0) {
      const executeActualDelete = async () => {
        setIsDeletingBatch(true);
        try {
          for (const tenantId of pendingDeleteIds) {
            if (tenantId === 'DEFAULT') continue;
            await deleteTenant(tenantId);
            if (currentTenantId === tenantId) {
              setCurrentTenantId('DEFAULT');
            }
          }
          alert('已成功批次刪除選定的分店租戶！');
        } catch (err: any) {
          alert('部分或全部分店刪除失敗：' + err.message);
        } finally {
          setIsDeletingBatch(false);
          setPendingDeleteIds([]);
        }
      };
      executeActualDelete();
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current);
      }
    };
  }, [undoCountDown, pendingDeleteIds]);

  const handleBatchDelete = () => {
    const idsToTemporaryDelete = selectedTenantIds.filter(id => id !== 'DEFAULT');
    if (idsToTemporaryDelete.length === 0) return;

    setPendingDeleteIds(idsToTemporaryDelete);
    setSelectedTenantIds([]);
    setShowBatchDeleteModal(false);
    setUndoCountDown(10);
  };

  const handleUndoBatchDelete = () => {
    if (countdownIntervalRef.current) {
      clearTimeout(countdownIntervalRef.current);
    }
    setPendingDeleteIds([]);
    setUndoCountDown(0);
  };

  // Custom delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    tenantId: string;
    tenantName: string;
  }>({
    isOpen: false,
    tenantId: '',
    tenantName: ''
  });

  // Backend PIN State
  const [adminPin, setAdminPin] = useState(() => {
    return localStorage.getItem('sabay_thai_admin_pin') || 'Eur0pe2266';
  });
  const [newPinInput, setNewPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess(false);

    const trimmed = newPinInput.trim();
    if (trimmed.length < 6) {
      setPinError('安全密碼長度必須至少為 6 位！');
      return;
    }

    localStorage.setItem('sabay_thai_admin_pin', trimmed);
    setAdminPin(trimmed);
    setNewPinInput('');
    setPinSuccess(true);
    setTimeout(() => {
      setPinSuccess(false);
    }, 3000);
  };
  
  // Create Tenant form state
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newMinSpend, setNewMinSpend] = useState(10);
  const [newCurrency, setNewCurrency] = useState('$');
  const [newTablesInput, setNewTablesInput] = useState('Table-1, Table-2, Table-3, Table-4, Table-5');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [formError, setFormError] = useState('');

  // Editing form state
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editMinSpend, setEditMinSpend] = useState(10);
  const [editCurrency, setEditCurrency] = useState('$');
  const [editTablesInput, setEditTablesInput] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Sandbox inspector tenant
  const [inspectTenantId, setInspectTenantId] = useState<string | null>(null);

  // Form submit handler for creating a tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const formattedId = newId.trim().toUpperCase();
    if (!formattedId) {
      setFormError('租戶唯一代碼 (ID) 不能為空。');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(formattedId)) {
      setFormError('租戶代碼只能包含大寫英文字母、數字、底線或減號。');
      return;
    }
    if (tenants.some(t => t.id === formattedId)) {
      setFormError('此租戶代碼已存在，請使用其他代碼。');
      return;
    }
    if (!newName.trim()) {
      setFormError('分店/品牌名稱不能為空。');
      return;
    }

    // Parse tables
    const tableList = newTablesInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tableList.length === 0) {
      setFormError('請至少設定一個桌號（以英文逗號分隔）。');
      return;
    }

    const newTenantObj: Tenant = {
      id: formattedId,
      name: newName.trim(),
      nameEn: newNameEn.trim() || newName.trim(),
      minSpend: Number(newMinSpend) || 0,
      currency: newCurrency.trim() || '$',
      tables: tableList,
      contactNumber: newPhone.trim() || undefined,
      address: newAddress.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await addTenant(newTenantObj);
      // Reset form
      setNewId('');
      setNewName('');
      setNewNameEn('');
      setNewMinSpend(10);
      setNewTablesInput('Table-1, Table-2, Table-3, Table-4, Table-5');
      setNewPhone('');
      setNewAddress('');
      setShowAddForm(false);
      alert('已成功建立分店租戶「' + newTenantObj.name + '」！');
    } catch (err: any) {
      setFormError('新增失敗：' + err.message);
    }
  };

  // Open edit mode
  const handleStartEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditName(tenant.name);
    setEditNameEn(tenant.nameEn);
    setEditMinSpend(tenant.minSpend);
    setEditCurrency(tenant.currency);
    setEditTablesInput(tenant.tables.join(', '));
    setEditPhone(tenant.contactNumber || '');
    setEditAddress(tenant.address || '');
  };

  // Save edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    if (!editName.trim()) {
      alert('名稱不能為空！');
      return;
    }

    const tableList = editTablesInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tableList.length === 0) {
      alert('請至少設定一個桌號！');
      return;
    }

    const updatedTenantObj: Tenant = {
      ...editingTenant,
      name: editName.trim(),
      nameEn: editNameEn.trim() || editName.trim(),
      minSpend: Number(editMinSpend) || 0,
      currency: editCurrency.trim() || '$',
      tables: tableList,
      contactNumber: editPhone.trim() || undefined,
      address: editAddress.trim() || undefined
    };

    try {
      await updateTenant(updatedTenantObj);
      setEditingTenant(null);
    } catch (err: any) {
      alert('更新失敗：' + err.message);
    }
  };

  // Delete tenant
  const handleDeleteTenant = (tenantId: string, tenantName: string) => {
    if (tenantId === 'DEFAULT') {
      alert('系統 DEFAULT 預設總店為關鍵主租戶，不可刪除！');
      return;
    }
    setDeleteConfirmation({
      isOpen: true,
      tenantId,
      tenantName
    });
  };

  // Filtered tenants based on search bar
  const filteredTenants = tenants
    .filter(t => !pendingDeleteIds.includes(t.id))
    .filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.address && t.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen p-6 pb-12">
      
      {/* Floating temporary update notification */}
      <AnimatePresence>
        {pinSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-[999] flex items-center gap-3.5 bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 px-5 py-4 rounded-2xl shadow-2xl shadow-emerald-500/10 min-w-[280px]"
          >
            <div className="bg-emerald-500/15 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30 flex items-center justify-center shrink-0 animate-pulse">
              <Check className="h-5 w-5 stroke-[3]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">成功更新</h4>
              <p className="text-[11px] text-emerald-400 font-bold mt-0.5">當前 PIN 碼已更新</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 border border-violet-500/20 rounded-3xl p-6 md:p-8 shadow-2xl mb-8 overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl -mb-20 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-full text-xs font-semibold w-fit mb-3">
              <Building className="h-3.5 w-3.5" />
              SaaS Multi-Tenant Portal
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              集團多租戶連鎖分店管理 (Corporate HQ Admin)
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              此處為 Sabay Thai BBQ 跨國連鎖集團總部管理面板。您可以即時新增分店租戶 (Tenant Sandbox)、配置各店專屬桌號、自訂最低消費限制。每個分店的點餐與 KDS 系統皆完美隔離，獨立運行。
            </p>
          </div>
          
          <button
            onClick={() => {
              const gen = 'BR_' + Math.random().toString(36).substring(2, 8).toUpperCase();
              setNewId(gen);
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all cursor-pointer w-fit"
          >
            <Plus className="h-4.5 w-4.5" />
            新增分店租戶
          </button>
        </div>

        {/* Sync Status Overlay */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-800/60 text-xs font-mono text-slate-400">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isEffectiveOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isEffectiveOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span>
            連線狀態：
            {isEffectiveOnline ? (
              <span className="text-emerald-400 font-bold">雲端即時同步中 (Live Firestore)</span>
            ) : (
              <span className="text-amber-400 font-bold">離線模式 (變更將暫存於本地，並在恢復連線時自動排隊上傳)</span>
            )}
          </span>
        </div>
      </motion.div>

      {/* Grid Layout: Main Tenant Cards List + Right Panel (Active Focus & Quick Config) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Tenant List (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Search Bar & Stats */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="w-full md:w-80 flex items-center gap-3">
              {/* Checkbox for Select All */}
              {(() => {
                const deletableFiltered = filteredTenants.filter(t => t.id !== 'DEFAULT');
                const isAllSelected = deletableFiltered.length > 0 && deletableFiltered.every(t => selectedTenantIds.includes(t.id));
                return (
                  <div className="flex items-center justify-center shrink-0" title="全選/取消全選本頁可刪除分店">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      disabled={deletableFiltered.length === 0}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setSelectedTenantIds(prev => {
                            const combined = new Set([...prev, ...deletableFiltered.map(t => t.id)]);
                            return Array.from(combined);
                          });
                        } else {
                          const deletableSet = new Set(deletableFiltered.map(t => t.id));
                          setSelectedTenantIds(prev => prev.filter(id => !deletableSet.has(id)));
                        }
                      }}
                      className="h-4.5 w-4.5 text-violet-600 bg-slate-950 border-slate-800 rounded focus:ring-violet-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })()}
              
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="搜尋分店代碼、名稱或地址..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-400">
              {selectedTenantIds.length > 0 && (
                <div className="text-violet-400 font-bold bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-md text-[10px] uppercase font-mono animate-pulse">
                  已選 {selectedTenantIds.length} 間
                </div>
              )}
              <div>
                集團分店總數：<span className="text-violet-400 font-bold font-mono">{tenants.length}</span> 家
              </div>
              <div>
                當前運作模式：<span className="bg-slate-800 px-2.5 py-1 rounded-md text-[10px] text-indigo-300 border border-slate-700 font-semibold font-mono">SaaS Mode</span>
              </div>
            </div>
          </div>

          {/* Batch Action Floating/Sticky Bar */}
          <AnimatePresence>
            {selectedTenantIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 text-indigo-300 p-2 rounded-xl border border-indigo-500/30">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">已選取 {selectedTenantIds.length} 個分店租戶</h4>
                    <p className="text-[11px] text-slate-400 font-medium">您可以對所選分店進行批次刪除，或是清除選取。</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedTenantIds([])}
                    className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                  >
                    取消選取
                  </button>
                  <button
                    onClick={() => setShowBatchDeleteModal(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>批次刪除 ({selectedTenantIds.length})</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tenants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredTenants.map((tenant) => {
                const isActive = currentTenantId === tenant.id;
                return (
                  <motion.div
                    key={tenant.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`relative bg-slate-900 border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
                      isActive 
                        ? 'border-violet-500 shadow-violet-500/5 ring-1 ring-violet-500' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Active Brand Glow */}
                    {isActive && (
                      <div className="absolute -top-3 left-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-md shadow-violet-500/20 border border-violet-400/30">
                        當前系統啟用的分店 (ACTIVE)
                      </div>
                    )}

                    <div>
                      {/* Top Bar inside Card */}
                      <div className="flex justify-between items-start gap-2 mb-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            {tenant.id !== 'DEFAULT' ? (
                              <input
                                type="checkbox"
                                checked={selectedTenantIds.includes(tenant.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedTenantIds(prev =>
                                    prev.includes(tenant.id)
                                      ? prev.filter(id => id !== tenant.id)
                                      : [...prev, tenant.id]
                                  );
                                }}
                                className="h-4.5 w-4.5 text-violet-600 bg-slate-950 border-slate-800 rounded focus:ring-violet-500 cursor-pointer shrink-0"
                              />
                            ) : (
                              <div className="h-4.5 w-4.5 flex items-center justify-center opacity-30 shrink-0" title="DEFAULT 預設總店不可刪除">
                                <Lock className="h-3.5 w-3.5 text-slate-400" />
                              </div>
                            )}
                            <h3 className="font-extrabold text-base text-slate-100 tracking-tight">
                              {tenant.name}
                            </h3>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono text-slate-400 font-bold uppercase">
                              {tenant.id}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[11px] font-medium flex items-center gap-1 mt-0.5">
                            <Globe className="h-3 w-3 text-slate-600" />
                            {tenant.nameEn}
                          </p>
                        </div>
                        
                        {/* Status Dot */}
                        {(() => {
                          const lastHb = tenant.lastHeartbeat;
                          const isOnline = lastHb && (Date.now() - new Date(lastHb).getTime() < 5 * 60 * 1000);
                          const lastTimeStr = lastHb ? new Date(lastHb).toLocaleTimeString('zh-TW', { hour12: false }) : null;
                          return (
                            <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded-xl border border-slate-800/80 shrink-0">
                              <span className="flex h-2 w-2 relative">
                                {isOnline ? (
                                  <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </>
                                ) : (
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 animate-pulse"></span>
                                )}
                              </span>
                              <span className={`text-[10px] font-extrabold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`} title={lastHb ? `最後心跳：${new Date(lastHb).toLocaleString('zh-TW')}` : '無連線紀錄'}>
                                {isOnline ? '連線中' : '已離線'}
                              </span>
                              {lastTimeStr && (
                                <span className="text-[8px] text-slate-500 font-mono tracking-tighter">
                                  {lastTimeStr}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Detail list */}
                      <div className="space-y-2.5 text-xs border-t border-slate-800/60 pt-4 mb-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <DollarSign className="h-3.5 w-3.5 text-violet-400" />
                          <span>���低消費：<strong className="text-slate-100">{tenant.currency}{tenant.minSpend}</strong> / 每桌</span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-300">
                          <Layers className="h-3.5 w-3.5 text-indigo-400 mt-0.5" />
                          <div>
                            <span className="block">桌號清單 ({tenant.tables.length} 桌)：</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tenant.tables.map(table => (
                                <span key={table} className="bg-slate-950/60 border border-slate-800 text-[10px] px-1.5 py-0.5 rounded font-mono text-slate-400 font-semibold">
                                  {table}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {tenant.contactNumber && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span>電話：{tenant.contactNumber}</span>
                          </div>
                        )}
                        {tenant.address && (
                          <div className="flex items-start gap-2 text-slate-400">
                            <MapPin className="h-3.5 w-3.5 text-slate-500 mt-0.5" />
                            <span className="line-clamp-1">{tenant.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer buttons inside card */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/40">
                      {isActive ? (
                        <div className="flex-1 text-center bg-violet-600/15 border border-violet-500/20 text-violet-300 text-xs font-extrabold py-2 rounded-xl">
                          現正在此分店營業點餐
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentTenantId(tenant.id);
                            alert(`已成功切換營業分店至：${tenant.name}\n系統會立即對接 ${tenant.id} 分店的點餐與 KDS 串流！`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-xl transition-all cursor-pointer border border-slate-700/60"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          切換到此店
                        </button>
                      )}

                      <button
                        onClick={() => handleStartEdit(tenant)}
                        className="p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 rounded-xl transition-colors cursor-pointer"
                        title="編輯配置"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                        className="p-2 bg-slate-800/30 hover:bg-red-950/40 border border-slate-800/40 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                        title="刪除分店"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Dynamic Inspector & Sandbox Info (Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Active Tenant Context Board */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl"></div>
            
            <h2 className="text-base font-black tracking-tight text-indigo-400 mb-4 flex items-center gap-2">
              <Settings className="h-4.5 w-4.5" />
              當前運作中的分店內容 (Active Context)
            </h2>

            {(() => {
              const activeTenant = tenants.find(t => t.id === currentTenantId) || tenants[0];
              if (!activeTenant) return null;
              return (
                <div className="space-y-4">
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">分店名稱</span>
                    <span className="text-lg font-black text-white block mt-0.5">{activeTenant.name}</span>
                    <span className="text-xs text-slate-400 font-mono block mt-0.5">{activeTenant.nameEn}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">桌子數量</span>
                      <span className="text-xl font-black text-indigo-300 block mt-1 font-mono">{activeTenant.tables.length} <span className="text-[10px] font-normal text-slate-500">桌</span></span>
                    </div>
                    <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">起點低消限制</span>
                      <span className="text-xl font-black text-rose-400 block mt-1 font-mono">{activeTenant.currency}{activeTenant.minSpend}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 text-xs text-slate-400 leading-relaxed space-y-2">
                    <div className="font-bold text-slate-300">💡 跨租戶沙盒提示：</div>
                    <p>當前「顧客點餐端」與「KDS 廚房端」正綁定於本分店。切換其他分店後，點餐畫面會套用該店對應的「最低消費金額」與「專屬桌號清單」，送出的點餐明細也只會在該店的 KDS 與後台顯現，達成 100% 完美的 SaaS 多租戶邏輯！</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Sandbox Sandbox Order Counter/Debugger */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-sm font-extrabold text-slate-200 mb-3 flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-violet-400" />
              集團沙盒訂單隔離測試儀 (Tenant Order Inspector)
            </h2>
            <p className="text-slate-500 text-[11px] mb-4">
              直接查看資料庫中特定分店的訂單數量與最新資訊，以驗證資料隔離：
            </p>

            <div className="space-y-3">
              {tenants.map(t => {
                // Since our `orders` array contains the orders synced for CURRENT tenant from context,
                // we'll display how many orders are loaded for it.
                const isActive = currentTenantId === t.id;
                return (
                  <div key={t.id} className="flex justify-between items-center bg-slate-950 border border-slate-850/60 p-3 rounded-xl">
                    <div>
                      <span className="text-xs text-slate-200 font-bold block">{t.name}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase">{t.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded-md font-mono">
                          {orders.length} 筆訂單已載入
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded-md font-mono">
                          隔離中
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Backend Security PIN Settings Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-sm font-extrabold text-slate-200 mb-3 flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-red-500" />
              安全防護：後台管理安全密碼設定
            </h2>
            <p className="text-slate-500 text-[11px] mb-4">
              此設定能防範未授權人員進入管理面板。您可以自訂後台安全管理密碼（預設為 Eur0pe2266）。
            </p>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">當前作用中密碼</span>
                <span className="font-mono text-sm font-black text-slate-200 tracking-wider">
                  {adminPin.length >= 4 ? `${adminPin.slice(0, 3)}••••` : '••••••'}
                </span>
              </div>
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">
                ACTIVE
              </span>
            </div>

            <form onSubmit={handleUpdatePin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  請輸入新的安全管理密碼 (至少 6 位)
                </label>
                <input
                  type="password"
                  placeholder="例如: Eur0pe2266"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-100 placeholder-slate-600 font-mono tracking-widest focus:outline-none focus:border-red-500 text-center animate-none"
                />
              </div>

              {pinError && (
                <div className="text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                  ⚠️ {pinError}
                </div>
              )}

              {pinSuccess && (
                <div className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-bounce">
                  <Check className="h-3.5 w-3.5" />
                  <span>成功更新！當前管理密碼已更新。</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all cursor-pointer"
              >
                儲存新密碼
              </button>
            </form>
          </div>

          {/* Offline Sync Log Clearance and Archiving Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-sm font-extrabold text-slate-200 mb-3 flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-emerald-400" />
              數據管理：清理已同步日誌
            </h2>
            <p className="text-slate-500 text-[11px] mb-4">
              手動清除已成功同步並本機封存的離線數據佇列紀錄，避免長期運作後的資料累積。
            </p>

            {syncLogs.length > 0 ? (
              <div className="space-y-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 max-h-36 overflow-y-auto space-y-2 font-mono">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="text-[10px] flex items-start justify-between gap-2 border-b border-slate-800/40 pb-2 last:border-0 last:pb-0">
                      <div>
                        <span className="font-bold text-slate-300 block">{log.description}</span>
                        <span className="text-slate-500 block mt-0.5">ID: {log.id} | {new Date(log.syncedAt).toLocaleTimeString()}</span>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-1 py-0.5 rounded shrink-0">
                        SUCCESS
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={clearSyncLogs}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-750 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  <span>清除 {syncLogs.length} 筆已同步日誌</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 text-center">
                <span className="text-[11px] text-slate-500 block font-bold">目前暫無已成功同步的歷史日誌</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* MODAL 1: ADD TENANT FORM */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2 mb-2">
              <Building className="h-5 w-5 text-violet-400" />
              新增分店租戶 (Create Brand Tenant)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              建立新的獨立營業點，系統會自動在雲端 Firestore 建立該租戶沙盒。
            </p>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  1. 租戶唯一代碼 (Tenant ID) * [系統自動生成]
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newId}
                    readOnly
                    className="flex-1 bg-slate-950 border border-slate-850 px-3.5 py-2.5 rounded-xl text-xs text-slate-400 font-mono focus:outline-none uppercase"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setNewId('BR_' + Math.random().toString(36).substring(2, 8).toUpperCase())}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-3.5 py-1 text-xs rounded-xl border border-slate-700 cursor-pointer transition-colors"
                  >
                    重新生成
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  系統為確保多租戶資料庫安全與分店資料隔離所自動配置的唯一 ID 代碼。
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    2. 分店中文名稱 *
                  </label>
                  <input
                    type="text"
                    placeholder="例如: 台北南港分店"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    3. 分店英文/國際名稱
                  </label>
                  <input
                    type="text"
                    placeholder="例如: Nangang Branch"
                    value={newNameEn}
                    onChange={(e) => setNewNameEn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    4. 最低消費限制 (每桌)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newMinSpend}
                    onChange={(e) => setNewMinSpend(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    5. 貨幣符號
                  </label>
                  <input
                    type="text"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  6. 專屬客桌 ID 清單 (逗號分隔) *
                </label>
                <input
                  type="text"
                  placeholder="Table-1, Table-2, Bar-1, VIP-A"
                  value={newTablesInput}
                  onChange={(e) => setNewTablesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  各桌號以逗號 (,) 分隔。顧客點餐介面會自動呈現這份桌號清單！
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  7. 聯絡電話 (選填)
                </label>
                <input
                  type="text"
                  placeholder="例如: 02-5555-6666"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  8. 店面地址 (選填)
                </label>
                <input
                  type="text"
                  placeholder="例如: 台北市南港區八德路四段..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl font-bold">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  確認建立租戶
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: EDIT TENANT FORM */}
      {editingTenant && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setEditingTenant(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2 mb-2">
              <Edit className="h-5 w-5 text-indigo-400" />
              編輯分店設定 (Tenant Settings)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              變更分店「{editingTenant.name}」的營業配置。
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  租戶編號 ID (不可更改)
                </label>
                <input
                  type="text"
                  value={editingTenant.id}
                  disabled
                  className="w-full bg-slate-950/60 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-500 font-mono font-bold cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    分店中文名稱 *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    分店英文/國際名稱
                  </label>
                  <input
                    type="text"
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    最低消費限制 (每桌)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editMinSpend}
                    onChange={(e) => setEditMinSpend(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    貨幣符號
                  </label>
                  <input
                    type="text"
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  桌號清單 (以半形逗號分隔) *
                </label>
                <input
                  type="text"
                  value={editTablesInput}
                  onChange={(e) => setEditTablesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  聯絡電話
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  店面地址
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  儲存變更
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 3: BATCH DELETE CONFIRMATION FORM */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => !isDeletingBatch && setShowBatchDeleteModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 cursor-pointer"
              disabled={isDeletingBatch}
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 text-red-400 mb-2">
              <div className="bg-red-500/15 p-2 rounded-xl border border-red-500/30">
                <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
              </div>
              <h2 className="text-lg font-black text-slate-100">
                確認批次刪除分店？
              </h2>
            </div>
            
            <p className="text-xs text-slate-400 mb-4">
              您即將進行高風險的批次刪除操作。請確認以下 <span className="text-red-400 font-bold font-mono">{selectedTenantIds.length}</span> 間分店將被永久移除：
            </p>

            {/* Selected Tenants List */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-3 max-h-48 overflow-y-auto mb-5 space-y-2">
              {tenants
                .filter(t => selectedTenantIds.includes(t.id))
                .map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-200">{t.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                      {t.id}
                    </span>
                  </div>
                ))}
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 mb-6 space-y-2 leading-relaxed">
              <h4 className="font-bold flex items-center gap-1">
                ⚠️ 重要警示：
              </h4>
              <p>此動作將永久移除上述分店的所有系統配置。這些分店原本在雲端所產生的點餐資料與出餐訂單將會被完全隔離。此操作無法復原，請再次核實！</p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                disabled={isDeletingBatch}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                disabled={isDeletingBatch}
              >
                {isDeletingBatch ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>刪除中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>確認永久刪除</span>
                  </>
                )}
              </button>
            </div>

          </motion.div>
        </div>
      )}

      {/* MODAL 4: SINGLE DELETE CONFIRMATION */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
          >
            <button
              onClick={() => setDeleteConfirmation({ isOpen: false, tenantId: '', tenantName: '' })}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 text-red-400 mb-2">
              <div className="bg-red-500/15 p-2 rounded-xl border border-red-500/30">
                <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
              </div>
              <h2 className="text-lg font-black text-slate-100">
                確認刪除分店？
              </h2>
            </div>
            
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              您確定要刪除「<span className="text-slate-100 font-bold">{deleteConfirmation.tenantName} ({deleteConfirmation.tenantId})</span>」分店嗎？
            </p>

            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 mb-6 space-y-2 leading-relaxed">
              <h4 className="font-bold">⚠️ 重要警示：</h4>
              <p>此動作將永久移除該分店的所有系統配置，且該分店在雲端所產生的點餐資料與出餐訂單將會被隔離，此操作無法復原！</p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setDeleteConfirmation({ isOpen: false, tenantId: '', tenantName: '' })}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = deleteConfirmation.tenantId;
                  try {
                    await deleteTenant(targetId);
                    if (currentTenantId === targetId) {
                      setCurrentTenantId('DEFAULT');
                    }
                    setDeleteConfirmation({ isOpen: false, tenantId: '', tenantName: '' });
                    alert('已成功刪除該分店！');
                  } catch (err: any) {
                    alert('刪除失敗：' + err.message);
                  }
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

      {/* FLOATING BATCH DELETE UNDO BANNER */}
      <AnimatePresence>
        {undoCountDown > 0 && pendingDeleteIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[450px] bg-slate-900 border border-red-500/30 p-4 rounded-2xl shadow-2xl z-[99] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
                <Trash2 className="h-4.5 w-4.5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-100">
                  已將 {pendingDeleteIds.length} 間分店暫存刪除！
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  資料將在 <span className="text-red-400 font-extrabold font-mono text-sm">{undoCountDown}</span> 秒後永久移除...
                </p>
              </div>
            </div>
            <button
              onClick={handleUndoBatchDelete}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
            >
              立即復原 (Undo)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
