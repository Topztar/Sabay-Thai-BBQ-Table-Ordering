import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Info } from 'lucide-react';

interface PrintLog {
  id: string;
  timestamp: string;
  content: string;
  orderId: string;
  type: 'kitchen' | 'customer';
}

interface PrintLogsD3ChartProps {
  printLogs: PrintLog[];
  onRefresh?: () => void;
}

interface HourlyData {
  hour: number;
  hourLabel: string;
  revenue: number;
  orderCount: number;
}

export default function PrintLogsD3Chart({ printLogs, onRefresh }: PrintLogsD3ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<HourlyData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 280 });

  // Handle auto-resizing
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      // Subtract margins/paddings if any
      setDimensions({
        width: Math.max(300, width),
        height: 280,
      });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Process Logs to hourly aggregation
  const hourlyData: HourlyData[] = React.useMemo(() => {
    // Initialize 24-hour buckets
    const buckets: { [hour: number]: { revenue: number; orderCount: number } } = {};
    for (let h = 0; h < 24; h++) {
      buckets[h] = { revenue: 0, orderCount: 0 };
    }

    // Trace orders to prevent double-counting orderCount for the same orderId
    const seenOrders = new Set<string>();

    printLogs.forEach((log) => {
      // 1. Extract Hour from Log
      let logHour = 18; // fallback to default restaurant start hour

      // Try parsing from content line e.g., "時間: 19:35:12"
      const content = log.content || '';
      const timeMatch = content.match(/(?:時間|TIME):\s*(\d{1,2}):(\d{2})/i);
      if (timeMatch) {
        logHour = parseInt(timeMatch[1], 10);
      } else {
        // Backup: extract from log.timestamp e.g. "下午 07:35:12" or "19:35:20" or "7:35 PM"
        const ts = log.timestamp || '';
        const colonIndex = ts.indexOf(':');
        if (colonIndex !== -1) {
          const hourStr = ts.substring(0, colonIndex).trim();
          let hourVal = parseInt(hourStr.replace(/\D/g, ''), 10);
          if (!isNaN(hourVal)) {
            const isPm = ts.toLowerCase().includes('pm') || ts.includes('下午');
            const isAm = ts.toLowerCase().includes('am') || ts.includes('上午');
            if (isPm && hourVal < 12) hourVal += 12;
            if (isAm && hourVal === 12) hourVal = 0;
            logHour = hourVal;
          }
        }
      }

      // Safeguard hour bounds
      if (logHour < 0 || logHour > 23) {
        logHour = 18;
      }

      // 2. Extract Revenue for 'customer' type logs
      if (log.type === 'customer') {
        let revenue = 0;
        // Search '親享總計' or '實付支付 Net:   $123'
        const matchTotal = content.match(/(?:親享總計|實付支付\s*Net:)\s*\$?\s*([0-9,]+)/i);
        if (matchTotal) {
          revenue = parseFloat(matchTotal[1].replace(/,/g, ''));
        }

        buckets[logHour].revenue += revenue;

        // Count unique customer orderIds as transactions
        if (log.orderId && log.orderId !== 'TEST-PAGE') {
          if (!seenOrders.has(log.orderId)) {
            seenOrders.add(log.orderId);
            buckets[logHour].orderCount += 1;
          }
        } else {
          // If no orderId, count as unique checkouts anyway
          buckets[logHour].orderCount += 1;
        }
      } else if (log.type === 'kitchen' && log.orderId !== 'TEST-PAGE') {
        // Log peak kitchen times by incrementing kitchen ticket processing
        // but only if we don't have a customer receipt (so we don't double count peak frequency)
        if (!seenOrders.has(log.orderId)) {
          seenOrders.add(log.orderId);
          buckets[logHour].orderCount += 1;
        }
      }
    });

    // We focus visualization on the business busy hours: 16:00 (4:00 PM) to 01:00 (1:00 AM next day)
    // plus any other hours where transactions actually occurred to keep chart concise and zero clutter
    const activeHours = [17, 18, 19, 20, 21, 22, 23, 0, 1];

    // Add any other hours that have actual metrics
    const otherHoursWithData: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (!activeHours.includes(h) && (buckets[h].revenue > 0 || buckets[h].orderCount > 0)) {
        otherHoursWithData.push(h);
      }
    }

    // Merge active operational hours with other hour elements with records
    const allRelevantHours = [...activeHours, ...otherHoursWithData].sort((a, b) => {
      // Sort operation hour order chronologically starting from 15:00 to 23:00 then 0:00 to 14:00
      const weight = (h: number) => (h >= 15 ? h - 15 : h + 9);
      return weight(a) - weight(b);
    });

    return allRelevantHours.map((h) => {
      const padHour = String(h).padStart(2, '0');
      return {
        hour: h,
        hourLabel: `${padHour}:00`,
        revenue: buckets[h].revenue,
        orderCount: buckets[h].orderCount,
      };
    });
  }, [printLogs]);

  // Total calculated metrics
  const totalRev = React.useMemo(() => hourlyData.reduce((s, d) => s + d.revenue, 0), [hourlyData]);
  const totalOrders = React.useMemo(
    () => hourlyData.reduce((s, d) => s + d.orderCount, 0),
    [hourlyData],
  );

  // Draw chart in D3 hook
  useEffect(() => {
    if (!svgRef.current || hourlyData.length === 0) return;

    // Clear previous elements
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 30, right: 45, bottom: 40, left: 55 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // 1. Define Scales
    const xScale = d3
      .scaleBand<string>()
      .domain(hourlyData.map((d) => d.hourLabel))
      .range([0, chartWidth])
      .padding(0.35);

    // Y Axis Left: Revenue Scale
    const maxRev = d3.max(hourlyData, (d) => d.revenue) || 1000;
    const yScaleLeft = d3
      .scaleLinear()
      .domain([0, maxRev * 1.15]) // add some head spacing
      .range([chartHeight, 0]);

    // Y Axis Right: Order Count Scale
    const maxOrders = d3.max(hourlyData, (d) => d.orderCount) || 5;
    const yScaleRight = d3
      .scaleLinear()
      .domain([0, Math.max(5, maxOrders) * 1.2]) // add head spacing
      .range([chartHeight, 0]);

    // 2. Linear Gradients definitions
    const defs = svg.append('defs');

    // Revenue bar gradient
    const barGradient = defs
      .append('linearGradient')
      .attr('id', 'revenue-bar-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    barGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#F59E0B')
      .attr('stop-opacity', 0.85);
    barGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#D97706')
      .attr('stop-opacity', 0.15);

    // Peak orders line shadow effect
    const filter = defs
      .append('filter')
      .attr('id', 'glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');

    filter.append('feGaussianBlur').attr('stdDeviation', 2.5).attr('result', 'blur');

    filter
      .append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', (d) => d);

    // 3. Render Gridlines
    g.append('g')
      .attr('class', 'grid-lines')
      .call(
        d3
          .axisLeft(yScaleLeft)
          .tickSize(-chartWidth)
          .tickFormat(() => ''),
      )
      .call((g) => g.select('.domain').remove())
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-dasharray', '2,2');

    // 4. Render X and Y Axes
    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).tickSize(5))
      .call((g) => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)'))
      .selectAll('text')
      .attr('fill', '#A1A1AA')
      .style('font-size', '9px')
      .style('font-family', 'ui-monospace, SFMono-Regular, monospace');

    // Left Y Axis (Revenue)
    g.append('g')
      .call(
        d3
          .axisLeft(yScaleLeft)
          .ticks(5)
          .tickFormat((d) => `NT$${d}`),
      )
      .call((g) => g.select('.domain').remove())
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .select('text')
      .attr('fill', '#F59E0B')
      .style('font-size', '9px')
      .style('font-family', 'ui-monospace, SFMono-Regular, monospace');

    // Right Y Axis (Orders Peak Volume)
    g.append('g')
      .attr('transform', `translate(${chartWidth},0)`)
      .call(
        d3
          .axisRight(yScaleRight)
          .ticks(5)
          .tickFormat((d) => `${d}單`),
      )
      .call((g) => g.select('.domain').remove())
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .select('text')
      .attr('fill', '#10B981')
      .style('font-size', '9px')
      .style('font-family', 'ui-monospace, SFMono-Regular, monospace');

    // 5. Render Bars (Hourly Revenue)
    const barsGroup = g.append('g').attr('class', 'bars');
    barsGroup
      .selectAll('rect')
      .data(hourlyData)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.hourLabel) || 0)
      .attr('y', (d) => yScaleLeft(d.revenue))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => chartHeight - yScaleLeft(d.revenue))
      .attr('fill', 'url(#revenue-bar-grad)')
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.2s')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', '#FBBF24').attr('opacity', 1);

        const [x, y] = d3.pointer(event, svg.node());
        setTooltipData(d);
        setTooltipPos({ x: x + 15, y: y - 55 });
      })
      .on('mousemove', function (event) {
        const [x, y] = d3.pointer(event, svg.node());
        setTooltipPos({ x: x + 15, y: y - 55 });
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', 'url(#revenue-bar-grad)').attr('opacity', 0.95);
        setTooltipData(null);
        setTooltipPos(null);
      });

    // 6. Draw Line Trend for Peak Order Counts
    const lineGenerator = d3
      .line<HourlyData>()
      .x((d) => (xScale(d.hourLabel) || 0) + xScale.bandwidth() / 2)
      .y((d) => yScaleRight(d.orderCount))
      .curve(d3.curveMonotoneX);

    // Area background path beneath the order counts trend
    const areaGenerator = d3
      .area<HourlyData>()
      .x((d) => (xScale(d.hourLabel) || 0) + xScale.bandwidth() / 2)
      .y0(chartHeight)
      .y1((d) => yScaleRight(d.orderCount))
      .curve(d3.curveMonotoneX);

    // area path
    g.append('path')
      .datum(hourlyData)
      .attr('class', 'order-area')
      .attr('d', areaGenerator)
      .attr('fill', 'rgba(16, 185, 129, 0.04)');

    // line path
    g.append('path')
      .datum(hourlyData)
      .attr('class', 'order-trend-line')
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', '#10B981')
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#glow)');

    // 7. Draw overlay points/circles for trend
    g.selectAll('.mark-dot')
      .data(hourlyData)
      .enter()
      .append('circle')
      .attr('class', 'mark-dot')
      .attr('cx', (d) => (xScale(d.hourLabel) || 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScaleRight(d.orderCount))
      .attr('r', 4.5)
      .attr('fill', '#111827')
      .attr('stroke', '#34D399')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 6.5).attr('fill', '#34D399');

        const [x, y] = d3.pointer(event, svg.node());
        setTooltipData(d);
        setTooltipPos({ x: x + 15, y: y - 55 });
      })
      .on('mousemove', function (event) {
        const [x, y] = d3.pointer(event, svg.node());
        setTooltipPos({ x: x + 15, y: y - 55 });
      })
      .on('mouseout', function () {
        d3.select(this).attr('r', 4.5).attr('fill', '#111827');
        setTooltipData(null);
        setTooltipPos(null);
      });
  }, [hourlyData, dimensions]);

  return (
    <div
      className="bg-[#161616] border border-white/10 rounded-xl p-5 shadow-sm space-y-4 text-left"
      id="d3-hourly-analytics-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-3">
        <div className="space-y-0.5">
          <h4 className="font-bold text-sm text-white flex items-center gap-2">
            <span className="text-amber-400">📊</span>
            <span>D3 時段營業額與熱門點餐尖峰 (D3 Hourly Revenue & Peak Volume)</span>
          </h4>
          <p className="text-white/40 text-[10px]">
            自動由近期熱感印表快取緩衝匯流排分析，交叉統計出單時段分佈
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="self-start sm:self-auto px-2 px-2.5 py-1 text-[10px] text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1 cursor-pointer active:scale-95 transition"
          >
            <RefreshCw size={10} />
            <span>重新整理 Refresh</span>
          </button>
        )}
      </div>

      {printLogs.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-xs flex flex-col items-center justify-center space-y-2">
          <Info size={24} className="text-zinc-600 animate-pulse" />
          <p>⚠️ 目前本機熱感列印緩衝區無出單紀錄，請先至收銀發送訂單出單作數據串流。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Legend and High Levels stats breakdown */}
          <div className="grid grid-cols-3 gap-3.5 bg-black/25 p-3 rounded-lg border border-white/5 text-[10.5px]">
            <div className="text-left">
              <span className="text-zinc-400 block text-[9px] uppercase font-mono">
                Spool Rev 計入總額
              </span>
              <span className="font-mono text-xs font-black text-amber-400">
                NT$ {totalRev.toLocaleString()}
              </span>
            </div>
            <div className="text-left">
              <span className="text-zinc-400 block text-[9px] uppercase font-mono">
                Spool Bills 件數
              </span>
              <span className="font-mono text-xs font-black text-emerald-400">
                {totalOrders} 筆單據
              </span>
            </div>
            <div className="flex flex-col items-end justify-center space-y-1">
              <div className="flex items-center gap-1 text-[9px]">
                <span className="inline-block w-2.5 h-1.5 bg-amber-500 opacity-80 rounded-xs"></span>
                <span className="text-zinc-400">時段營業額 (NT$)</span>
              </div>
              <div className="flex items-center gap-1 text-[9px]">
                <span className="inline-block w-2.5 h-0.5 bg-emerald-400"></span>
                <span className="text-zinc-400">點餐頻率次數</span>
              </div>
            </div>
          </div>

          {/* D3 Graphic Canvas with React Tooltip anchor */}
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden select-none bg-black/10 rounded-lg pt-1"
          >
            <svg ref={svgRef} className="mx-auto block overflow-visible" />

            {/* Elegant tooltips */}
            {tooltipData && tooltipPos && (
              <div
                className="absolute z-10 pointer-events-none bg-[#1c1c1e] text-white p-3 rounded-lg border border-white/10 shadow-xl text-xs space-y-1 animate-fadeIn font-sans"
                style={{
                  left: tooltipPos.x,
                  top: tooltipPos.y,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="font-mono font-black text-[#E5B453] border-b border-white/5 pb-1 flex items-center justify-between gap-3 text-[10px]">
                  <span>
                    ⏰ 區間 {tooltipData.hourLabel} -{' '}
                    {String((tooltipData.hour + 1) % 24).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="space-y-0.5 text-[11px] pt-1">
                  <p className="text-zinc-400 flex justify-between gap-4">
                    <span>時段營業額:</span>
                    <span className="font-mono font-bold text-amber-400">
                      NT$ {(tooltipData.revenue || 0).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-zinc-400 flex justify-between gap-4">
                    <span>單時成交單數:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {tooltipData.orderCount} 單
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
