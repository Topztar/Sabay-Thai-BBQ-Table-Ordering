import fs from 'fs';

const appPath = './src/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add import for GlobalContext
content = content.replace(
  `import { useState, useEffect, useRef } from 'react';`,
  `import { useState, useEffect, useRef } from 'react';\nimport { useGlobalState } from './contexts/GlobalContext';`
);

// 2. Remove imports that are no longer needed if we want, but let's keep them for now, eslint can fix them later.

// 3. Find the export default function App() { and insert the useGlobalState hook
const hookStr = `
  const {
    lang, setLang, menuItems, setMenuItems, ingredients, setIngredients, orders, setOrders,
    categories, setCategories, tables, setTables, reservations, minSpend, promoCombo,
    operatingHours, isOpen, restDays, customerNotice, servicePaused, popularItemIds,
    memberPointsRatio, memberRewards, printLogs, printerIp, pushNotifications, analytics,
    loading, offlineQueue, isSyncing, syncProgressMsg, isNetworkOnline, fetchData, handleForceSync
  } = useGlobalState();

  const handleLanguageChange = setLang;
`;

content = content.replace(
  `export default function App() {`,
  `export default function App() {\n${hookStr}`
);

// 4. Remove the block from const [lang, setLang] up to right before const [activeTab, setActiveTab]
const langBlockStart = content.indexOf(`const [lang, setLang] = useState<Language>(() => {`);
const activeTabStart = content.indexOf(`const [activeTab, setActiveTab] = useState<'customer' | 'kitchen' | 'admin' | 'cashier'>(`);
if (langBlockStart !== -1 && activeTabStart !== -1) {
  content = content.slice(0, langBlockStart) + content.slice(activeTabStart);
}

// 5. Remove the block from enrichMenuItems up to right before Real-time Table Status Auto-Sync
const enrichStart = content.indexOf(`// Helper to enrich menu items`);
const tableSyncStart = content.indexOf(`// 🔄 自動連動桌席狀態與訂單/KDS/預約`);
if (enrichStart !== -1 && tableSyncStart !== -1) {
  content = content.slice(0, enrichStart) + content.slice(tableSyncStart);
}

// 6. Remove the legacy handleLanguageChange if we didn't remove it in step 4
const handleLangStart = content.indexOf(`const handleLanguageChange = (newLang: Language) => {`);
if (handleLangStart !== -1 && handleLangStart < activeTabStart) {
  // It was already removed in step 4.
}

fs.writeFileSync(appPath, content);
console.log('App.tsx refactored successfully.');
