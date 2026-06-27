import React, { useState } from 'react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Wifi, WifiOff, RefreshCw, Trash2, ChevronDown, ChevronUp, Database } from 'lucide-react';

export const OfflineQueueHUD: React.FC = () => {
  const {
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    queue,
    purgeQueue,
    forceRetryQueue
  } = useOfflineQueue();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);

  const handleRetry = async () => {
    setRetrying(true);
    await forceRetryQueue();
    setTimeout(() => setRetrying(false), 800);
  };

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
                onClick={purgeQueue}
                className="p-1 px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer"
                title="清空目前所有的暫存操作（無法復原）"
              >
                <Trash2 className="h-3 w-3" />
                清空佇列
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
    </div>
  );
};
