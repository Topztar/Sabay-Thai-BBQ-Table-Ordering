import React, { useState, useEffect } from 'react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Order } from '../types';
import { Clock, CheckSquare, Play, AlertCircle, Flag, Flame, Trash2, Edit2 } from 'lucide-react';

// Sub-component for dynamic live ticking of order elapsed time
const ElapsedTimer: React.FC<{ timestamp: string }> = ({ timestamp }) => {
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      setSecondsElapsed(Math.max(0, Math.floor(diffMs / 1000)));
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    const displayMins = mins % 60;
    const displaySecs = sec % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hours > 0) {
      return `${hours}h ${pad(displayMins)}m ${pad(displaySecs)}s`;
    }
    return `${pad(displayMins)}:${pad(displaySecs)}`;
  };

  return (
    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
      secondsElapsed > 600 // 10 minutes warning
        ? 'bg-rose-100 text-rose-700 animate-pulse'
        : secondsElapsed > 300 // 5 minutes caution
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600'
    }`}>
      <Clock className="h-3 w-3" />
      {formatElapsed(secondsElapsed)}
    </span>
  );
};

export const KitchenDisplaySystem: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    flagOrder
  } = useOfflineQueue();

  // Flag edit state per order
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState<string>('');

  // Local state for order filtering or searching if needed
  const [activeTab, setActiveTab] = useState<'all' | 'flagged'>('all');

  const startFlagging = (order: Order) => {
    setEditingFlagId(order.id);
    setFlagReasonInput(order.flagReason || '廚房急單 (Urgent Order)');
  };

  const handleSaveFlag = (order: Order) => {
    flagOrder(order.id, true, flagReasonInput.trim(), order.tenantId);
    setEditingFlagId(null);
  };

  const handleClearFlag = (order: Order) => {
    flagOrder(order.id, false, '', order.tenantId);
    setEditingFlagId(null);
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'flagged') return order.isFlagged;
    return true;
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
  const preparingOrders = filteredOrders.filter(o => o.status === 'preparing');
  const completedOrders = filteredOrders.filter(o => o.status === 'completed');

  return (
    <div className="flex-1 bg-slate-900 min-h-screen p-6 text-slate-100">
      {/* Header controls */}
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-rose-500">
            <Flame className="h-6 w-6 text-red-500 animate-pulse" />
            BOH 廚房顯示系統 (Kitchen Display System)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            即時出餐看板：點選卡片按鈕進行「排隊中 ➔ 製作中 ➔ 出餐完成」之狀態移轉，保障餐點先後次序。
          </p>
        </div>

        {/* Tab filters */}
        <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部訂單 ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('flagged')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'flagged'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flag className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
            優先處理 ({orders.filter(o => o.isFlagged).length})
          </button>
        </div>
      </section>

      {/* Ticket Kanban Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: Pending Tickets */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 flex flex-col max-h-[80vh]">
          <div className="bg-slate-800/50 p-4 border-b border-slate-800/60 rounded-t-2xl flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
              <h2 className="font-black text-sm tracking-wider uppercase text-indigo-400">
                新訂單排隊中 (Pending Queue)
              </h2>
            </div>
            <span className="font-mono text-xs font-bold bg-indigo-500/15 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {pendingOrders.length}
            </span>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-xs">
                目前無排隊中訂單
              </div>
            ) : (
              pendingOrders.map(order => (
                <div
                  key={order.id}
                  className={`bg-slate-900 border rounded-xl p-4 transition-all relative overflow-hidden ${
                    order.isFlagged
                      ? 'border-rose-500 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {order.isFlagged && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-bl">
                      PRIORITY FLAG
                    </div>
                  )}

                  {/* Header info */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-black text-base text-white">
                        {order.table_id === 'takeout' ? '🛍️ 外帶顧客' : `🍽️ 桌號: ${order.table_id}`}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        ID: {order.id.toUpperCase()}
                      </p>
                    </div>
                    <ElapsedTimer timestamp={order.timestamp} />
                  </div>

                  {/* Flag Reason Panel */}
                  {order.isFlagged && order.flagReason && (
                    <div className="bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg text-rose-300 text-xs mb-3 flex items-start gap-1.5 font-bold">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-400" />
                      <span>{order.flagReason}</span>
                    </div>
                  )}

                  {/* Itemized prep metadata */}
                  <div className="space-y-2 border-t border-b border-slate-800/80 py-3 my-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-rose-400">x{item.quantity}</span>
                            <span className="font-bold text-slate-200">{item.name}</span>
                          </div>
                          {item.selectedModifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.selectedModifiers.map(mod => (
                                <span key={mod} className="bg-slate-800 border border-slate-700 px-1 py-0.1 rounded text-[10px] text-slate-400 font-medium">
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.remarks && (
                            <p className="text-yellow-500/90 text-xs italic bg-yellow-500/5 p-1 rounded border border-yellow-500/10">
                              備註: {item.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Priority flagging input widget */}
                  {editingFlagId === order.id ? (
                    <div className="space-y-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800 mb-3">
                      <input
                        type="text"
                        value={flagReasonInput}
                        onChange={(e) => setFlagReasonInput(e.target.value)}
                        placeholder="請輸入特殊備註理由"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingFlagId(null)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded cursor-pointer"
                        >
                          取消
                        </button>
                        {order.isFlagged && (
                          <button
                            onClick={() => handleClearFlag(order)}
                            className="bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] px-2 py-1 rounded cursor-pointer"
                          >
                            解除
                          </button>
                        )}
                        <button
                          onClick={() => handleSaveFlag(order)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer font-bold"
                        >
                          儲存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => startFlagging(order)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Flag className="h-3 w-3 text-rose-400" />
                        {order.isFlagged ? '編輯備註' : '標記優先'}
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing', order.tenantId)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow cursor-pointer transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 fill-white" />
                    開始製作 (Start cooking)
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: Preparing Tickets */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 flex flex-col max-h-[80vh]">
          <div className="bg-slate-800/50 p-4 border-b border-slate-800/60 rounded-t-2xl flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <h2 className="font-black text-sm tracking-wider uppercase text-amber-400">
                餐點製作中 (Preparing)
              </h2>
            </div>
            <span className="font-mono text-xs font-bold bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {preparingOrders.length}
            </span>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-xs">
                目前無製作中訂單
              </div>
            ) : (
              preparingOrders.map(order => (
                <div
                  key={order.id}
                  className={`bg-slate-900 border rounded-xl p-4 transition-all relative overflow-hidden ${
                    order.isFlagged
                      ? 'border-rose-500 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {order.isFlagged && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-bl">
                      PRIORITY FLAG
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-black text-base text-white">
                        {order.table_id === 'takeout' ? '🛍️ 外帶顧客' : `🍽️ 桌號: ${order.table_id}`}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        ID: {order.id.toUpperCase()}
                      </p>
                    </div>
                    <ElapsedTimer timestamp={order.timestamp} />
                  </div>

                  {order.isFlagged && order.flagReason && (
                    <div className="bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg text-rose-300 text-xs mb-3 flex items-start gap-1.5 font-bold">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-400" />
                      <span>{order.flagReason}</span>
                    </div>
                  )}

                  <div className="space-y-2 border-t border-b border-slate-800/80 py-3 my-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-rose-400">x{item.quantity}</span>
                            <span className="font-bold text-slate-200">{item.name}</span>
                          </div>
                          {item.selectedModifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.selectedModifiers.map(mod => (
                                <span key={mod} className="bg-slate-800 border border-slate-700 px-1 py-0.1 rounded text-[10px] text-slate-400 font-medium">
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.remarks && (
                            <p className="text-yellow-500/90 text-xs italic bg-yellow-500/5 p-1 rounded border border-yellow-500/10">
                              備註: {item.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Priority flagging input widget */}
                  {editingFlagId === order.id ? (
                    <div className="space-y-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800 mb-3">
                      <input
                        type="text"
                        value={flagReasonInput}
                        onChange={(e) => setFlagReasonInput(e.target.value)}
                        placeholder="請輸入特殊備註理由"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingFlagId(null)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded cursor-pointer"
                        >
                          取消
                        </button>
                        {order.isFlagged && (
                          <button
                            onClick={() => handleClearFlag(order)}
                            className="bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] px-2 py-1 rounded cursor-pointer"
                          >
                            解除
                          </button>
                        )}
                        <button
                          onClick={() => handleSaveFlag(order)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer font-bold"
                        >
                          儲存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => startFlagging(order)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Flag className="h-3 w-3 text-rose-400" />
                        {order.isFlagged ? '編輯備註' : '標記優先'}
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'pending', order.tenantId)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-2 rounded-lg font-bold border border-slate-750 cursor-pointer"
                    >
                      退回
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'completed', order.tenantId)}
                      className="flex-grow bg-amber-500 hover:bg-amber-600 text-red-950 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow cursor-pointer transition-colors"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      出餐完成 (Complete)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: Completed Tickets */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 flex flex-col max-h-[80vh]">
          <div className="bg-slate-800/50 p-4 border-b border-slate-800/60 rounded-t-2xl flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="font-black text-sm tracking-wider uppercase text-emerald-400">
                出餐完成 (Completed History)
              </h2>
            </div>
            <span className="font-mono text-xs font-bold bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {completedOrders.length}
            </span>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {completedOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-xs">
                目前無已出餐訂單記錄
              </div>
            ) : (
              completedOrders.map(order => (
                <div
                  key={order.id}
                  className="bg-slate-900/60 border border-slate-800/40 rounded-xl p-4 relative"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-300 flex items-center gap-1.5">
                        <CheckSquare className="h-4 w-4 text-emerald-500" />
                        {order.table_id === 'takeout' ? '🛍️ 外帶顧客' : `🍽️ 桌號: ${order.table_id}`}
                      </h3>
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                        ID: {order.id.toUpperCase()}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(order.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 pl-5">
                    {order.items.map((item, idx) => (
                      <div key={idx}>
                        <span className="font-bold text-slate-500">x{item.quantity}</span> {item.name}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-850">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'preparing', order.tenantId)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold px-2 py-1 rounded border border-slate-750 cursor-pointer"
                    >
                      重新製作
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
