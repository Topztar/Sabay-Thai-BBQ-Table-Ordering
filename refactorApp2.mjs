import fs from 'fs';

const appPath = './src/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

const hookOld = `const {
    lang, setLang, menuItems, setMenuItems, ingredients, setIngredients, orders, setOrders,
    categories, setCategories, tables, setTables, reservations, minSpend, promoCombo,
    operatingHours, isOpen, restDays, customerNotice, servicePaused, popularItemIds,
    memberPointsRatio, memberRewards, printLogs, printerIp, pushNotifications, analytics,
    loading, offlineQueue, isSyncing, syncProgressMsg, isNetworkOnline, fetchData, handleForceSync
  } = useGlobalState();`;

const hookNew = `const {
    lang, setLang, menuItems, setMenuItems, ingredients, setIngredients, orders, setOrders,
    categories, setCategories, tables, setTables, reservations, minSpend, setMinSpend, promoCombo, setPromoCombo,
    operatingHours, setOperatingHours, isOpen, setIsOpen, restDays, setRestDays, customerNotice, setCustomerNotice, servicePaused, setServicePaused, popularItemIds, setPopularItemIds,
    memberPointsRatio, setMemberPointsRatio, memberRewards, setMemberRewards, printLogs, setPrintLogs, printerIp, setPrinterIp, pushNotifications, setPushNotifications, analytics, setAnalytics,
    loading, offlineQueue, isSyncing, syncProgressMsg, isNetworkOnline, fetchData, handleForceSync
  } = useGlobalState();
  
  const [localOrderIds, setLocalOrderIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem('sabay-my-submitted-order-ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showContactDetails, setShowContactDetails] = useState(false);
  const activeOrderSubmissionsRef = useRef<Set<string>>(new Set());
  const lastCategoryReorderTimeRef = useRef<number>(0);
  const lastMenuReorderTimeRef = useRef<number>(0);
`;

content = content.replace(hookOld, hookNew);
fs.writeFileSync(appPath, content);
console.log('App.tsx refactored step 2 successfully.');
