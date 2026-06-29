import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useOfflineQueue } from './OfflineQueueContext';
import { MenuItem, CartItem, Order, LanguageResources } from '../types';
import { ShoppingCart, Languages, Clock, ShoppingBag, Info, CheckCircle2, Flame, AlertTriangle, Shield, X, Lock } from 'lucide-react';

const TRANSLATIONS: Record<'zh' | 'en', LanguageResources> = {
  zh: {
    menu: '精選菜單',
    cart: '購物車',
    placeOrder: '確認送出訂單',
    total: '總計',
    table: '桌號',
    takeout: '外帶模式',
    minSpendMsg: '未達最低消費金額限制 $10，還差 $',
    remarksPlaceholder: '例：去蔥、不要辣、小辣...',
    addRemarks: '添加備註與客製化口味',
    addCart: '加入購物車',
    modifiers: '客製化口味',
    subtotal: '小計',
    emptyCart: '購物車目前是空的。點選右方選單加入美味餐點吧！',
    orderSent: '點餐成功！廚房已收到您的訂單！',
    orderSentOffline: '目前處於離線狀態，您的訂單已存入本機發送佇列，連線恢復時將自動同步！',
    orderStatus: '訂單狀態',
    pending: '排隊中 (Pending)',
    preparing: '準備中 (Preparing)',
    completed: '已完成 (Completed)',
    searchMenu: '搜尋菜單...',
    allCategories: '全部類別',
    statusTrackerTitle: '即時訂單狀態追蹤',
    toastCompleted: '您的餐點已完成，服務生正在為您送餐！'
  },
  en: {
    menu: 'Delicious Menu',
    cart: 'Shopping Cart',
    placeOrder: 'Place Order Now',
    total: 'Total Amount',
    table: 'Table',
    takeout: 'Takeout Mode',
    minSpendMsg: 'Minimum spend of $10 not reached, need $',
    remarksPlaceholder: 'e.g. No onion, mild spicy, extra garlic...',
    addRemarks: 'Add special remarks & custom flavors',
    addCart: 'Add to Cart',
    modifiers: 'Modifiers',
    subtotal: 'Subtotal',
    emptyCart: 'Your cart is empty. Tap items on the menu to add!',
    orderSent: 'Order placed successfully! The kitchen is preparing your meal.',
    orderSentOffline: 'Currently offline. Your order is cached in the local sync queue and will upload when connected.',
    orderStatus: 'Order Status',
    pending: 'Pending',
    preparing: 'Preparing',
    completed: 'Completed',
    searchMenu: 'Search menu...',
    allCategories: 'All Categories',
    statusTrackerTitle: 'Real-time KDS Order Tracker',
    toastCompleted: 'Your order is ready! The server will bring it to your table shortly.'
  }
};

const CATEGORIES = ['BBQ', 'Appetizers', 'Beverages'];

