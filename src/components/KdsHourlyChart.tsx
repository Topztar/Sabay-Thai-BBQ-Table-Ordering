import React from 'react';
import { Clock, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface KdsHourlyChartProps {
  activeChartTab: 'current' | 'predictive';
  setActiveChartTab: (tab: 'current' | 'predictive') => void;
  orders: any[];
  hourlyData: any[];
  maxCount: number;
  predictionData: any[];
  CustomTooltip: any;
}

export const KdsHourlyChart: React.FC<KdsHourlyChartProps> = ({
  activeChartTab,
  setActiveChartTab,
  orders,
  hourlyData,
  maxCount,
  predictionData,
  CustomTooltip,
}) => {
  return (
    <div
      className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4"
      id="kds-hourly-chart"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/5 pb-3.5 gap-3">
        <div className="flex items-center space-x-2">
          <Clock size={16} className="text-[#E5B453]" />
          <h3 className="font-bold text-sm text-white font-serif tracking-wide text-left">
            備餐負載預估與決策分析 (Live Workload & 7-Day Pattern Prediction)
          </h3>
        </div>

        <div className="flex items-center bg-black/40 border border-white/10 p-1 rounded-lg self-start md:self-center">
          <button
            type="button"
            onClick={() => setActiveChartTab('current')}
            className={`px-3 py-1 rounded text-[11px] font-black transition cursor-pointer flex items-center space-x-1 ${
              activeChartTab === 'current'
                ? 'bg-[#E5B453] text-[#0F0F0F]'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <span>🎯 當前即時負載</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('predictive')}
            className={`px-3 py-1 rounded text-[11px] font-black transition cursor-pointer flex items-center space-x-1 ${
              activeChartTab === 'predictive'
                ? 'bg-[#E5B453] text-[#0F0F0F]'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <TrendingUp size={11} />
            <span>📈 7日歷史預測</span>
          </button>
        </div>
      </div>

      {activeChartTab === 'current' ? (
        <>
          {/* Peak Load Warning Banner */}
          {orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length > 0 &&
            hourlyData.some((item) => item.count >= 3) && (
              <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/25 p-3 rounded-lg text-red-400 text-xs font-bold animate-pulse">
                <AlertTriangle size={15} className="shrink-0 text-red-400" />
                <span>
                  注意：系統預測到部分時段有高峰擁擠(Peak Load Spikes
                  ⚠️)，請廚房管理人員提前適當儲備高湯、米線及安排備餐人手！
                </span>
              </div>
            )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {hourlyData.map((item) => {
              const isPeak = item.count >= 3;
              const isModerate = item.count === 2;
              const isLight = item.count === 1;
              const percentage = Math.min((item.count / maxCount) * 100, 100);

              return (
                <div
                  key={item.label}
                  className={`bg-black/25 border p-3 rounded-lg flex flex-col justify-between transition group h-[72px] ${
                    isPeak
                      ? 'border-red-500/25 hover:border-red-500/50 bg-red-500/5'
                      : isModerate
                        ? 'border-amber-500/20 hover:border-amber-500/40'
                        : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono text-zinc-400 group-hover:text-zinc-200 transition font-bold">
                      {item.label}
                    </span>
                    <span
                      className={`font-black font-mono text-xs ${
                        isPeak
                          ? 'text-red-400 font-extrabold animate-pulse'
                          : isModerate
                            ? 'text-amber-400'
                            : isLight
                              ? 'text-emerald-400'
                              : 'text-zinc-500'
                      }`}
                    >
                      {item.count} 筆
                    </span>
                  </div>

                  {/* Progress bar line */}
                  <div className="w-full bg-zinc-900/60 h-1.5 rounded-full overflow-hidden relative border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPeak
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : isModerate
                            ? 'bg-amber-400'
                            : isLight
                              ? 'bg-emerald-400'
                              : 'bg-transparent'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Status annotation */}
                  <div className="flex items-center justify-between text-[8px] mt-1 font-sans font-bold">
                    <span
                      className={
                        isPeak
                          ? 'text-red-400'
                          : isModerate
                            ? 'text-amber-400'
                            : isLight
                              ? 'text-emerald-400'
                              : 'text-zinc-500'
                      }
                    >
                      {isPeak
                        ? '🚨 高峰擁擠'
                        : isModerate
                          ? '⚡ 溫和運作'
                          : isLight
                            ? '🍃 輕載正常'
                            : '💤 廚道閒置'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Prediction Summary Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-black/30 border border-white/5 p-3 rounded-xl text-left">
              <span className="text-[10px] text-white/40 block font-bold mb-1">
                預計單日客流量 & 總點單
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#E5B453]">
                  ~{predictionData.reduce((acc, current) => acc + current.expectedVolume, 0)}
                </span>
                <span className="text-xs text-white/60">筆期望單</span>
              </div>
              <span className="text-[9px] text-zinc-400 block mt-1 font-mono">
                今日累計同段已收:{' '}
                {predictionData.reduce((acc, current) => acc + current.actualToday, 0)} 筆
              </span>
            </div>

            <div className="bg-black/30 border border-white/5 p-3 rounded-xl text-left">
              <span className="text-[10px] text-white/40 block font-bold mb-1">
                預估尖峰時段 (Expected Peak)
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-rose-400">
                  {predictionData.length > 0
                    ? predictionData.reduce(
                        (prev, current) =>
                          prev.expectedVolume > current.expectedVolume ? prev : current,
                        predictionData[0],
                      ).label
                    : ''}
                </span>
                <span className="text-xs text-red-400 font-extrabold animate-pulse">
                  (
                  {predictionData.length > 0
                    ? predictionData.reduce(
                        (prev, current) =>
                          prev.expectedVolume > current.expectedVolume ? prev : current,
                        predictionData[0],
                      ).expectedVolume
                    : 0}{' '}
                  筆預估高峰)
                </span>
              </div>
              <span className="text-[9px] text-zinc-400 block mt-1">
                歷史週內同段落具有極高點單集中性
              </span>
            </div>

            <div className="bg-black/30 border border-red-500/10 p-3 rounded-xl text-left flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-white/40 block font-bold mb-1">
                  廚房備料負荷指示 (Strain Index)
                </span>
                <span
                  className={`text-xs font-extrabold flex items-center gap-1 ${
                    predictionData.some((d) => d.expectedVolume >= 8)
                      ? 'text-amber-400 animate-pulse'
                      : 'text-emerald-400'
                  }`}
                >
                  <Info size={11} className="shrink-0" />
                  {predictionData.some((d) => d.expectedVolume >= 8)
                    ? '⚡ 建議：尖峰廚力高強度預備'
                    : '🟢 運作正常：無嚴重擁堵風險'}
                </span>
              </div>
              <span className="text-[9px] text-zinc-500 block mt-1">
                係基於近 7 天歷史用餐熱力曲線計算
              </span>
            </div>
          </div>

          {/* Advanced Recharts Predictive Area & Trend Chart */}
          <div className="bg-black/25 border border-white/5 rounded-xl p-4">
            <p className="text-[10.5px] text-zinc-400 text-left font-sans mb-3 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#E5B453]" /> 預期備餐量趨勢線
              <span className="w-2 h-2 rounded-full bg-emerald-400 ml-2" /> 今日實際單量
              <span className="w-2 h-2 rounded-dashed bg-zinc-500 border border-dotted border-zinc-400 ml-2" />{' '}
              7日歷史平均
            </p>

            <div className="h-60 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={predictionData}
                  margin={{ top: 10, right: 10, bottom: 0, left: -25 }}
                >
                  <defs>
                    <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E5B453" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#E5B453" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F1F1F" />

                  <XAxis
                    dataKey="label"
                    stroke="#71717A"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#A1A1AA', fontWeight: 'bold' }}
                  />
                  <YAxis
                    stroke="#71717A"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fill: '#A1A1AA', fontWeight: 'bold' }}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  {/* Confidence interval shadow corridor */}
                  <Area
                    name="預期最大波動範圍"
                    type="monotone"
                    dataKey="upperBound"
                    stroke="none"
                    fill="#E5B453"
                    fillOpacity={0.05}
                    legendType="none"
                  />

                  {/* Expected Volume Curve */}
                  <Area
                    name="預期期望點單 (Forecasted Load)"
                    type="monotone"
                    dataKey="expectedVolume"
                    stroke="#E5B453"
                    strokeWidth={2.5}
                    fill="url(#colorExpected)"
                  />

                  {/* Historical Average Curve */}
                  <Line
                    name="7日歷史平均單量 (7-Day Average)"
                    type="monotone"
                    dataKey="historicalAvg"
                    stroke="#71717A"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />

                  {/* Actual Today Live Line */}
                  <Area
                    name="今日實際點單 (Actual Today)"
                    type="monotone"
                    dataKey="actualToday"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#colorActual)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
