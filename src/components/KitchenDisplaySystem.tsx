import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Order } from '../types';
import { 
  Clock, 
  CheckSquare, 
  Play, 
  AlertCircle, 
  Flag, 
  Flame, 
  Volume2, 
  VolumeX, 
  Hand, 
  GripVertical, 
  LayoutGrid, 
  Minimize2,
  Trash2,
  ChevronDown,
  ChevronRight 
} from 'lucide-react';

// Sub-component for dynamic live ticking of order elapsed time
const ElapsedTimer: React.FC<{ timestamp: string; isCompact: boolean }> = ({ timestamp, isCompact }) => {
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
    <span className={`font-mono font-bold rounded flex items-center gap-1 shrink-0 ${
      isCompact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
    } ${
      secondsElapsed > 600 // 10 minutes warning
        ? 'bg-rose-950/80 text-rose-350 border border-rose-500/30 animate-pulse'
        : secondsElapsed > 300 // 5 minutes caution
          ? 'bg-amber-950/80 text-amber-350 border border-amber-500/30'
          : 'bg-slate-800 text-slate-300 border border-slate-700/50'
    }`}>
      <Clock className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {formatElapsed(secondsElapsed)}
    </span>
  );
};

// Reusable individual Order Card Component with beautiful Swipe-to-Action & Click Feedback
interface KDSOrderCardProps {
  order: Order;
  status: 'pending' | 'preparing' | 'completed';
  updateOrderStatus: (id: string, status: 'pending' | 'preparing' | 'completed', tenantId: string) => Promise<void>;
  setOrderUrgent: (id: string, urgent: boolean, tenantId: string) => Promise<void>;
  flagOrder: (id: string, isFlagged: boolean, reason: string, tenantId: string) => Promise<void>;
  viewMode: 'compact' | 'standard';
  autoCollapseCompletedItems: boolean;
  completedItems: Record<string, boolean>;
  toggleItemCompleted: (orderId: string, itemIdx: number) => void;
}