export const CustomerOrderView: React.FC = () => {
  const {
    menu,
    orders,
    addOrderToQueue,
    isOnline,
    simulatedOffline,
    tenants,
    currentTenantId
  } = useOfflineQueue();

  const navigate = useNavigate();
  const [showStaffConfirm, setShowStaffConfirm] = useState<boolean>(false);

  // Extract tenantId and tableId from URL search params
  const [tenantId, setTenantId] = useState<string>('DEFAULT');
  const [tableId, setTableId] = useState<string>('Counter-1');
  const [isTakeout, setIsTakeout] = useState<boolean>(false);

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenant = params.get('tenantId') || currentTenantId || 'DEFAULT';
    setTenantId(tenant);

    const matchedTenant = tenants.find(t => t.id === tenant) || tenants[0];
    const defaultTable = matchedTenant && matchedTenant.tables.length > 0 ? matchedTenant.tables[0] : 'Counter-1';
    
    const table = params.get('tableId') || defaultTable;
    setTableId(table);
    setIsTakeout(table.toLowerCase() === 'takeout');
  }, [currentTenantId, tenants]);

  // Find dynamic tenant details
  const activeTenant = tenants.find(t => t.id === tenantId) || tenants[0] || {
    id: 'DEFAULT',
    name: 'Sabay Thai BBQ - 總店',
    nameEn: 'Sabay Thai BBQ - Main Branch',
    minSpend: 10,
    currency: '$',
    tables: ['Counter-1', 'Table-1', 'Table-2']
  };

  const minSpendLimit = activeTenant.minSpend;
  const currencySymbol = activeTenant.currency;

  // i18n
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = TRANSLATIONS[lang];

  // Cart & Catalog
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Modal / Selected Item for Modifiers
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [itemRemarks, setItemRemarks] = useState<string>('');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);

  // Completion Toasts
  const [activeToast, setActiveToast] = useState<{ id: string; tableName: string; message: string } | null>(null);

  // Listen for completed order toast notification
  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<Order>;
      const order = customEvent.detail;
      if (order.table_id === tableId || (isTakeout && order.table_id === 'takeout')) {
        setActiveToast({
          id: order.id,
          tableName: order.table_id === 'takeout' ? t.takeout : `${t.table} ${order.table_id}`,
          message: t.toastCompleted
        });
        // Auto dismiss after 6 seconds
        setTimeout(() => {
          setActiveToast(null);
        }, 6000);
      }
    };

    window.addEventListener('order-completed-toast', handleToast);
    return () => window.removeEventListener('order-completed-toast', handleToast);
  }, [tableId, isTakeout, lang, t]);

  // Modifiers available for items
  const getModifiersForItem = (category: string) => {
    if (category === 'BBQ') {
      return ['小辣 (Mild Spicy)', '大辣 (Extra Spicy)', '不加辣 (No Spicy)', '加醬汁 (Extra Sauce)'];
    }
    if (category === 'Appetizers') {
      return ['去香菜 (No Cilantro)', '多酸 (Extra Sour)', '不加花生 (No Peanut)'];
    }
    if (category === 'Beverages') {
      return ['少冰 (Less Ice)', '去冰 (No Ice)', '少糖 (Less Sugar)', '無糖 (No Sugar)'];
    }
    return [];
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const isBelowMinSpend = cartTotal > 0 && cartTotal < minSpendLimit;

  // Filter menu items based on branch assignment and search/category criteria
  const filteredMenu = menu.filter(item => {
    // Only display if item is assigned to current tenantId (branch)
    const isAssigned = !item.assignedBranches || item.assignedBranches.includes(tenantId);
    if (!isAssigned) return false;

    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Open item modal for modifiers
  const handleItemClick = (item: MenuItem) => {
    setSelectedMenuItem(item);
    setItemRemarks('');
    setSelectedModifiers([]);
  };

  // Add item with modifiers to cart
  const handleConfirmAddToCart = () => {
    if (!selectedMenuItem) return;

    const newCartItem: CartItem = {
      id: Math.random().toString(36).substring(2, 9),
      menuItem: selectedMenuItem,
      quantity: 1,
      remarks: itemRemarks.trim(),
      selectedModifiers: [...selectedModifiers]
    };

    setCart([...cart, newCartItem]);
    setSelectedMenuItem(null);
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart(cart.filter(item => item.id !== cartId));
  };

  // Checkout submit
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (isBelowMinSpend) return;

    const newOrder: Order = {
      id: 'ord-' + Math.random().toString(36).substring(2, 9),
      tenantId: tenantId,
      table_id: isTakeout ? 'takeout' : tableId,
      items: cart.map(item => ({
        name: item.menuItem.name,
        nameEn: item.menuItem.nameEn,
        price: item.menuItem.price,
        quantity: item.quantity,
        remarks: item.remarks,
        selectedModifiers: item.selectedModifiers
      })),
      total_amount: cartTotal,
      status: 'pending',
      timestamp: new Date().toISOString(),
      isFlagged: false,
      paymentMethod: 'Cash'
    };

    await addOrderToQueue(newOrder);
    setCart([]);

    // Custom success dialog
    alert(
      (isOnline && !simulatedOffline)
        ? t.orderSent
        : t.orderSentOffline
    );
  };

  // Extract active customer orders for live KDS tracking
  const currentTableOrders = orders.filter(o => 
    o.tenantId === tenantId && 
    (isTakeout ? o.table_id === 'takeout' : o.table_id === tableId)
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      {/* Toast Notification */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce bg-emerald-600 border border-emerald-500 text-white p-4 rounded-xl shadow-2xl max-w-sm flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-200 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h4 className="font-bold text-sm tracking-wide">{activeToast.tableName}</h4>
            <p className="text-xs text-emerald-100 mt-1">{activeToast.message}</p>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <section className="bg-gradient-to-r from-red-700 to-rose-600 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <Flame className="h-64 w-64 translate-y-12 translate-x-12" />
        </div>
        <div className="max-w-7xl mx-auto px-6 py-6 md:py-8 flex flex-wrap justify-between items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-yellow-400 text-red-950 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow">
                {activeTenant.name}
              </span>
              
              {/* Dynamic table drop-down selector populated from Firestore */}
              <select
                value={tableId}
                onChange={(e) => {
                  const val = e.target.value;
                  setTableId(val);
                  setIsTakeout(val === 'takeout');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tableId', val);
                  window.history.pushState({}, '', url.toString());
                }}
                className="bg-white/15 hover:bg-white/20 text-white font-extrabold text-xs px-3 py-1.5 rounded-full border border-white/20 focus:outline-none cursor-pointer"
              >
                {activeTenant.tables.map(tbl => (
                  <option key={tbl} value={tbl} className="text-slate-900 font-bold">
                    {t.table}: {tbl}
                  </option>
                ))}
                <option value="takeout" className="text-slate-900 font-bold">{t.takeout}</option>
              </select>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1.5">
              {lang === 'zh' ? activeTenant.name : activeTenant.nameEn}
            </h1>
            <p className="text-rose-100 text-xs md:text-sm mt-0.5">
              {lang === 'zh' ? '正宗泰式風味炭火烤肉點餐系統 (連鎖分店沙盒版)' : 'Authentic Charcoal Thai BBQ & Street Delicacies (Multi-Tenant Sandbox)'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border border-white/20 cursor-pointer"
            >
              <Languages className="h-4 w-4" />
              <span>{lang === 'zh' ? 'English' : '繁體中文'}</span>
            </button>
            <Link
              to={`/FSY20260606?tenantId=${tenantId}`}
              onClick={(e) => {
                e.preventDefault();
                setShowStaffConfirm(true);
              }}
              className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md shadow-yellow-500/10 cursor-pointer animate-pulse"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>員工專區 Staff</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Grid - Now Full Width */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Left Side: Category bar, Search, and Catalog Items */}
        <section className="w-full space-y-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center">
            {/* Category Selector */}
            <div className="flex flex-wrap gap-1.5 self-start sm:self-center">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'All'
                    ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.allCategories}
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'BBQ' ? (lang === 'zh' ? '炭火燒烤' : 'BBQ') : cat === 'Appetizers' ? (lang === 'zh' ? '泰式前菜' : 'Appetizers') : (lang === 'zh' ? '特色飲品' : 'Drinks')}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder={t.searchMenu}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
            />
          </div>

          {/* Menu Catalog */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenu.map(item => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="bg-white rounded-2xl border border-slate-100 hover:border-red-500/30 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 p-4"
              >
                {/* Item Thumbnail Placeholder */}
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center text-red-500 font-extrabold border border-slate-100 shrink-0 select-none">
                  <Flame className="h-10 w-10 text-red-500/60" />
                </div>

                {/* Details */}
                <div className="flex flex-col justify-between flex-grow">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">
                      {lang === 'zh' ? item.name : item.nameEn}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                      {lang === 'zh' ? item.description : item.descriptionEn}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="font-mono text-lg font-black text-red-600">${item.price}</span>
                    <button className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 font-extrabold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer">
                      + {t.addCart}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Real-time Order Status Tracker */}
          {currentTableOrders.length > 0 && (
            <div className="bg-white rounded-2xl border border-indigo-50 p-6 shadow-sm">
              <h3 className="text-base font-black text-indigo-950 flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-indigo-600" />
                {t.statusTrackerTitle}
              </h3>
              <div className="space-y-4">
                {currentTableOrders.map(order => (
                  <div key={order.id} className="border-b border-slate-100 pb-3.5 last:pb-0 last:border-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        ID: {order.id.toUpperCase()}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-black ${
                        order.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : order.status === 'preparing'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {order.status === 'completed' ? t.completed : order.status === 'preparing' ? t.preparing : t.pending}
                      </span>
                    </div>

                    {/* Progress visual bar */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                      <div className={`h-full ${order.status === 'pending' || order.status === 'preparing' || order.status === 'completed' ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                      <div className={`h-full ${order.status === 'preparing' || order.status === 'completed' ? 'bg-amber-500 animate-pulse' : 'bg-slate-200'}`}></div>
                      <div className={`h-full ${order.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>{t.total}: ${order.total_amount}</span>
                      <span>{new Date(order.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Floating Cart Trigger Button */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-28 right-6 z-40 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center gap-2 group border border-red-500/30"
      >
        <div className="relative flex items-center">
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -top-3 -right-3 bg-yellow-400 text-red-950 text-[10px] font-black w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-red-600 animate-pulse">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </div>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out text-sm font-black tracking-wide whitespace-nowrap">
          {t.cart} (${cartTotal})
        </span>
      </button>

      {/* Floating Drawer Shopping Cart Window */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            {/* Slide-over panel */}
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full transform transition-transform animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="h-6 w-6 text-red-400" />
                  <h2 className="text-lg font-black tracking-wide">{t.cart}</h2>
                  <span className="bg-slate-800 text-slate-300 text-xs font-black px-2.5 py-0.5 rounded-full border border-slate-700/60">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} {lang === 'zh' ? '份' : 'items'}
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-slate-400 hover:text-white font-extrabold text-sm flex items-center gap-1 bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-xl transition cursor-pointer border-none outline-none"
                >
                  <span>收合</span>
                  <span className="text-lg">&times;</span>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 flex flex-col items-center justify-center gap-4">
                    <div className="bg-slate-50 p-6 rounded-full border border-slate-100">
                      <ShoppingBag className="h-12 w-12 text-slate-300" />
                    </div>
                    <p className="text-xs leading-relaxed max-w-[200px]">{t.emptyCart}</p>
                  </div>
                ) : (
                  <div className="space-y-4 divide-y divide-slate-100">
                    {cart.map((item, idx) => (
                      <div key={item.id} className={`pt-4 ${idx === 0 ? 'pt-0 border-t-0' : ''} flex justify-between gap-3`}>
                        <div className="space-y-1.5 flex-1">
                          <h4 className="font-extrabold text-slate-800 text-sm">
                            {lang === 'zh' ? item.menuItem.name : item.menuItem.nameEn}
                          </h4>
                          {item.selectedModifiers.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.selectedModifiers.map(mod => (
                                <span key={mod} className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] text-slate-600 font-bold">
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.remarks && (
                            <p className="text-rose-600 text-xs italic bg-rose-50/50 p-2 rounded-xl border border-rose-100/50">
                              「 {item.remarks} 」
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex flex-col justify-between items-end">
                          <span className="font-mono font-black text-sm text-slate-800">
                            {currencySymbol}{item.menuItem.price}
                          </span>
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-xs text-rose-500 hover:text-rose-600 font-bold underline mt-1.5 cursor-pointer bg-transparent border-none"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="bg-slate-50 p-6 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">{t.subtotal}</span>
                    <span className="font-mono text-base font-black text-slate-800">{currencySymbol}{cartTotal}</span>
                  </div>

                  {/* Minimum spend alert info */}
                  {isBelowMinSpend && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-800 flex items-start gap-2.5 shadow-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold">未達低消門檻 (Minimum Spend Limit)</p>
                        <p className="text-amber-700 mt-0.5">
                          {t.minSpendMsg}{(minSpendLimit - cartTotal).toFixed(0)}。
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-lg border-t border-slate-200 pt-4 font-black">
                    <span className="text-slate-800">{t.total}</span>
                    <span className="font-mono text-2xl text-red-600">{currencySymbol}{cartTotal}</span>
                  </div>

                  <button
                    onClick={() => {
                      handlePlaceOrder();
                      setIsCartOpen(false);
                    }}
                    disabled={isBelowMinSpend}
                    className={`w-full py-4 rounded-xl font-extrabold text-white text-center shadow-lg transition-all ${
                      isBelowMinSpend
                        ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
                        : 'bg-red-600 hover:bg-red-700 hover:shadow-red-500/20 shadow-md cursor-pointer'
                    }`}
                  >
                    {t.placeOrder}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modifier Selection Modal Dialog */}
      {selectedMenuItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">
                  {lang === 'zh' ? selectedMenuItem.name : selectedMenuItem.nameEn}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">單價: {currencySymbol}{selectedMenuItem.price}</p>
              </div>
              <button
                onClick={() => setSelectedMenuItem(null)}
                className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer"
              >
                關閉 (Close)
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Modifiers List selection */}
              {getModifiersForItem(selectedMenuItem.category).length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {t.modifiers} (Select any)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {getModifiersForItem(selectedMenuItem.category).map(mod => {
                      const isSelected = selectedModifiers.includes(mod);
                      return (
                        <button
                          key={mod}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedModifiers(selectedModifiers.filter(m => m !== mod));
                            } else {
                              setSelectedModifiers([...selectedModifiers, mod]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-red-50 border-red-500 text-red-600'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {mod}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Special Remarks Textbox */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t.addRemarks} (Special Remarks)
                </label>
                <textarea
                  rows={2}
                  value={itemRemarks}
                  onChange={(e) => setItemRemarks(e.target.value)}
                  placeholder={t.remarksPlaceholder}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-400 block font-semibold">{t.total}</span>
                <span className="font-mono text-xl font-black text-red-600">${selectedMenuItem.price}</span>
              </div>
              <button
                onClick={handleConfirmAddToCart}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md cursor-pointer transition-colors"
              >
                {t.addCart}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: IDENTITY CONFIRMATION FOR STAFF AREA */}
      <AnimatePresence>
        {showStaffConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-slate-100"
            >
              <button
                onClick={() => setShowStaffConfirm(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-850 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-3 text-yellow-400 mb-2">
                <div className="bg-yellow-500/15 p-2 rounded-xl border border-yellow-500/30">
                  <Shield className="h-5 w-5 stroke-[2.5]" />
                </div>
                <h2 className="text-lg font-black text-slate-100">
                  {lang === 'zh' ? '確認進入員工專區？' : 'Access Staff Area?'}
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                {lang === 'zh' 
                  ? '本專區僅限 Sabay Thai BBQ 現場店員或系統管理員使用。進入後管理員需提供帳號與密碼以供驗證，店員需輸入 6 位數 PIN 碼。' 
                  : 'This area is restricted to authorized on-site staff and administrators. Admin credentials or a 6-digit security PIN is required to proceed.'}
              </p>

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-300 mb-6 space-y-2 leading-relaxed">
                <h4 className="font-bold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{lang === 'zh' ? '安全身分提示：' : 'Security Notice:'}</span>
                </h4>
                <p>
                  {lang === 'zh' 
                    ? '顧客請勿擅自闖入。若您是店內工作人員，請點選「確認並前往驗證」按鈕；一般顧客請點選「取消」返回。' 
                    : 'Customers are kindly requested to remain on the ordering page. If you are a staff member, click "Confirm and Verify".'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowStaffConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                >
                  {lang === 'zh' ? '取消返回' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffConfirm(false);
                    navigate(`/FSY20260606?tenantId=${tenantId}`);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{lang === 'zh' ? '確認並前往驗證' : 'Confirm & Proceed'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
