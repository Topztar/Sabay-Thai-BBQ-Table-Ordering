import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

function OrderSystem() {
  const query = new URLSearchParams(useLocation().search);
  const tenantId = query.get('tenantId') || 'DEFAULT';
  const tableId = query.get('tableId') || 'Counter';

  // 實作持久化守衛：優先從 localStorage 載入快取數據
  const [menu, setMenu] = useState(() => {
    const savedMenu = localStorage.getItem(`menu_${tenantId}`);
    return savedMenu ? JSON.parse(savedMenu) : [];
  });
  const [cart, setCart] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // 使用 useRef 追蹤是否為首次掛載
  const hasLoadedFromCloud = useRef(false);

  useEffect(() => {
    if (!tenantId) return;

    // 嚴謹的啟動序列：1. 驗證 Auth 2. 啟動 Firestore 監聽
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log("Auth State Changed:", user ? "Authenticated" : "Unauthenticated");

      const unsubscribeFirestore = onSnapshot(
        collection(db, 'tenants', tenantId, 'menus'),
        (snapshot) => {
          if (!snapshot.empty) {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 更新狀態並持久化到本地
            setMenu(items);
            localStorage.setItem(`menu_${tenantId}`, JSON.stringify(items));
            hasLoadedFromCloud.current = true;
          } else {
            // 關鍵修復：若 Cloud 回傳空且已有快取，則不執行重設，防止回滾
            console.warn("Cloud menu is empty. Keeping local cache to prevent rollback.");
          }
          setIsInitializing(false);
        },
        (error) => {
          console.error("Firestore error:", error);
          setIsInitializing(false);
        }
      );

      return () => unsubscribeFirestore();
    });

    return () => unsubscribeAuth();
  }, [tenantId]);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const orderRef = collection(db, 'tenants', tenantId, 'orders');
      await addDoc(orderRef, {
        table_id: tableId,
        items: cart,
        total_amount: cart.reduce((sum, item) => sum + item.price, 0),
        status: 'pending',
        timestamp: new Date()
      });
      alert('訂單已送出！');
      setCart([]);
    } catch (e) {
      console.error(e);
    }
  };

  if (isInitializing && menu.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-600 animate-pulse">正在初始化系統安全環境...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="bg-red-600 text-white p-4 rounded-lg shadow-lg mb-6">
        <h1 className="text-2xl font-bold text-center">Sabay Thai BBQ - 桌號: {tableId}</h1>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">精選菜單</h2>
            {!hasLoadedFromCloud.current && menu.length > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">離線快取模式</span>
            )}
          </div>
          <div className="space-y-4">
            {menu.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b pb-2">
                <span>{item.name}</span>
                <button
                  onClick={() => setCart([...cart, item])}
                  className="bg-green-500 text-white px-4 py-1 rounded hover:bg-green-600"
                >
                  ${item.price} +
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">您的訂單</h2>
          <div className="space-y-2 mb-4">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{item.name}</span>
                <span>${item.price}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between font-bold text-lg mb-4">
              <span>總計:</span>
              <span>${cart.reduce((sum, item) => sum + item.price, 0)}</span>
            </div>
            <button
              onClick={placeOrder}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700"
            >
              確認下單
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <OrderSystem />
    </Router>
  );
}
