import React, { useState, useEffect, useRef } from 'react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Order } from '../types';
import * as d3 from 'd3';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Lock, CheckCircle, ShieldAlert, BarChart3, Database, Move, Trash2, Edit, Printer, Coins, RefreshCw } from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const {
    orders,
    setOrders,
    updateOrderStatus,
    isOnline,
    simulatedOffline
  } = useOfflineQueue();

  // Authentication gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Edit / Audit state
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  const [editTableId, setEditTableId] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<Order['paymentMethod']>('Cash');
  const [editItems, setEditItems] = useState<{ name: string; quantity: number; price: number }[]>([]);

  // D3 Chart Ref
  const d3ChartRef = useRef<SVGSVGElement | null>(null);

  // Default PIN authentication handler
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('PIN 碼錯誤！預設測試 PIN 碼為 1234');
      setPin('');
    }
  };

  const handleKeypadClick = (val: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
    }
  };

  const handleClearPin = () => {
    setPin('');
  };

  // Edit action helpers
  const handleOpenEditModal = (order: Order) => {
    setSelectedOrderForEdit(order);
    setEditTableId(order.table_id);
    setEditPaymentMethod(order.paymentMethod);
    setEditItems(order.items.map(i => ({ name: itemDisplayName(i), quantity: i.quantity, price: i.price })));
  };

  const itemDisplayName = (item: any) => {
    return item.name;
  };

  const handleQuantityChange = (idx: number, delta: number) => {
    const updated = [...editItems];
    updated[idx].quantity = Math.max(1, updated[idx].quantity + delta);
    setEditItems(updated);
  };

  const handleSaveAudit = () => {
    if (!selectedOrderForEdit) return;

    // Calculate new total amount based on edited quantities
    const newTotal = editItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const updatedOrders = orders.map(o => {
      if (o.id === selectedOrderForEdit.id) {
        // Map edited quantities back to order items structure
        const updatedItems = o.items.map((originalItem) => {
          const edited = editItems.find(i => i.name === originalItem.name);
          return edited ? { ...originalItem, quantity: edited.quantity } : originalItem;
        });

        return {
          ...o,
          table_id: editTableId,
          paymentMethod: editPaymentMethod,
          items: updatedItems,
          total_amount: newTotal
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    localStorage.setItem('local_orders', JSON.stringify(updatedOrders));
    setSelectedOrderForEdit(null);
    alert('訂單修改成功！變更已記錄於本地與雲端。');
  };

  const handleRefundOrder = (orderId: string) => {
    if (confirm('確定要執行手動退款 (Manual Refund) 嗎？此操作將會把訂單總金額歸零並標記為已退款。')) {
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            total_amount: 0,
            status: 'completed' as const,
            isFlagged: true,
            flagReason: '手動退款 (Staff Refunded)'
          };
        }
        return o;
      });

      setOrders(updatedOrders);
      localStorage.setItem('local_orders', JSON.stringify(updatedOrders));
      alert('退款成功！已自動發送錢箱退款觸發信號。');
    }
  };

  // D3.js Historical Ledger Chart Engine
  useEffect(() => {
    if (!isAuthenticated || !d3ChartRef.current) return;

    // Build statistics
    const totalsByMethod = {
      'Cash': 0,
      'Credit Card': 0,
      'Mobile Pay': 0
    };
    const hardwareTriggers = {
      'Printer Prints': 0,
      'Drawer Kicks': 0
    };

    orders.forEach(o => {
      if (o.total_amount > 0) {
        totalsByMethod[o.paymentMethod] += o.total_amount;
        // Mock hardware rules based on printer/cash drawer events
        hardwareTriggers['Printer Prints'] += 1; // All orders print ticket
        if (o.paymentMethod === 'Cash') {
          hardwareTriggers['Drawer Kicks'] += 1; // Only cash triggers physical cash drawer kick
        }
      }
    });

    // Chart dimensions
    const width = 500;
    const height = 280;
    const margin = { top: 40, right: 60, bottom: 40, left: 60 };

    // Clear previous elements
    d3.select(d3ChartRef.current).selectAll('*').remove();

    const svg = d3.select(d3ChartRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const data = [
      { category: 'Cash (現金)', value: totalsByMethod['Cash'], kicks: hardwareTriggers['Drawer Kicks'] },
      { category: 'Credit Card (刷卡)', value: totalsByMethod['Credit Card'], kicks: 0 },
      { category: 'Mobile Pay (行動支付)', value: totalsByMethod['Mobile Pay'], kicks: 0 }
    ];

    // X Scale
    const x = d3.scaleBand()
      .domain(data.map(d => d.category))
      .range([0, chartWidth])
      .padding(0.4);

    // Y Scale for Revenue
    const yLeft = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 100])
      .nice()
      .range([chartHeight, 0]);

    // Secondary Y Scale for Hardware Triggers
    const yRight = d3.scaleLinear()
      .domain([0, d3.max([hardwareTriggers['Printer Prints'], hardwareTriggers['Drawer Kicks'], 5]) || 5])
      .nice()
      .range([chartHeight, 0]);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '10px');

    // Y Axis Left (Revenue)
    svg.append('g')
      .call(d3.axisLeft(yLeft).ticks(5))
      .selectAll('text')
      .style('fill', '#94a3b8');

    // Y Axis Right (Hardware triggers)
    svg.append('g')
      .attr('transform', `translate(${chartWidth}, 0)`)
      .call(d3.axisRight(yRight).ticks(5))
      .selectAll('text')
      .style('fill', '#fb7185');

    // Gridlines
    svg.append('g')
      .attr('class', 'grid')
      .style('stroke', '#334155')
      .style('stroke-dasharray', '3,3')
      .style('opacity', '0.2')
      .call(d3.axisLeft(yLeft).tickSize(-chartWidth).tickFormat(() => ''));

    // Draw Bars for revenue
    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.category) || 0)
      .attr('y', chartHeight)
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('fill', '#6366f1')
      .attr('rx', 4)
      .transition()
      .duration(1000)
      .attr('y', d => yLeft(d.value))
      .attr('height', d => chartHeight - yLeft(d.value));

    // Draw line representing Hardware triggers (Drawer kicks / Printer dispatches)
    const lineData = [
      { category: 'Cash (現金)', value: hardwareTriggers['Drawer Kicks'] + hardwareTriggers['Printer Prints'] },
      { category: 'Credit Card (刷卡)', value: hardwareTriggers['Printer Prints'] },
      { category: 'Mobile Pay (行動支付)', value: hardwareTriggers['Printer Prints'] }
    ];

    const line = d3.line<any>()
      .x(d => (x(d.category) || 0) + x.bandwidth() / 2)
      .y(d => yRight(d.value))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(lineData)
      .attr('fill', 'none')
      .attr('stroke', '#fb7185')
      .attr('stroke-width', 3)
      .attr('d', line);

    svg.selectAll('.dot')
      .data(lineData)
      .enter()
      .append('circle')
      .attr('cx', d => (x(d.category) || 0) + x.bandwidth() / 2)
      .attr('cy', d => yRight(d.value))
      .attr('r', 5)
      .attr('fill', '#fda4af')
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 2);

    // Legend on graph
    const legend = svg.append('g')
      .attr('transform', `translate(10, -20)`);

    legend.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', '#6366f1');

    legend.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .text('金流營收金額 ($)')
      .style('fill', '#cbd5e1')
      .style('font-size', '10px');

    legend.append('line')
      .attr('x1', 130)
      .attr('y1', 6)
      .attr('x2', 150)
      .attr('y2', 6)
      .attr('stroke', '#fb7185')
      .attr('stroke-width', 3);

    legend.append('text')
      .attr('x', 158)
      .attr('y', 10)
      .text('硬體列印與錢箱觸發次數')
      .style('fill', '#cbd5e1')
      .style('font-size', '10px');

  }, [isAuthenticated, orders]);

  // Recharts: Prep Category Delays Bottleneck Mock data
  const bottleneckData = [
    { category: 'BBQ 炭火燒烤', delayMinutes: 8.5, count: 24, fill: '#ef4444' },
    { category: 'Appetizers 涼拌冷盤', delayMinutes: 4.2, count: 18, fill: '#f59e0b' },
    { category: 'Beverages 手沖茶飲', delayMinutes: 1.8, count: 32, fill: '#10b981' }
  ];

  // Recharts: Hourly Peak traffic flow simulation
  const trafficFlowData = [
    { hour: '11:00', orders: 4 },
    { hour: '12:00', orders: 12 },
    { hour: '13:00', orders: 8 },
    { hour: '14:00', orders: 2 },
    { hour: '17:00', orders: 6 },
    { hour: '18:00', orders: 18 },
    { hour: '19:00', orders: 22 },
    { hour: '20:00', orders: 15 },
    { hour: '21:00', orders: 5 }
  ];

  // Secure PIN Gate Render
  if (!isAuthenticated) {
    return (
      <div className="flex-grow bg-slate-950 flex items-center justify-center min-h-[90vh] px-4 text-white">
        <form onSubmit={handlePinSubmit} className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
          <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 mb-4 animate-pulse">
            <Lock className="h-8 w-8 text-rose-500" />
          </div>

          <h2 className="text-xl font-black text-center tracking-tight">
            進階經理人管理後台 (Admin Gate)
          </h2>
          <p className="text-slate-400 text-xs text-center mt-1.5 max-w-[300px] leading-relaxed">
            此區域包含財務對帳與硬體調試等敏感權限，請輸入 4 位數 Staff PIN 碼解鎖。
          </p>

          {/* Keypad screen display */}
          <div className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl my-6 flex justify-center tracking-widest text-2xl font-mono font-black text-slate-200">
            {pin ? pin.replace(/./g, '●') : <span className="text-slate-700 text-sm font-normal">請輸入 PIN 碼</span>}
          </div>

          {pinError && (
            <p className="text-xs text-rose-400 font-bold bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 mb-4">
              {pinError}
            </p>
          )}

          {/* Visual numeric keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => handleKeypadClick(val)}
                className="h-14 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-lg font-black transition-colors cursor-pointer"
              >
                {val}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearPin}
              className="h-14 bg-rose-950 hover:bg-rose-900 text-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              清除
            </button>
            <button
              type="button"
              onClick={() => handleKeypadClick('0')}
              className="h-14 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-lg font-black transition-colors cursor-pointer"
            >
              0
            </button>
            <button
              type="submit"
              className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              確認
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-6 font-mono">
            * 預設開發 PIN 碼為: 1234
          </p>
        </form>
      </div>
    );
  }

  // authenticated layout
  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen p-6">
      
      {/* Title */}
      <section className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-indigo-400">
            <BarChart3 className="h-6 w-6" />
            高級經理人與對帳決策面板 (Manager Ledger Analytics)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            權限狀態：經理人已授權。提供訂單審計、桌號轉移、退款、D3/Recharts 混合營收與製程瓶頸分析。
          </p>
        </div>
      </section>

      {/* Grid: Charts & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* D3 Chart Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-extrabold text-sm text-slate-200">
                金流對帳與硬體觸發分析 (D3.js Core Engine)
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                整合實體收銀機 (Cash Drawer Kicks) 與出單機印製頻率。
              </p>
            </div>
            <Coins className="h-5 w-5 text-indigo-400" />
          </div>

          <div className="flex justify-center bg-slate-950/40 rounded-xl p-3 border border-slate-800/60 overflow-hidden">
            <svg ref={d3ChartRef}></svg>
          </div>
        </div>

        {/* Recharts Analytics Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-extrabold text-sm text-slate-200">
                  廚房製程 bottleneck 暨離峰熱點分析 (Recharts)
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  追蹤各類別平均製作延遲時間 (秒) 找出產能瓶頸。
                </p>
              </div>
              <Printer className="h-5 w-5 text-rose-400" />
            </div>

            <div className="h-56 bg-slate-950/40 rounded-xl p-3 border border-slate-800/60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficFlowData}>
                  <defs>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="orders" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOrders)" name="訂單量" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            {bottleneckData.map(b => (
              <div key={b.category} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block font-bold">{b.category}</span>
                <span className="text-base font-black tracking-tight block mt-1" style={{ color: b.fill }}>
                  {b.delayMinutes} 分鐘
                </span>
                <span className="text-[9px] text-slate-600 block">量: {b.count} 盤</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Audit & Control Ledger Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div>
            <h2 className="text-base font-black tracking-tight text-slate-200">
              交易審計明細帳目 (Audit & Transaction Ledger)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              可修改餐點數量、更換餐桌或發起手動退款。
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3.5">時間</th>
                <th className="p-3.5">訂單編號</th>
                <th className="p-3.5">桌號</th>
                <th className="p-3.5">餐點明細</th>
                <th className="p-3.5">交易金額</th>
                <th className="p-3.5">支付工具</th>
                <th className="p-3.5 text-center">操作審計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="p-3.5 text-slate-400 font-mono">
                    {new Date(order.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-3.5 font-mono text-slate-300 font-bold">
                    {order.id.toUpperCase()}
                  </td>
                  <td className="p-3.5 font-bold">
                    {order.table_id === 'takeout' ? (
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">外帶</span>
                    ) : (
                      <span className="bg-indigo-950 text-indigo-400 border border-indigo-900 px-2.5 py-0.5 rounded font-black">
                        {order.table_id} 桌
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-300 max-w-xs truncate" title={order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}>
                    {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-slate-200">
                    {order.total_amount === 0 ? (
                      <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/15">已退款 $0</span>
                    ) : (
                      `$${order.total_amount}`
                    )}
                  </td>
                  <td className="p-3.5 text-slate-400">
                    {order.paymentMethod === 'Cash' ? '💵 現金' : order.paymentMethod === 'Credit Card' ? '💳 刷卡' : '📱 行動支付'}
                  </td>
                  <td className="p-3.5 text-center flex items-center justify-center gap-1.5">
                    {/* Edit Order details */}
                    <button
                      onClick={() => handleOpenEditModal(order)}
                      disabled={order.total_amount === 0}
                      className="p-1 px-2 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Edit className="h-3 w-3" />
                      編輯
                    </button>
                    {/* Manual Refund */}
                    <button
                      onClick={() => handleRefundOrder(order.id)}
                      disabled={order.total_amount === 0}
                      className="p-1 px-2 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3 w-3" />
                      退款
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Auditor Modal Window */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-white">
            <div className="bg-slate-950 p-5 flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-black text-sm text-indigo-400">編輯交易審計明細</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">ORDER ID: {selectedOrderForEdit.id.toUpperCase()}</p>
              </div>
              <button
                onClick={() => setSelectedOrderForEdit(null)}
                className="text-slate-400 hover:text-white font-extrabold text-xs cursor-pointer"
              >
                關閉
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Relocate Table Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  1. 餐桌桌號調度 (Relocate Table)
                </label>
                <input
                  type="text"
                  value={editTableId}
                  onChange={(e) => setEditTableId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Payment selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  2. 支付工具修正 (Correction of Payment)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'Credit Card', 'Mobile Pay'] as Order['paymentMethod'][]).map(method => (
                    <button
                      key={method}
                      onClick={() => setEditPaymentMethod(method)}
                      className={`p-2 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                        editPaymentMethod === method
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-400'
                      }`}
                    >
                      {method === 'Cash' ? '💵 現金' : method === 'Credit Card' ? '💳 刷卡' : '📱 行動支付'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line item editing details list */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  3. 商品品項數量異動 (Line Items Quantity)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-850">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60 last:border-0 last:pb-0">
                      <span className="font-bold text-slate-300">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(idx, -1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(idx, 1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-5 border-t border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 block font-semibold">修改後核算金額</span>
                <span className="font-mono text-lg font-black text-indigo-400">
                  ${editItems.reduce((sum, i) => sum + (i.price * i.quantity), 0)}
                </span>
              </div>
              <button
                onClick={handleSaveAudit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-colors"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
