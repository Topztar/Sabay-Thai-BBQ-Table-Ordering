import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

function OrderSystem() {
  const query = new URLSearchParams(useLocation().search);
  const tenantId = query.get('tenantId') || 'DEFAULT';
  const tableId = query.get('tableId') || 'Counter';

  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (!tenantId) return;
    // 實作 Phase 1 的路徑隔離監聽
    const unsubscribe = onSnapshot(collection(db, 'tenants', tenantId, 'menus'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(items);
    });
    return () => unsubscribe();
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="bg-red-600 text-white p-4 rounded-lg shadow-lg mb-6">
        <h1 className="text-2xl font-bold text-center">Sabay Thai BBQ - 桌號: {tableId}</h1>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">精選菜單</h2>
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
