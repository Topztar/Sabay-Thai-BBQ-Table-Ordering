import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { OfflineQueueProvider, useOfflineQueue } from './components/OfflineQueueContext';
import { OfflineQueueHUD } from './components/OfflineQueueHUD';
import { CustomerOrderView } from './components/CustomerOrderView';
import { KitchenDisplaySystem } from './components/KitchenDisplaySystem';
import { ManagerDashboard } from './components/ManagerDashboard';
import { TenantManagementView } from './components/TenantManagementView';
import { CentralizedMenuView } from './components/CentralizedMenuView';
import { UserManagementView } from './components/UserManagementView';
import { UserRole } from './types';
import {
  Flame,
  Monitor,
  Shield,
  Building,
  ArrowLeft,
  Lock,
  Delete,
  KeyRound,
  AlertCircle,
  Database,
  WifiOff,
  Maximize,
  Minimize,
  Sparkles,
  Check,
  AlertTriangle,
  Users
} from 'lucide-react';

type AdminViewMode = 'kds' | 'manager' | 'tenant-admin' | 'central-menu' | 'user-management';

function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const { tenants, loginSession } = useOfflineQueue();
  const [role, setRole] = useState<UserRole>('SUPER_ADMIN');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('DEFAULT');
  const [pin, setPin] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [lockoutTime, setLockoutTime] = useState<number>(0);

  // Set default selected branch when tenants load
  useEffect(() => {
    if (tenants.length > 0 && !tenants.some(t => t.id === selectedBranchId)) {
      setSelectedBranchId(tenants[0].id);
    }
  }, [tenants, selectedBranchId]);

  // Handle countdown for lockout state
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFailedCount(0); // Reset failures on lockout expiry
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const isDisabled = isVerifying || lockoutTime > 0;

  const handleKeyPress = async (num: string) => {
    if (isDisabled) return;
    setError('');
    
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 6) {
        setIsVerifying(true);
        const success = await loginSession(role, selectedBranchId, newPin);
        
        if (success) {
          setTimeout(() => {
            onSuccess();
            setIsVerifying(false);
            setFailedCount(0);
          }, 150);
        } else {
          const nextFailed = failedCount + 1;
          setFailedCount(nextFailed);

          setTimeout(() => {
            setPin('');
            setIsVerifying(false);
            if (nextFailed >= 3) {
              setError('連續錯誤 3 次，系統已鎖定 60 秒');
              setLockoutTime(60);
            } else {
              setError(`密碼錯誤，請重新輸入 (剩餘嘗試次數: ${3 - nextFailed})`);
            }
          }, 400); // Allow brief visual delay of filled dots before clearing
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isDisabled) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isDisabled) return;
    setError('');
    setPin('');
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setError('');

    const uName = adminUsername.trim();
    const uPass = adminPassword.trim();

    if (!uName) {
      setError('請輸入最高管理員帳號！');
      return;
    }
    if (!uPass) {
      setError('請輸入安全登入密碼！');
      return;
    }

    setIsVerifying(true);
    const success = await loginSession('SUPER_ADMIN', 'ALL', uPass, uName);

    if (success) {
      setTimeout(() => {
        onSuccess();
        setIsVerifying(false);
        setFailedCount(0);
      }, 150);
    } else {
      const nextFailed = failedCount + 1;
      setFailedCount(nextFailed);
      setIsVerifying(false);
      if (nextFailed >= 3) {
        setError('帳密連續錯誤 3 次，系統已鎖定 60 秒');
        setLockoutTime(60);
      } else {
        setError(`帳號或密碼錯誤，請重新輸入 (剩餘嘗試次數: ${3 - nextFailed})`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans antialiased">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/85 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col items-center">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          {lockoutTime > 0 ? (
            <div className="relative w-20 h-20 flex items-center justify-center mb-4">
              {/* Circle Progress SVG */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-slate-800"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-amber-500 transition-all duration-1000 ease-linear"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="263.9"
                  strokeDashoffset={263.9 * (1 - lockoutTime / 60)}
                />
              </svg>
              
              <div className="flex flex-col items-center justify-center text-white relative z-10">
                <Lock className="h-4 w-4 text-amber-500 animate-pulse" />
                <span className="text-xs font-black font-mono mt-0.5 text-amber-400">{lockoutTime}s</span>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-3.5 rounded-2xl text-white shadow-xl shadow-indigo-500/10 mb-4 animate-pulse">
              <Lock className="h-6 w-6" />
            </div>
          )}
          <h2 className="text-lg font-black tracking-wider text-white">安全身分驗證</h2>
          <p className="text-slate-400 text-[11px] mt-1.5 font-bold">
            {lockoutTime > 0 
              ? '系統鎖定中，請稍候' 
              : role === 'SUPER_ADMIN' 
                ? '高級管理員登入請輸入帳號與密碼' 
                : '使用者登入請選取駐點分店並輸入 6 位數安全 PIN 碼'}
          </p>
        </div>

        {/* Role Select Options */}
        <div className="flex gap-3.5 w-full mb-5">
          <button
            type="button"
            onClick={() => { setRole('SUPER_ADMIN'); setPin(''); setError(''); setAdminUsername(''); setAdminPassword(''); }}
            disabled={isDisabled}
            className={`flex-1 py-3.5 rounded-2xl border text-[11px] font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              role === 'SUPER_ADMIN'
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-inner'
                : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-800'
            }`}
          >
            <Shield className="h-4.5 w-4.5" />
            <span>高級管理員登入</span>
          </button>
          <button
            type="button"
            onClick={() => { setRole('BRANCH_STAFF'); setPin(''); setError(''); }}
            disabled={isDisabled}
            className={`flex-1 py-3.5 rounded-2xl border text-[11px] font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              role === 'BRANCH_STAFF'
                ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-inner'
                : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-800'
            }`}
          >
            <Building className="h-4.5 w-4.5" />
            <span>使用者登入</span>
          </button>
        </div>

        {/* Dynamic Forms / Input areas based on role selection */}
        {role === 'SUPER_ADMIN' ? (
          /* SUPER ADMIN: Account & Password input layout */
          <form onSubmit={handleAdminSubmit} className="w-full space-y-4 mb-5">
            <div>
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">高級管理員帳號 (Account)</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => { setError(''); setAdminUsername(e.target.value); }}
                disabled={isDisabled}
                placeholder="預設為 topztar"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-700"
              />
            </div>
            
            <div>
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">安全驗證密碼 (Password)</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => { setError(''); setAdminPassword(e.target.value); }}
                disabled={isDisabled}
                placeholder="預設為 Eur0pe2266"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-700"
              />
            </div>

            {/* Error Notification / Cooldown info */}
            <div className="h-8 flex items-center justify-center text-center">
              {lockoutTime > 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/20 px-4 py-1 rounded-full">
                  <span className="animate-spin h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full" />
                  <span>鎖定中！請等待 {lockoutTime} 秒</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-extrabold bg-red-500/10 border border-red-500/20 px-3.5 py-1 rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <KeyRound className="h-3 w-3" />
                  <span>請輸入帳號 topztar 及密碼</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className={`w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>驗證身分中...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>登入後台系統</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* BRANCH STAFF: Branch Dropdown & 6-dot bullet indicators with numeric tactile keypad layout */
          <>
            {/* Branch Select Dropdown */}
            <div className="w-full mb-5 animate-fade-in">
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">選擇駐點店別 (Branch Target)</label>
              <select
                value={selectedBranchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); setPin(''); setError(''); }}
                disabled={isDisabled}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-black text-white rounded-xl py-2.5 px-3 focus:outline-none focus:border-indigo-500"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Bullet Pin Indicators */}
            <div className="flex justify-center gap-3.5 mb-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 border ${
                    lockoutTime > 0
                      ? 'bg-slate-800 border-slate-700/60'
                      : i < pin.length
                        ? 'bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/50 scale-110'
                        : 'bg-slate-950 border-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Error Notification / Cooldown info */}
            <div className="h-8 mb-4 flex items-center justify-center text-center">
              {lockoutTime > 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/20 px-4 py-1 rounded-full">
                  <span className="animate-spin h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full" />
                  <span>鎖定中！請等待 {lockoutTime} 秒後再試</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-extrabold bg-red-500/10 border border-red-500/20 px-3.5 py-1 rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <KeyRound className="h-3 w-3" />
                  <span>
                    店員預設：{selectedBranchId === 'DEFAULT' ? '111111' : selectedBranchId === 'EAST_BRANCH' ? '222222' : '333333'}
                  </span>
                </div>
              )}
            </div>

            {/* tactile numpad grid */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  disabled={isDisabled}
                  className={`h-14 rounded-2xl bg-slate-950/40 border border-slate-850 text-white font-black text-lg transition-all flex items-center justify-center select-none ${
                    isDisabled
                      ? 'opacity-25 cursor-not-allowed bg-slate-950/10'
                      : 'hover:bg-slate-800/80 active:bg-slate-700/80 cursor-pointer'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                disabled={isDisabled}
                className={`h-14 rounded-2xl text-slate-500 hover:text-slate-300 font-extrabold text-xs transition-all flex items-center justify-center select-none border border-transparent ${
                  isDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-slate-800/20 cursor-pointer'
                }`}
              >
                清除
              </button>
              <button
                onClick={() => handleKeyPress('0')}
                disabled={isDisabled}
                className={`h-14 rounded-2xl bg-slate-950/40 border border-slate-850 text-white font-black text-lg transition-all flex items-center justify-center select-none ${
                  isDisabled
                    ? 'opacity-25 cursor-not-allowed bg-slate-950/10'
                    : 'hover:bg-slate-800/80 active:bg-slate-700/80 cursor-pointer'
                }`}
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={isDisabled}
                className={`h-14 rounded-2xl text-slate-500 hover:text-slate-300 font-extrabold transition-all flex items-center justify-center select-none border border-transparent ${
                  isDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-slate-800/20 cursor-pointer'
                }`}
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {/* Back Link */}
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white font-extrabold transition-all px-4 py-2 bg-slate-950/40 hover:bg-slate-850/60 border border-slate-850/60 rounded-xl cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回點餐前台</span>
        </Link>
      </div>
    </div>
  );
}

function AdminSystem() {
  const { session, logoutSession, queue, tenants, currentTenantId, setCurrentTenantId, isOnline, simulatedOffline } = useOfflineQueue();
  const [currentView, setCurrentView] = useState<AdminViewMode>('kds');
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const hasUnsyncedData = queue.length > 0;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);

  // Strictly enforce that BRANCH_STAFF can only access the KDS kitchen view
  useEffect(() => {
    if (session?.role === 'BRANCH_STAFF') {
      setCurrentView('kds');
    }
  }, [session]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Track system idle state (15s of inactivity triggers slow breathing animation)
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;
    const resetTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, 15000); // 15 seconds
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      clearTimeout(idleTimer);
    };
  }, []);

  if (!session) {
    return <PinGate onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 font-sans antialiased text-slate-100">
      {/* Synchronization HUD */}
      <OfflineQueueHUD />

      {/* Backend Premium Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`bg-red-600 p-2 rounded-xl text-white shadow-lg shadow-red-600/30 transition-all duration-1000 ${
            isIdle
              ? 'animate-[pulse_3s_ease-in-out_infinite] scale-95 opacity-70'
              : 'animate-[pulse_1s_ease-in-out_infinite] scale-100 opacity-100'
          }`}>
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-white">Sabay Thai BBQ 后台系統</h1>
              {isIdle && (
                <span className="bg-slate-900 text-[9px] text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                  系統閒置中 (Idle)
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">SECURE MANAGEMENT PANEL // PORTAL</p>
          </div>
        </div>

        {/* Super Admin Global Branch Context Switcher & Visual Status Card */}
        {session.role === 'SUPER_ADMIN' && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-slate-900/60 p-2.5 rounded-2xl border border-indigo-950">
            {/* Context Selector */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl">
              <span className="text-[10.5px] font-black text-indigo-400 uppercase tracking-wide">
                切換分店：
              </span>
              <select
                value={currentTenantId}
                onChange={(e) => setCurrentTenantId(e.target.value)}
                className="bg-slate-950 border-none text-xs font-black text-white rounded-lg py-0.5 px-1 focus:outline-none cursor-pointer"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Tenant Visual Indicator Status Card */}
            {(() => {
              const activeTenant = tenants.find(t => t.id === currentTenantId) || tenants[0];
              const branchUnsyncedJobs = queue.filter(job => {
                let tenantId = 'DEFAULT';
                if (job.payload?.tenantId) {
                  tenantId = job.payload.tenantId;
                } else if (job.url?.includes('/tenants/')) {
                  tenantId = job.url.split('/tenants/')[1]?.split('/')[0] || 'DEFAULT';
                }
                return tenantId === currentTenantId;
              });
              const branchUnsyncedCount = branchUnsyncedJobs.length;
              const isActuallyOnline = isOnline && !simulatedOffline;

              return (
                <div className="flex items-center gap-3.5 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-850 text-xs">
                  {/* Branch Details */}
                  <div className="flex flex-col">
                    <span className="font-black text-slate-100 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      {activeTenant?.name}
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-mono">
                      分店編號：<span className="text-indigo-400 font-bold">{currentTenantId}</span>
                    </span>
                  </div>

                  <span className="text-slate-800 text-[10px]">|</span>

                  {/* Sync Status Badge */}
                  <div className="flex items-center gap-2">
                    {/* Mode (Online vs Offline) */}
                    <span className={`text-[9.5px] px-2 py-0.5 rounded font-black border uppercase ${
                      isActuallyOnline
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                        : 'bg-red-950/40 text-red-400 border-red-900/30'
                    }`}>
                      {isActuallyOnline ? 'Live Sync' : 'Offline Cache'}
                    </span>

                    {/* Data Status */}
                    {branchUnsyncedCount > 0 ? (
                      <span className="text-[9.5px] bg-amber-950/50 text-amber-400 border border-amber-900/40 px-2 py-0.5 rounded font-bold animate-pulse flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>未同步 ({branchUnsyncedCount} 筆)</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] bg-slate-900 text-slate-400 border border-slate-850 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>數據同頻</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Locked branch for Branch Staff */}
        {session.role === 'BRANCH_STAFF' && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/65 border border-slate-800 rounded-2xl">
            <span className="text-[10px] text-slate-400 font-black uppercase">當前駐店：</span>
            <span className="text-xs font-black text-emerald-400">{session.branchName}</span>
          </div>
        )}

        {/* Offline Sync Notification Status Indicator */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="relative flex items-center justify-center">
            {hasUnsyncedData ? (
              <>
                <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-500 opacity-75" />
              </>
            ) : (
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {hasUnsyncedData ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-red-500 animate-bounce" />
                  <span className="text-xs font-black text-red-400">未同步離線 ({queue.length} 筆)</span>
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-400">數據已同步</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
            title="切換全螢幕模式"
          >
            {isFullscreen ? (
              <>
                <Minimize className="h-3.5 w-3.5 text-indigo-400" />
                <span>退出全螢幕</span>
              </>
            ) : (
              <>
                <Maximize className="h-3.5 w-3.5 text-indigo-400" />
                <span>全螢幕模式</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={logoutSession}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/20 cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>安全登出</span>
          </button>

          {/* Back to Customer Link */}
          <Link 
            to="/" 
            className="flex items-center gap-1.5 px-4.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回點餐前台</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col pb-28 bg-slate-950/20">
        {currentView === 'kds' && <KitchenDisplaySystem />}
        {currentView === 'manager' && session.role === 'SUPER_ADMIN' && <ManagerDashboard />}
        {currentView === 'tenant-admin' && session.role === 'SUPER_ADMIN' && <TenantManagementView />}
        {currentView === 'central-menu' && session.role === 'SUPER_ADMIN' && <CentralizedMenuView />}
        {currentView === 'user-management' && session.role === 'SUPER_ADMIN' && <UserManagementView />}
      </main>

      {/* Persistent Premium Tab Controller (Sticky Bottom Navigation for Admin only) */}
      {session.role === 'SUPER_ADMIN' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-white shadow-2xl py-3 px-4">
          <div className="max-w-5xl mx-auto flex justify-around items-center gap-3">
            
            {/* Kitchen Display View Tab */}
            <button
              onClick={() => setCurrentView('kds')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'kds'
                  ? 'bg-indigo-600 text-white font-black scale-105 shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Monitor className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">1. KDS 廚房端</span>
            </button>

            {/* Manager Dashboard View Tab */}
            <button
              onClick={() => setCurrentView('manager')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'manager'
                  ? 'bg-purple-600 text-white font-black scale-105 shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">2. 經理人後台</span>
            </button>

            {/* Tenant Admin View Tab */}
            <button
              onClick={() => setCurrentView('tenant-admin')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'tenant-admin'
                  ? 'bg-violet-600 text-white font-black scale-105 shadow-lg shadow-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Building className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">3. 集團多租戶</span>
            </button>

            {/* Centralized Menu View Tab */}
            <button
              onClick={() => setCurrentView('central-menu')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'central-menu'
                  ? 'bg-emerald-600 text-white font-black scale-105 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">4. 菜單分發中心</span>
            </button>

            {/* User Credentials View Tab */}
            <button
              onClick={() => setCurrentView('user-management')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'user-management'
                  ? 'bg-rose-600 text-white font-black scale-105 shadow-lg shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">5. 帳號權限管理</span>
            </button>

          </div>
        </nav>
      )}
    </div>
  );
}

function CustomerSystem() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      <main className="flex-grow flex flex-col">
        <CustomerOrderView />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <OfflineQueueProvider>
        <Routes>
          {/* Customer Front-End Portal */}
          <Route path="/" element={<CustomerSystem />} />
          
          {/* Backend Manager Portal Entrance */}
          <Route path="/FSY20260606" element={<AdminSystem />} />
          
          {/* Fallback route back to customer view */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OfflineQueueProvider>
    </Router>
  );
}