const KDSOrderCard: React.FC<KDSOrderCardProps> = ({
  order,
  status,
  updateOrderStatus,
  setOrderUrgent,
  flagOrder,
  viewMode,
  autoCollapseCompletedItems,
  completedItems,
  toggleItemCompleted
}) => {
  const [dragProgress, setDragProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [editingFlag, setEditingFlag] = useState(false);
  const [flagReasonInput, setFlagReasonInput] = useState('');
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const dragControls = useDragControls();
  const isCompact = viewMode === 'compact';

  const startFlagging = () => {
    setFlagReasonInput(order.flagReason || '廚房急單 (Urgent Order)');
    setEditingFlag(true);
  };

  const handleSaveFlag = () => {
    flagOrder(order.id, true, flagReasonInput.trim(), order.tenantId);
    setEditingFlag(false);
  };

  const handleClearFlag = () => {
    flagOrder(order.id, false, '', order.tenantId);
    setEditingFlag(false);
  };

  const handleNextStatus = async () => {
    setIsTransitioning(true);
    const nextStatus = status === 'pending' ? 'preparing' : 'completed';
    // Small timeout to allow slide/fade-out transitions to finish
    setTimeout(() => {
      updateOrderStatus(order.id, nextStatus, order.tenantId);
    }, 200);
  };

  const handlePrevStatus = async () => {
    const prevStatus = status === 'preparing' ? 'pending' : 'preparing';
    updateOrderStatus(order.id, prevStatus, order.tenantId);
  };

  return (
    <Reorder.Item
      value={order}
      dragControls={dragControls}
      dragListener={false}
      as="div"
      layout
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: isTransitioning ? 0 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 200, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="relative overflow-hidden rounded-2xl bg-slate-950/30 select-none border border-slate-850"
    >
      {/* Background slide indicator revealed on horizontal drag */}
      {status !== 'completed' && (
        <div 
          className="absolute inset-0 flex items-center justify-between px-6 rounded-2xl transition-all duration-200 pointer-events-none"
          style={{
            backgroundColor: status === 'pending' 
              ? `rgba(79, 70, 229, ${Math.min(0.4, dragProgress * 0.55)})` 
              : `rgba(245, 158, 11, ${Math.min(0.4, dragProgress * 0.55)})`,
            borderColor: status === 'pending' 
              ? `rgba(99, 102, 241, ${Math.min(0.8, dragProgress)})` 
              : `rgba(245, 158, 11, ${Math.min(0.8, dragProgress)})`,
            borderWidth: '1.5px',
            boxShadow: dragProgress > 0.5 ? 'inset 0 0 20px rgba(0,0,0,0.4)' : 'none'
          }}
        >
          <div className="flex items-center gap-2.5 text-white font-black text-xs">
            {status === 'pending' ? (
              <Play className="h-4.5 w-4.5 fill-white text-indigo-400 animate-bounce" />
            ) : (
              <CheckSquare className="h-4.5 w-4.5 text-amber-400 animate-bounce" />
            )}
            <span style={{ opacity: Math.max(0.4, dragProgress) }} className="transition-opacity tracking-wider">
              {status === 'pending' ? '➔ 滑動以開始製作' : '➔ 滑動以出餐完成'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-black font-mono text-slate-300">
            <Hand className="h-3 w-3 text-slate-400" />
            <span>{Math.round(dragProgress * 100)}%</span>
          </div>
        </div>
      )}

      {/* Main Draggable Card Foreground */}
      <motion.div
        drag={status !== 'completed' ? 'x' : false}
        dragConstraints={{ left: 0, right: 200 }}
        dragElastic={{ left: 0, right: 0.15 }}
        onDrag={(event, info) => {
          // Calculate progress to swipe threshold (120px)
          const progress = Math.min(1, info.offset.x / 130);
          setDragProgress(Math.max(0, progress));
        }}
        onDragEnd={(event, info) => {
          if (info.offset.x > 125) {
            handleNextStatus();
          } else {
            setDragProgress(0);
          }
        }}
        whileTap={status !== 'completed' ? { cursor: 'grabbing', scale: 0.99 } : undefined}
        className={`relative bg-slate-900 rounded-2xl border transition-all ${
          isCompact ? 'p-3' : 'p-4.5'
        } ${
          order.urgent
            ? 'border-red-500/70 shadow-lg shadow-red-950/35 ring-2 ring-red-500/40 bg-gradient-to-br from-red-950/25 via-slate-900 to-slate-900'
            : order.isFlagged
              ? 'border-rose-500/60 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/20'
              : 'border-slate-800/80 hover:border-slate-700/80'
        }`}
      >
        {order.urgent ? (
          <div className="absolute top-0 right-0 bg-gradient-to-l from-red-600 to-rose-600 text-white text-[10px] font-black px-3 py-1.5 rounded-bl-xl animate-pulse flex items-center gap-1 shadow-lg">
            <Flame className="h-3 w-3 fill-white" />
            <span>特急單</span>
          </div>
        ) : order.isFlagged ? (
          <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl">
            優先
          </div>
        ) : null}

        {/* Header info */}
        <div className={`flex justify-between items-start gap-2 ${isCompact ? 'mb-2' : 'mb-3.5'}`}>
          <div className="flex items-center gap-1.5">
            {/* Custom reorder grip handle */}
            <div 
              onPointerDown={(e) => {
                e.preventDefault();
                dragControls.start(e);
              }}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-slate-300 transition-colors shrink-0 flex items-center justify-center"
              title="按住拖曳以排序"
            >
              <GripVertical className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </div>
            <div>
              <h3 className={`font-black text-white tracking-tight ${isCompact ? 'text-sm' : 'text-base'}`}>
                {order.table_id === 'takeout' ? '🛍️ 外帶' : `🍽️ ${order.table_id} 桌`}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 font-bold">
                #{order.id.substring(0, 6).toUpperCase()}
              </p>
            </div>
          </div>
          <ElapsedTimer timestamp={order.timestamp} isCompact={isCompact} />
        </div>

        {/* Flag Reason Panel */}
        {order.isFlagged && order.flagReason && (
          <div className={`bg-rose-950/30 border border-rose-900/40 rounded-xl text-rose-350 flex items-start gap-2 font-bold leading-normal ${
            isCompact ? 'p-2 mb-2 text-[11px]' : 'p-2.5 mb-3.5 text-xs'
          }`}>
            <AlertCircle className={`shrink-0 mt-0.5 text-rose-400 ${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
            <span>{order.flagReason}</span>
          </div>
        )}

        {/* Itemized prep metadata */}
        <div className={`border-t border-b border-slate-800/60 ${
          isCompact ? 'py-1.5 my-1.5 space-y-1.5' : 'py-3.5 my-3.5 space-y-2.5'
        }`}>
          {(() => {
            const itemsWithIndex = order.items.map((item, idx) => ({ item, idx, key: `${order.id}_${idx}` }));
            const pendingItems = itemsWithIndex.filter(x => !completedItems[x.key]);
            const completedItemsList = itemsWithIndex.filter(x => !!completedItems[x.key]);

            const renderItemRow = (x: { item: typeof order.items[0]; idx: number; key: string }) => {
              const isDone = !!completedItems[x.key];
              return (
                <div 
                  key={x.idx} 
                  onClick={() => toggleItemCompleted(order.id, x.idx)}
                  className={`flex flex-col leading-normal p-1.5 rounded-xl transition-all cursor-pointer select-none border border-transparent ${
                    isDone
                      ? 'bg-slate-950/25 hover:bg-slate-950/35'
                      : 'hover:bg-slate-850/50 hover:border-slate-700/20'
                  }`}
                >
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`shrink-0 flex items-center justify-center rounded-md border mt-0.5 transition-all ${
                          isDone 
                            ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-400 h-4.5 w-4.5' 
                            : 'border-slate-600 text-transparent h-4.5 w-4.5'
                        }`}>
                          {isDone && <CheckSquare className="h-3 w-3 text-emerald-400" />}
                        </span>
                        <div className="min-w-0">
                          <span className={`font-black text-rose-400 mr-1.5 shrink-0 ${isCompact ? 'text-xs' : 'text-sm'}`}>x{x.item.quantity}</span>
                          <span className={`font-bold transition-all ${
                            isDone ? 'text-slate-500 line-through decoration-slate-600 decoration-1' : 'text-slate-200'
                          }`}>
                            {x.item.name}
                          </span>
                        </div>
                      </div>
                      {isDone && (
                        <span className="text-[9px] bg-emerald-950/40 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                          已核對
                        </span>
                      )}
                    </div>
                    {x.item.selectedModifiers.length > 0 && (
                      <div className={`flex flex-wrap gap-1 pl-6.5 transition-opacity ${isDone ? 'opacity-40' : ''}`}>
                        {x.item.selectedModifiers.map(mod => (
                          <span key={mod} className="bg-slate-950 border border-slate-800/80 px-1.5 py-0.5 rounded text-[9px] text-slate-400 font-bold tracking-tight">
                            {mod}
                          </span>
                        ))}
                      </div>
                    )}
                    {x.item.remarks && (
                      <div className={`pl-6.5 mt-0.5 transition-opacity ${isDone ? 'opacity-40' : ''}`}>
                        <p className="text-amber-400 text-[10px] italic bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-500/10 inline-block">
                          備註: {x.item.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            if (autoCollapseCompletedItems) {
              return (
                <div className="space-y-1.5">
                  {/* Uncompleted/Pending items */}
                  {pendingItems.length === 0 && completedItemsList.length > 0 && (
                    <p className="text-center text-[11px] text-emerald-400 font-bold py-1 bg-emerald-950/10 rounded-lg border border-emerald-500/10">
                      🎉 所有品項皆已手動核對完畢！
                    </p>
                  )}
                  {pendingItems.map(x => renderItemRow(x))}

                  {/* Collapsible Completed items block */}
                  {completedItemsList.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setCompletedExpanded(!completedExpanded)}
                        className="w-full flex justify-between items-center bg-slate-950/40 hover:bg-slate-950/60 text-[11px] font-bold text-slate-400 hover:text-slate-300 py-1.5 px-2 rounded-xl border border-slate-850 mt-1 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          {completedExpanded ? <ChevronDown className="h-3 w-3.5" /> : <ChevronRight className="h-3 w-3.5" />}
                          <span>已收攏品項 ({completedItemsList.length})</span>
                        </span>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded scale-90">
                          {completedExpanded ? '點擊折疊' : '點擊展開'}
                        </span>
                      </button>
                      
                      {completedExpanded && (
                        <div className="space-y-1 mt-1.5 pl-1.5 border-l border-slate-800">
                          {completedItemsList.map(x => renderItemRow(x))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Normal uncollapsed stream
            return (
              <div className="space-y-1.5">
                {itemsWithIndex.map(x => renderItemRow(x))}
              </div>
            );
          })()}
        </div>

        {/* Priority flagging input widget */}
        {status !== 'completed' && (
          editingFlag ? (
            <div className={`space-y-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800 ${isCompact ? 'mb-2' : 'mb-3.5'}`}>
              <input
                type="text"
                value={flagReasonInput}
                onChange={(e) => setFlagReasonInput(e.target.value)}
                placeholder="請輸入特殊註記原因"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingFlag(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] px-2 py-1 rounded cursor-pointer font-bold transition-colors"
                >
                  取消
                </button>
                {order.isFlagged && (
                  <button
                    type="button"
                    onClick={handleClearFlag}
                    className="bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] px-2 py-1 rounded cursor-pointer font-bold transition-colors"
                  >
                    解除
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveFlag}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer font-black transition-colors"
                >
                  儲存
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-2 gap-2 ${isCompact ? 'mb-2' : 'mb-3.5'}`}>
              <button
                type="button"
                onClick={startFlagging}
                className={`bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-slate-300 font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-97 ${
                  isCompact ? 'py-1 text-[10px]' : 'py-2 text-[11px]'
                }`}
                title={order.isFlagged ? '編輯備註' : '標記優先'}
              >
                <Flag className="h-3.5 w-3.5 text-rose-400" />
                <span>{order.isFlagged ? '編輯備註' : '標記優先'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderUrgent(order.id, !order.urgent, order.tenantId)}
                className={`border font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-97 ${
                  isCompact ? 'py-1 text-[10px]' : 'py-2 text-[11px]'
                } ${
                  order.urgent
                    ? 'bg-red-950 text-red-400 border-red-500/70 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700/60 text-slate-300'
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-red-500" />
                <span>{order.urgent ? '解除特急' : '標記特急'}</span>
              </button>
            </div>
          )
        )}

        {/* Actions Button Row with Micro-Interactions */}
        <div className="flex gap-2">
          {status === 'preparing' && (
            <button
              type="button"
              onClick={handlePrevStatus}
              className={`bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold border border-slate-750/80 cursor-pointer active:scale-95 transition-transform ${
                isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs'
              }`}
            >
              退回
            </button>
          )}

          {status === 'completed' ? (
            <div className="w-full flex justify-between items-center mt-1">
              <span className="text-[10px] text-slate-500 font-mono font-bold">
                已出餐 {new Date(order.timestamp).toLocaleTimeString()}
              </span>
              <button
                type="button"
                onClick={handlePrevStatus}
                className="bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-300 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-750 cursor-pointer active:scale-95 transition-transform"
              >
                重新製作
              </button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleNextStatus}
              className={`flex-grow rounded-xl font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all ${
                isCompact ? 'py-1.5 text-[10px]' : 'py-2 text-xs'
              } ${
                status === 'pending'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
              }`}
            >
              {status === 'pending' ? (
                <>
                  <Play className={isCompact ? 'h-3.5 w-3.5 fill-white' : 'h-4 w-4 fill-white'} />
                  <span>開始製作 (Start)</span>
                </>
              ) : (
                <>
                  <CheckSquare className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  <span>出餐完成 (Complete)</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </Reorder.Item>
  );
};

export const KitchenDisplaySystem: React.FC = () => {
  const {
    orders,
    setOrders,
    updateOrderStatus,
    flagOrder,
    setOrderUrgent,
    clearHistoricalOrders,
    session,
    currentTenantId,
    kdsViewMode,
    setKdsViewMode
  } = useOfflineQueue();

  // Enforce data isolation:
  const activeBranchId = session?.role === 'SUPER_ADMIN' ? currentTenantId : (session?.branchId || 'DEFAULT');
  const branchOrders = orders.filter(o => o.tenantId === activeBranchId);

  // States for collapse & clear features
  const [autoCollapseCompletedItems, setAutoCollapseCompletedItems] = useState<boolean>(() => {
    return localStorage.getItem('kds_auto_collapse_completed_items') === 'true';
  });

  const toggleAutoCollapse = () => {
    setAutoCollapseCompletedItems(prev => {
      const next = !prev;
      localStorage.setItem('kds_auto_collapse_completed_items', String(next));
      return next;
    });
  };

  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('kds_completed_items');
    return saved ? JSON.parse(saved) : {};
  });

  const toggleItemCompleted = (orderId: string, itemIdx: number) => {
    setCompletedItems(prev => {
      const key = `${orderId}_${itemIdx}`;
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('kds_completed_items', JSON.stringify(next));
      return next;
    });
  };

  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  const handleClearHistory = async () => {
    await clearHistoricalOrders(activeBranchId);
    
    // Cleanup completed items keys in state and localStorage
    const completedForTenantIds = new Set(
      orders.filter(o => o.tenantId === activeBranchId && o.status === 'completed').map(o => o.id)
    );
    setCompletedItems(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const orderId = key.split('_')[0];
        if (completedForTenantIds.has(orderId)) {
          delete next[key];
        }
      });
      localStorage.setItem('kds_completed_items', JSON.stringify(next));
      return next;
    });
    
    setIsConfirmingClear(false);
  };

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Local state for order filtering or searching if needed
  const [activeTab, setActiveTab] = useState<'all' | 'flagged'>('all');

  // Play modern double chime sound using Web Audio API
  const playIncomingOrderSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Play first note (G5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.3);
      
      // Play second note (C6) slightly delayed
      setTimeout(() => {
        try {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1046.50, audioCtx.currentTime); // C6
          gain2.gain.setValueAtTime(0.18, audioCtx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
          
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.start();
          osc2.stop(audioCtx.currentTime + 0.4);
        } catch (err) {
          console.error('Second tone failed', err);
        }
      }, 120);

    } catch (error) {
      console.error('Web Audio API notification failed', error);
    }
  };

  // Track incoming orders to trigger audio chime
  const existingOrderIdsRef = useRef<Set<string>>(new Set(branchOrders.map(o => o.id)));
  const isFirstMountRef = useRef<boolean>(true);

  useEffect(() => {
    const currentIds = branchOrders.map(o => o.id);
    
    if (isFirstMountRef.current) {
      existingOrderIdsRef.current = new Set(currentIds);
      isFirstMountRef.current = false;
      return;
    }
    
    let hasNewOrder = false;
    for (const id of currentIds) {
      if (!existingOrderIdsRef.current.has(id)) {
        hasNewOrder = true;
        break;
      }
    }
    
    existingOrderIdsRef.current = new Set(currentIds);
    
    if (hasNewOrder) {
      playIncomingOrderSound();
    }
  }, [branchOrders]);

  // Filter orders (flagged OR urgent)
  const filteredOrders = branchOrders.filter(order => {
    if (activeTab === 'flagged') return order.isFlagged || order.urgent;
    return true;
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
  const preparingOrders = filteredOrders.filter(o => o.status === 'preparing');
  const completedOrders = filteredOrders.filter(o => o.status === 'completed');

  // Unified in-place drag-reordering handler preserving other subsets
  const handleReorder = (newItems: Order[], status: 'pending' | 'preparing' | 'completed') => {
    setOrders(prev => {
      const visibleIds = new Set(newItems.map(item => item.id));
      let newIdx = 0;
      return prev.map(o => {
        if (visibleIds.has(o.id)) {
          return newItems[newIdx++];
        }
        return o;
      });
    });
  };

  // Grid columns styling depending on the active View Preference Mode
  // Requirement 2: repeat(auto-fit, minmax(320px, 1fr)) for standard.
  const cardsContainerClass = kdsViewMode === 'compact'
    ? "grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3 items-start content-start"
    : "grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4.5 items-start content-start";

  return (
    <div className="KitchenDisplaySystem flex-1 bg-slate-900 min-h-screen p-6 text-slate-100 pb-20">
      {/* Header controls */}
      <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2 text-rose-500">
            <span className="h-2.5 w-2.5 bg-rose-500 rounded-full animate-ping shrink-0"></span>
            BOH 廚房出餐顯示看板 (Kitchen Display System)
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-normal">
            出餐主控台：按住左側三條線圖示 <strong className="font-semibold text-slate-300">↕ 拖曳卡片垂直排序</strong>。點擊按鈕或將卡片 <strong className="font-semibold text-indigo-400">➔ 向右滑動 (Swipe-to-Cook)</strong> 以更新製作狀態。
          </p>
        </div>

        {/* Controls block */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Requirement 3: View Switcher Control */}
          <div className="flex bg-slate-950/60 rounded-xl p-1 border border-slate-800 shrink-0">
            <button
              onClick={() => setKdsViewMode('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                kdsViewMode === 'standard'
                  ? 'bg-slate-800 text-white shadow border border-slate-700/50'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="適合大螢幕的標準大卡片檢視"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>標準寬版 (Standard)</span>
            </button>
            <button
              onClick={() => setKdsViewMode('compact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                kdsViewMode === 'compact'
                  ? 'bg-slate-800 text-white shadow border border-slate-700/50'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="適合小尺寸或高解析度螢幕的緊湊檢視"
            >
              <Minimize2 className="h-3.5 w-3.5 text-rose-400" />
              <span>緊湊模式 (Compact)</span>
            </button>
          </div>

          {/* Audio Chime Button */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
                : 'bg-slate-950/40 border-slate-900 text-slate-500'
            }`}
            title={soundEnabled ? '點擊靜音' : '點擊啟用提示音'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 text-emerald-400" />
                <span>提示音已啟動</span>
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 text-slate-500" />
                <span>提示音已關閉</span>
              </>
            )}
          </button>

          {/* Test Sound trigger */}
          {soundEnabled && (
            <button
              onClick={playIncomingOrderSound}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              測試叮咚聲
            </button>
          )}

          {/* Auto Collapse Toggle Switch */}
          <button
            onClick={toggleAutoCollapse}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              autoCollapseCompletedItems
                ? 'bg-indigo-950/40 border-indigo-900/60 text-indigo-300 hover:text-indigo-200 shadow shadow-indigo-500/5'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="自動收攏已核對標記完成的餐點品項，節省螢幕空間"
          >
            {autoCollapseCompletedItems ? (
              <>
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>自動收攏已完成：開啟</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-600"></span>
                <span>自動收攏已完成：關閉</span>
              </>
            )}
          </button>

          {/* Clear Completed History Cache Button */}
          {isConfirmingClear ? (
            <div className="flex items-center gap-1 bg-rose-950/40 rounded-xl p-1 border border-rose-900/50">
              <button
                onClick={handleClearHistory}
                className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>確認清除已出餐記錄？</span>
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold px-2 py-1 rounded-lg cursor-pointer"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingClear(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-rose-950/40 hover:border-rose-900/60 text-xs font-bold text-slate-300 hover:text-rose-400 transition-all cursor-pointer flex items-center gap-1.5"
              title="清除此分店所有狀態為『已出餐 (Completed)』的本地歷史訂單與快取資料"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>清除舊訂單紀錄</span>
            </button>
          )}

          <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全部 ({branchOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'flagged'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flag className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
              優先 ({branchOrders.filter(o => o.isFlagged || o.urgent).length})
            </button>
          </div>
        </div>
      </section>

      {/* Ticket Kanban Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUMN 1: Pending Tickets */}
        <div className="bg-slate-950/60 rounded-3xl border border-slate-850 flex flex-col max-h-[82vh] overflow-hidden">
          <div className="bg-slate-800/40 px-5 py-4 border-b border-slate-800/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
              <h2 className="font-black text-xs tracking-wider uppercase text-indigo-400">
                新訂單排隊中 (Pending Queue)
              </h2>
            </div>
            <span className="font-mono text-xs font-black bg-indigo-500/15 text-indigo-300 px-3 py-0.5 rounded-full border border-indigo-500/20">
              {pendingOrders.length}
            </span>
          </div>

          {/* Cards Container with Responsive Grid System (Requirement 2) */}
          <div className="p-4 overflow-y-auto flex-1 max-h-[75vh]">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-xs font-bold">
                目前無排隊中訂單
              </div>
            ) : (
              <Reorder.Group 
                as="div" 
                axis="y" 
                values={pendingOrders} 
                onReorder={(newItems) => handleReorder(newItems, 'pending')}
                className={cardsContainerClass}
              >
                <AnimatePresence mode="popLayout">
                  {pendingOrders.map(order => (
                    <KDSOrderCard
                      key={order.id}
                      order={order}
                      status="pending"
                      updateOrderStatus={updateOrderStatus}
                      setOrderUrgent={setOrderUrgent}
                      flagOrder={flagOrder}
                      viewMode={kdsViewMode}
                      autoCollapseCompletedItems={autoCollapseCompletedItems}
                      completedItems={completedItems}
                      toggleItemCompleted={toggleItemCompleted}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}
          </div>
        </div>

        {/* COLUMN 2: Preparing Tickets */}
        <div className="bg-slate-950/60 rounded-3xl border border-slate-850 flex flex-col max-h-[82vh] overflow-hidden">
          <div className="bg-slate-800/40 px-5 py-4 border-b border-slate-800/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="font-black text-xs tracking-wider uppercase text-amber-400">
                餐點製作中 (Preparing)
              </h2>
            </div>
            <span className="font-mono text-xs font-black bg-amber-500/15 text-amber-300 px-3 py-0.5 rounded-full border border-amber-500/20">
              {preparingOrders.length}
            </span>
          </div>

          {/* Cards Container with Responsive Grid System (Requirement 2) */}
          <div className="p-4 overflow-y-auto flex-1 max-h-[75vh]">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-xs font-bold font-sans">
                目前無製作中訂單
              </div>
            ) : (
              <Reorder.Group 
                as="div" 
                axis="y" 
                values={preparingOrders} 
                onReorder={(newItems) => handleReorder(newItems, 'preparing')}
                className={cardsContainerClass}
              >
                <AnimatePresence mode="popLayout">
                  {preparingOrders.map(order => (
                    <KDSOrderCard
                      key={order.id}
                      order={order}
                      status="preparing"
                      updateOrderStatus={updateOrderStatus}
                      setOrderUrgent={setOrderUrgent}
                      flagOrder={flagOrder}
                      viewMode={kdsViewMode}
                      autoCollapseCompletedItems={autoCollapseCompletedItems}
                      completedItems={completedItems}
                      toggleItemCompleted={toggleItemCompleted}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}
          </div>
        </div>

        {/* COLUMN 3: Completed Tickets */}
        <div className="bg-slate-950/60 rounded-3xl border border-slate-850 flex flex-col max-h-[82vh] overflow-hidden">
          <div className="bg-slate-800/40 px-5 py-4 border-b border-slate-800/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <h2 className="font-black text-xs tracking-wider uppercase text-emerald-400">
                出餐完成 (Completed History)
              </h2>
            </div>
            <span className="font-mono text-xs font-black bg-emerald-500/15 text-emerald-300 px-3 py-0.5 rounded-full border border-emerald-500/20">
              {completedOrders.length}
            </span>
          </div>

          {/* Cards Container with Responsive Grid System (Requirement 2) */}
          <div className="p-4 overflow-y-auto flex-1 max-h-[75vh]">
            {completedOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-xs font-bold">
                目前無已出餐訂單記錄
              </div>
            ) : (
              <Reorder.Group 
                as="div" 
                axis="y" 
                values={completedOrders} 
                onReorder={(newItems) => handleReorder(newItems, 'completed')}
                className={cardsContainerClass}
              >
                <AnimatePresence mode="popLayout">
                  {completedOrders.map(order => (
                    <KDSOrderCard
                      key={order.id}
                      order={order}
                      status="completed"
                      updateOrderStatus={updateOrderStatus}
                      setOrderUrgent={setOrderUrgent}
                      flagOrder={flagOrder}
                      viewMode={kdsViewMode}
                      autoCollapseCompletedItems={autoCollapseCompletedItems}
                      completedItems={completedItems}
                      toggleItemCompleted={toggleItemCompleted}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
