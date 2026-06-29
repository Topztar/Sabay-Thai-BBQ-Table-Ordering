import React, { useState, useMemo } from 'react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Wifi, WifiOff, RefreshCw, Trash2, ChevronDown, ChevronUp, Database, AlertTriangle, ShieldAlert, Check, X } from 'lucide-react';

export const OfflineQueueHUD: React.FC = () => {
  const {
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    queue,
    purgeQueue,
    forceRetryQueue,
    tenants
  } = useOfflineQueue();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);

  // Safe purge confirmation modal states
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [confirmCode, setConfirmCode] = useState<string>('');
  const [acknowledgedRisk, setAcknowledgedRisk] = useState<boolean>(false);

  const handleRetry = async () => {
    setRetrying(true);
    await forceRetryQueue();
    setTimeout(() => setRetrying(false), 800);
  };

  const handleConfirmPurge = () => {
    if (confirmCode !== 'FORCE PURGE' || !acknowledgedRisk) return;
    purgeQueue();
    setShowPurgeModal(false);
    setConfirmCode('');
    setAcknowledgedRisk(false);
    alert('已成功強制清除所有分店的離線待同步佇列！');
  };

  // Analyze tenant/branch distribution of jobs in the queue
  const queueTenantStats = useMemo(() => {
    const stats: Record<string, number> = {};
    queue.forEach(job => {
      let tenantId = 'DEFAULT';
      if (job.payload?.tenantId) {
        tenantId = job.payload.tenantId;
      } else if (job.url?.includes('/tenants/')) {
        tenantId = job.url.split('/tenants/')[1]?.split('/')[0] || 'DEFAULT';
      }
      stats[tenantId] = (stats[tenantId] || 0) + 1;
    });
    return stats;
  }, [queue]);

  const isActuallyOnline = isOnline && !simulatedOffline;

  return (
    <div className={`sticky top-0 z-50 transition-colors duration-300 ${
      isActuallyOnline
        ? 'bg-slate-900 border-b border-emerald-500/30'
        : 'bg-red-950 border-b border-red-500/30'
    } text-white shadow-xl`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className={`flex h-3 w-3 rounded-full ${
              isActuallyOnline ? 'bg-emerald-400' : 'bg-red-500'
            }`}></span>
            {isActuallyOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
          </div>
          <span className="font-semibold tracking-wide flex items-center gap-1.5">
            {isActuallyOnline ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-400" />
                系統連線中 (Online Mode)
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-400" />
                {simulatedOffline ? '離線模擬中 (Simulated Offline)' : '硬體離線中 (Hardware Offline)'}
              </>
            )}
          </span>
        </div>

        {/* Sync Status Info */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-indigo-400" />
            <span>暫存佇列 (FIFO Queue): </span>
            <span className={`font-mono font-bold ${
              queue.length > 0 ? 'text-amber-400 scale-105 transition-transform' : 'text-slate-400'
            }`}>
              {queue.length} 筆
            </span>
          </div>

          {queue.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? '收合詳情' : '展開佇列'}
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Simulate Offline Toggle */}
          <button
            onClick={() => setSimulatedOffline(!simulatedOffline)}
            className={`px-3 py-1 rounded font-medium text-xs border transition-all cursor-pointer ${
              simulatedOffline
                ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white'
                : 'bg-red-600/30 border-red-500/50 hover:bg-red-600 text-red-200'
            }`}
          >
            {simulatedOffline ? '恢復網路 (Go Online)' : '模擬離線 (Simulate Offline)'}
          </button>

          {queue.length > 0 && (
            <>
              {/* Force Retry */}
              <button
                onClick={handleRetry}
                disabled={retrying || !isActuallyOnline}
                title={isActuallyOnline ? '立即執行佇列同步' : '需恢復連線才能執行重試'}
                className={`p-1 px-2.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                  (!isActuallyOnline || retrying) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                手動重試
              </button>

              {/* Purge Queue */}
              <button
                onClick={() => setShowPurgeModal(true)}
                className="p-1 px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer animate-pulse"
                title="強制安全清除離線待同步佇列"
              >
                <Trash2 className="h-3 w-3" />
                <span>強制清除</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Jobs List */}
      {expanded && queue.length > 0 && (
        <div className="bg-slate-950 border-t border-slate-800 p-4 max-h-60 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span>待處理佇列項目列表 (First-In, First-Out Queue)</span>
              <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                順序執行
              </span>
            </h3>
            <div className="space-y-2">
              {queue.map((job, idx) => (
                <div
                  key={job.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded p-3 text-xs flex items-start justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-300 font-bold">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-200">{job.description}</span>
                      <span className="text-slate-500">|</span>
                      <span className="font-mono text-slate-400 text-[10px]">{job.id}</span>
                    </div>
                    <div className="flex gap-4 text-slate-400 text-[10px] font-mono">
                      <span>URL: <span className="text-blue-400">{job.url}</span></span>
                      <span>Method: <span className="text-purple-400">{job.method}</span></span>
                      <span>時間: <span className="text-amber-400">{new Date(job.timestamp).toLocaleTimeString()}</span></span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col gap-1">
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-700">
                      PENDING SYNC
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Safe Purge Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden text-left">
            {/* Warning Glow Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse" />

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100">
                  高風險動作：強制清除離線佇列
                </h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase">HIGH RISK DATA OVERRIDE DETECTED</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850/60 mb-4 text-xs text-slate-300 space-y-3">
              <p className="text-slate-400 leading-relaxed">
                您即將永久移除本地端快取的 <span className="text-amber-400 font-bold">{queue.length} 筆</span> 待同步操作。在多租戶雲端環境下，此操作極易誤刪其他分店尚未同頻的訂單。
              </p>

              {/* Tenant breakdown stats */}
              <div className="border-t border-slate-900 pt-3 mt-1 space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">待刪除資料之分店分佈 (Queue Analytics):</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {Object.entries(queueTenantStats).map(([tId, count]) => {
                    const tName = tenants.find(t => t.id === tId)?.name || `未知分店 (${tId})`;
                    return (
                      <div key={tId} className="flex justify-between items-center bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-slate-850">
                        <span className="font-semibold text-slate-300 truncate max-w-[200px]">{tName}</span>
                        <span className="font-mono bg-rose-950/40 text-rose-400 border border-rose-900/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          {count} 筆待同步
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Risk Acknowledgment checkbox */}
            <div className="mb-4">
              <label className="flex items-start gap-2.5 cursor-pointer group text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={acknowledgedRisk}
                  onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-[11.5px] text-slate-400 group-hover:text-slate-300 transition-colors leading-normal">
                  我已與上述分店人員聯繫並親自確認，同意承擔清除此批離線訂單之所有連帶營運與帳務損失責任。
                </span>
              </label>
            </div>

            {/* Code Verification Input */}
            <div className="space-y-1.5 mb-5">
              <label className="text-[10.5px] text-slate-500 font-bold uppercase tracking-wider block">
                請手動輸入核對字串 <span className="text-rose-500 select-all font-black">FORCE PURGE</span> 以解鎖：
              </label>
              <input
                type="text"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="請輸入 FORCE PURGE"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs font-mono tracking-widest text-center focus:outline-none focus:border-rose-500/50 transition-colors"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setConfirmCode('');
                  setAcknowledgedRisk(false);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60 font-black text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center"
              >
                取消返回
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={confirmCode !== 'FORCE PURGE' || !acknowledgedRisk}
                className={`flex-1 font-black text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  confirmCode === 'FORCE PURGE' && acknowledgedRisk
                    ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-600/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                <span>確定清除</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
