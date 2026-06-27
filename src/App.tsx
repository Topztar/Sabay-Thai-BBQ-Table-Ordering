import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { OfflineQueueProvider } from './components/OfflineQueueContext';
import { OfflineQueueHUD } from './components/OfflineQueueHUD';
import { CustomerOrderView } from './components/CustomerOrderView';
import { KitchenDisplaySystem } from './components/KitchenDisplaySystem';
import { ManagerDashboard } from './components/ManagerDashboard';
import { TenantManagementView } from './components/TenantManagementView';
import { Flame, Monitor, Shield, ShoppingBag, Building } from 'lucide-react';

type ViewMode = 'customer' | 'kds' | 'manager' | 'tenant-admin';

function OrderSystem() {
  const [currentView, setCurrentView] = useState<ViewMode>('customer');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      {/* Synchronization HUD */}
      <OfflineQueueHUD />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col pb-24">
        {currentView === 'customer' && <CustomerOrderView />}
        {currentView === 'kds' && <KitchenDisplaySystem />}
        {currentView === 'manager' && <ManagerDashboard />}
        {currentView === 'tenant-admin' && <TenantManagementView />}
      </main>

      {/* Persistent Premium Tab Controller (Sticky Bottom Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-white shadow-2xl py-3 px-4">
        <div className="max-w-5xl mx-auto flex justify-around items-center gap-2">
          
          {/* Customer View Tab */}
          <button
            onClick={() => setCurrentView('customer')}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all cursor-pointer ${
              currentView === 'customer'
                ? 'bg-red-600 text-white font-black scale-105 shadow-lg shadow-red-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[11px] font-bold tracking-wide">1. 顧客點餐端</span>
          </button>

          {/* Kitchen Display View Tab */}
          <button
            onClick={() => setCurrentView('kds')}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all cursor-pointer ${
              currentView === 'kds'
                ? 'bg-indigo-600 text-white font-black scale-105 shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Monitor className="h-5 w-5" />
            <span className="text-[11px] font-bold tracking-wide">2. KDS 廚房端</span>
          </button>

          {/* Manager Dashboard View Tab */}
          <button
            onClick={() => setCurrentView('manager')}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all cursor-pointer ${
              currentView === 'manager'
                ? 'bg-purple-600 text-white font-black scale-105 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="h-5 w-5" />
            <span className="text-[11px] font-bold tracking-wide">3. 經理人後台</span>
          </button>

          {/* Tenant Admin View Tab */}
          <button
            onClick={() => setCurrentView('tenant-admin')}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all cursor-pointer ${
              currentView === 'tenant-admin'
                ? 'bg-violet-600 text-white font-black scale-105 shadow-lg shadow-violet-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building className="h-5 w-5" />
            <span className="text-[11px] font-bold tracking-wide">4. 集團多租戶</span>
          </button>

        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <OfflineQueueProvider>
        <OrderSystem />
      </OfflineQueueProvider>
    </Router>
  );
}
