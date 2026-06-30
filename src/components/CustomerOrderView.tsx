import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useOfflineQueue } from './OfflineQueueContext';
import { MenuItem, CartItem, Order, LanguageResources } from '../types';
import { ShoppingCart, Languages, Clock, ShoppingBag, Info, CheckCircle2, Flame, AlertTriangle, Shield, X, Lock, QrCode, Trash2, Search, Grid, Soup, CupSoda } from 'lucide-react';

const TRANSLATIONS: Record<'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru', LanguageResources> = {
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
  },
  th: {
    menu: 'เมนูแนะนำ',
    cart: 'รถเข็น',
    placeOrder: 'ยืนยันการสั่งซื้อ',
    total: 'รวมทั้งหมด',
    table: 'โต๊ะ',
    takeout: 'สั่งกลับบ้าน',
    minSpendMsg: 'ไม่ถึงยอดสั่งซื้อขั้นต่ำ $10 ขาดอีก $',
    remarksPlaceholder: 'เช่น ไม่ใส่ต้นหอม, ไม่เผ็ด, เผ็ดน้อย...',
    addRemarks: 'เพิ่มหมายเหตุและรสชาติพิเศษ',
    addCart: 'ใส่รถเข็น',
    modifiers: 'รสชาติพิเศษ',
    subtotal: 'ยอดรวมย่อย',
    emptyCart: 'รถเข็นของคุณยังว่างเปล่า เลือกเมนูอร่อยได้เลย!',
    orderSent: 'สั่งอาหารสำเร็จ! ห้องครัวได้รับรายการของคุณแล้ว!',
    orderSentOffline: 'สถานะออฟไลน์ ใบสั่งซื้อของคุณจะซิงค์เมื่อมีการเชื่อมต่อ!',
    orderStatus: 'สถานะคำสั่งซื้อ',
    pending: 'กำลังรอคิว (Pending)',
    preparing: 'กำลังเตรียม (Preparing)',
    completed: 'เสร็จสิ้น (Completed)',
    searchMenu: 'ค้นหาเมนู...',
    allCategories: 'ทุกหมวดหมู่',
    statusTrackerTitle: 'ติดตามสถานะคำสั่งซื้อ',
    toastCompleted: 'อาหารของคุณเสร็จแล้ว บริกรกำลังนำไปเสิร์ฟ!'
  },
  ja: {
    menu: 'おすすめメニュー',
    cart: 'カート',
    placeOrder: '注文を確定する',
    total: '合計',
    table: 'テーブル',
    takeout: 'テイクアウト',
    minSpendMsg: '最低注文金額 $10 に達していません。あと $',
    remarksPlaceholder: '例：ネギ抜き、辛さ控えめ、ニンニク多め...',
    addRemarks: '備考・カスタムフレーバーを追加',
    addCart: 'カートに追加',
    modifiers: 'オプション選択',
    subtotal: '小計',
    emptyCart: 'カートは空です。メニューから追加してください！',
    orderSent: '注文が完了しました！厨房で調理を開始します。',
    orderSentOffline: '現在オフラインです。接続回復時に自動同期されます。',
    orderStatus: '注文ステータス',
    pending: '待機중 (Pending)',
    preparing: '準備中 (Preparing)',
    completed: '完了 (Completed)',
    searchMenu: 'メニューを検索...',
    allCategories: 'すべてのカテゴリー',
    statusTrackerTitle: 'リアルタイム注文追跡',
    toastCompleted: 'お料理が完成しました！すぐにお持ちします。'
  },
  ko: {
    menu: '추천 메뉴',
    cart: '장바구니',
    placeOrder: '주문하기',
    total: '총액',
    table: '테이블',
    takeout: '테이크아웃',
    minSpendMsg: '최소 주문 금액 $10 미달, 부족한 금액 $',
    remarksPlaceholder: '예: 파 빼고, 덜 맵게, 마늘 많이...',
    addRemarks: '추가 요청사항 및 옵션 선택',
    addCart: '장바구니 담기',
    modifiers: '옵션 선택',
    subtotal: '소계',
    emptyCart: '장바구니가 비어 있습니다. 메뉴를 추가해 주세요!',
    orderSent: '주문이 성공적으로 전송되었습니다! 주방에서 준비 중입니다.',
    orderSentOffline: '현재 오프라인 상태입니다. 연결 시 자동 동기화됩니다.',
    orderStatus: '주문 상태',
    pending: '대기 중 (Pending)',
    preparing: '준비 중 (Preparing)',
    completed: '완료됨 (Completed)',
    searchMenu: '메뉴 검색...',
    allCategories: '전체 카테고리',
    statusTrackerTitle: '실시간 주문 상태 추적',
    toastCompleted: '음식이 완료되었습니다! 곧 서빙해 드리겠습니다.'
  },
  vi: {
    menu: 'Thực đơn đặc sắc',
    cart: 'Giỏ hàng',
    placeOrder: 'Xác nhận đặt món',
    total: 'Tổng cộng',
    table: 'Bàn',
    takeout: 'Mang về',
    minSpendMsg: 'Chưa đạt mức tối thiểu $10, còn thiếu $',
    remarksPlaceholder: 'VD: Không hành, ít cay, cay vừa...',
    addRemarks: 'Thêm ghi chú & tùy chọn hương vị',
    addCart: 'Thêm vào giỏ',
    modifiers: 'Tùy chọn hương vị',
    subtotal: 'Tạm tính',
    emptyCart: 'Giỏ hàng đang trống. Hãy chọn món ngon từ thực đơn!',
    orderSent: 'Đặt món thành công! Nhà bếp đang chuẩn bị món ăn.',
    orderSentOffline: 'Đang ngoại tuyến. Đơn hàng sẽ tự động đồng bộ khi có mạng.',
    orderStatus: 'Trạng thái đơn hàng',
    pending: 'Đang chờ (Pending)',
    preparing: 'Đang chuẩn bị (Preparing)',
    completed: 'Đã hoàn thành (Completed)',
    searchMenu: 'Tìm kiếm món ăn...',
    allCategories: 'Tất cả danh mục',
    statusTrackerTitle: 'Theo dõi đơn hàng thời gian thực',
    toastCompleted: 'Món ăn đã sẵn sàng! Nhân viên đang mang ra cho bạn.'
  },
  ru: {
    menu: 'Меню',
    cart: 'Корзина',
    placeOrder: 'Оформить заказ',
    total: 'Итого',
    table: 'Стол',
    takeout: 'С собой',
    minSpendMsg: 'Минимум $10 не достигнут, осталось $',
    remarksPlaceholder: 'Пример: без лука, не остро, мало острый...',
    addRemarks: 'Добавить пожелания к заказу',
    addCart: 'В корзину',
    modifiers: 'Модификаторы',
    subtotal: 'Подытог',
    emptyCart: 'Ваша корзина пуста. Добавьте блюда из меню!',
    orderSent: 'Заказ успешно оформлен! Кухня уже готовит его.',
    orderSentOffline: 'Вы оффлайн. Заказ сохранился локально и синхронизируется при сети.',
    orderStatus: 'Статус заказа',
    pending: 'В очереди (Pending)',
    preparing: 'Готовится (Preparing)',
    completed: 'Готово (Completed)',
    searchMenu: 'Поиск блюд...',
    allCategories: 'Все категории',
    statusTrackerTitle: 'Отслеживание заказа онлайн',
    toastCompleted: 'Ваш заказ готов! Официант скоро принесет его.'
  }
};

const CLEAR_CART_TRANSLATIONS: Record<'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru', {
  clearAll: string;
  confirmTitle: string;
  confirmMessage: string;
  cancel: string;
  confirm: string;
}> = {
  zh: {
    clearAll: '清除全部餐點',
    confirmTitle: '確認清除購物車？',
    confirmMessage: '您即將清空購物車內的所有已選餐點，此動作無法復原。是否確認清除？',
    cancel: '取消返回',
    confirm: '確認清除'
  },
  en: {
    clearAll: 'Clear All Items',
    confirmTitle: 'Clear shopping cart?',
    confirmMessage: 'You are about to empty all selected items from your cart. This action cannot be undone. Do you want to proceed?',
    cancel: 'Cancel',
    confirm: 'Clear'
  },
  th: {
    clearAll: 'ล้างรายการทั้งหมด',
    confirmTitle: 'ยืนยันการล้างรถเข็น?',
    confirmMessage: 'คุณกำลังจะลบรายการอาหารทั้งหมดออกจากรถเข็น ซึ่งไม่สามารถย้อนกลับได้ ยืนยันการลบหรือไม่?',
    cancel: 'ยกเลิก',
    confirm: 'ยืนยันล้างรถเข็น'
  },
  ja: {
    clearAll: 'カートを空にする',
    confirmTitle: 'カートをクリアしますか？',
    confirmMessage: 'カート内のすべての商品が削除されます。この操作は取り消せません。よろしいですか？',
    cancel: 'キャンセル',
    confirm: 'クリアする'
  },
  ko: {
    clearAll: '장바구니 비우기',
    confirmTitle: '장바구니를 비우시겠습니까?',
    confirmMessage: '장바구니의 모든 상품이 삭제되며 복구할 수 없습니다. 계속하시겠습니까?',
    cancel: '취소',
    confirm: '비우기'
  },
  vi: {
    clearAll: 'Xóa tất cả món',
    confirmTitle: 'Xác nhận xóa giỏ hàng?',
    confirmMessage: 'Bạn sắp xóa toàn bộ món ăn đã chọn trong giỏ hàng. Thao tác này không thể hoàn tác. Bạn có chắc chắn muốn xóa?',
    cancel: 'Hủy bỏ',
    confirm: 'Xác nhận xóa'
  },
  ru: {
    clearAll: 'Очистить корзину',
    confirmTitle: 'Очистить корзину?',
    confirmMessage: 'Вы собираетесь удалить все выбранные блюда из корзины. Это действие нельзя отменить. Продолжить?',
    cancel: 'Отмена',
    confirm: 'Очистить'
  }
};

const CUSTOMER_UI_TEXTS: Record<'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru', {
  qrScan: string;
  subtitle: string;
  bbq: string;
  appetizers: string;
  drinks: string;
  itemsCount: string;
  staffZone: string;
  staffConfirmTitle: string;
  staffConfirmDesc: string;
  securityNotice: string;
  securityDesc: string;
  cancel: string;
  confirmProceed: string;
  scanQrTitle: string;
  scanQrDesc: string;
  scanSuccess: string;
  scanningSim: string;
  scanModalListTitle: string;
  close: string;
  collapse: string;
  takeoutQr: string;
  dineInMode: string;
}> = {
  zh: {
    qrScan: '掃碼',
    subtitle: '正宗泰式風味炭火烤肉點餐系統 (連鎖分店沙盒版)',
    bbq: '炭火燒烤',
    appetizers: '泰式前菜',
    drinks: '特色飲品',
    itemsCount: '份',
    staffZone: '員工專區 Staff',
    staffConfirmTitle: '確認進入員工專區？',
    staffConfirmDesc: '本專區僅限 Sabay Thai BBQ 現場店員或系統管理員使用。進入後管理員需提供帳號與密碼以供驗證，店員需輸入 6 位數 PIN 碼。',
    securityNotice: '安全身分提示：',
    securityDesc: '顧客請勿擅自闖入。若您是店內工作人員，請點選「確認並前往驗證」按鈕；一般顧客請點選「取消」返回。',
    cancel: '取消返回',
    confirmProceed: '確認並前往驗證',
    scanQrTitle: '掃描桌位 / 外帶 QR 碼',
    scanQrDesc: '請點選下方任一個模擬 QR 碼，系統將模擬相機對焦、自動載入對應桌號或外帶模式。',
    scanSuccess: '掃描成功！',
    scanningSim: '正在模擬尋找 QR 碼...',
    scanModalListTitle: '店內桌位 / 外帶 QR 碼清單 (點選模擬掃描)',
    close: '關閉視窗',
    collapse: '收合',
    takeoutQr: '外帶 QR',
    dineInMode: '內用模式'
  },
  en: {
    qrScan: 'QR Scan',
    subtitle: 'Authentic Charcoal Thai BBQ & Street Delicacies (Multi-Tenant Sandbox)',
    bbq: 'BBQ',
    appetizers: 'Appetizers',
    drinks: 'Drinks',
    itemsCount: 'items',
    staffZone: 'Staff Area',
    staffConfirmTitle: 'Access Staff Area?',
    staffConfirmDesc: 'This area is restricted to authorized on-site staff and administrators. Admin credentials or a 6-digit security PIN is required to proceed.',
    securityNotice: 'Security Notice:',
    securityDesc: 'Customers are kindly requested to remain on the ordering page. If you are a staff member, click "Confirm and Verify".',
    cancel: 'Cancel',
    confirmProceed: 'Confirm & Proceed',
    scanQrTitle: 'Scan Table / Takeout QR Code',
    scanQrDesc: 'Please click any simulated QR code card below. The viewfinder will focus and automatically scan to load the table or takeout mode.',
    scanSuccess: 'SCAN SUCCESSFUL',
    scanningSim: 'SEEKING QR CODE...',
    scanModalListTitle: 'Available QR Codes (Click to scan)',
    close: 'Close',
    collapse: 'Collapse',
    takeoutQr: 'Takeout QR',
    dineInMode: 'Dine-in Mode'
  },
  th: {
    qrScan: 'สแกน QR',
    subtitle: 'ระบบสั่งอาหารปิ้งย่างถ่านไทยแท้ (เวอร์ชันแซนด์บ็อกซ์เครือสาขา)',
    bbq: 'ปิ้งย่างถ่าน',
    appetizers: 'อาหารเรียกน้ำย่อย',
    drinks: 'เครื่องดื่มพิเศษ',
    itemsCount: 'รายการ',
    staffZone: 'พื้นที่พนักงาน Staff',
    staffConfirmTitle: 'เข้าสู่พื้นที่พนักงาน?',
    staffConfirmDesc: 'พื้นที่นี้จำกัดเฉพาะพนักงานและผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น ต้องใช้ข้อมูลประจำตัวของผู้ดูแลระบบหรือรหัส PIN ความปลอดภัย 6 หลักเพื่อดำเนินการต่อ',
    securityNotice: 'ประกาศความปลอดภัย:',
    securityDesc: 'ขอความกรุณาลูกค้าอยู่ในหน้าสั่งซื้อต่อไป หากคุณเป็นพนักงาน กรุณากด "ยืนยันและดำเนินการต่อ"',
    cancel: 'ยกเลิก',
    confirmProceed: 'ยืนยันและดำเนินการต่อ',
    scanQrTitle: 'สแกนคิวอาร์โค้ดโต๊ะ / สั่งกลับบ้าน',
    scanQrDesc: 'กรุณาคลิกการ์ดรหัส QR จำลองด้านล่าง ช่องมองภาพจะโฟกัสและสแกนโดยอัตโนมัติเพื่อโหลดโต๊ะหรือโหมดสั่งกลับบ้าน',
    scanSuccess: 'สแกนสำเร็จ!',
    scanningSim: 'กำลังจำลองการสแกนคิวอาร์โค้ด...',
    scanModalListTitle: 'รายการคิวอาร์โค้ดในร้าน (คลิกเพื่อจำลองการสแกน)',
    close: 'ปิดหน้าต่าง',
    collapse: 'ปิด',
    takeoutQr: 'สั่งกลับบ้าน QR',
    dineInMode: 'โหมดทานที่ร้าน'
  },
  ja: {
    qrScan: 'QRスキャン',
    subtitle: '本格タイ風炭火焼肉注文システム（チェーン店サンドボックス版）',
    bbq: '炭火焼き',
    appetizers: 'タイ風前菜',
    drinks: 'おすすめドリンク',
    itemsCount: '点',
    staffZone: 'スタッフエリア',
    staffConfirmTitle: 'スタッフエリアに進みますか？',
    staffConfirmDesc: 'このエリアは承認された現地スタッフおよび管理者専用です。進むには管理者の資格情報または 6 桁のセキュリティ PIN が必要です。',
    securityNotice: 'セキュリティに関する注意事項：',
    securityDesc: 'お客様は注文ページにとどまるようお願いいたします。スタッフの方は「確認して進む」をクリックしてください。',
    cancel: 'キャンセル',
    confirmProceed: '確認して進む',
    scanQrTitle: 'テーブル / テイクアウト QRコードのスキャン',
    scanQrDesc: '以下の模擬QRコードカードをクリックしてください。ビューファインダーがフォーカスされ、自動的にスキャンしてテーブルまたはテイクアウトモードをロードします。',
    scanSuccess: 'スキャン成功！',
    scanningSim: 'QRコード検出をシミュレート中...',
    scanModalListTitle: '店内テーブル / テイクアウト QRコード一覧（クリックしてスキャン）',
    close: '閉じる',
    collapse: '閉じる',
    takeoutQr: 'テイクアウト QR',
    dineInMode: '店内モード'
  },
  ko: {
    qrScan: 'QR 스캔',
    subtitle: '정통 태국식 숯불구이 주문 시스템 (프랜차이즈 샌드박스 버전)',
    bbq: '숯불구이',
    appetizers: '태국식 전채요리',
    drinks: '스페셜 음료',
    itemsCount: '개',
    staffZone: '직원 전용 구역 Staff',
    staffConfirmTitle: '직원 전용 구역에 진입하시겠습니까?',
    staffConfirmDesc: '이 구역은 승인된 현장 직원 및 관리자 전용입니다. 계속 진행하려면 관리자 로그인 정보 또는 6자리 보안 PIN이 필요합니다.',
    securityNotice: '보안 통지:',
    securityDesc: '고객분들은 주문 페이지에 머물러 주시기 바랍니다. 직원분들은 "확인 및 진행"을 클릭해 주세요.',
    cancel: '취소',
    confirmProceed: '확인 및 진행',
    scanQrTitle: '테이블 / 테이크아웃 QR 코드 스캔',
    scanQrDesc: '아래의 시뮬레이션된 QR 코드 카드를 클릭하세요. 뷰파인더가 초점을 맞추고 자동으로 스캔하여 테이블 또는 테이크아웃 모드를 로드합니다.',
    scanSuccess: '스캔 성공!',
    scanningSim: 'QR 코드 탐색 시뮬레이션 중...',
    scanModalListTitle: '매장 테이블 / 테이크아웃 QR 코드 목록 (클릭하여 시뮬레이션 스캔)',
    close: '닫기',
    collapse: '접기',
    takeoutQr: '테이크아웃 QR',
    dineInMode: '매장 식사 모드'
  },
  vi: {
    qrScan: 'Quét QR',
    subtitle: 'Hệ thống gọi món thịt nướng than Thái Lan chính hiệu (Bản Sandbox Chuỗi Cửa Hàng)',
    bbq: 'Nướng Than',
    appetizers: 'Khai Vị Thái',
    drinks: 'Đồ Uống Đặc Sắc',
    itemsCount: 'món',
    staffZone: 'Khu vực nhân viên',
    staffConfirmTitle: 'Xác nhận vào khu vực nhân viên?',
    staffConfirmDesc: 'Khu vực này được giới hạn cho nhân viên tại chỗ và quản trị viên được ủy quyền. Cần có thông tin đăng nhập của quản trị viên hoặc mã PIN bảo mật 6 chữ số để tiếp tục.',
    securityNotice: 'Thông báo bảo mật:',
    securityDesc: 'Khách hàng vui lòng ở lại trang đặt món. Nếu bạn là nhân viên, hãy nhấp vào "Xác nhận & Tiếp tục".',
    cancel: 'Hủy bỏ',
    confirmProceed: 'Xác nhận & Tiếp tục',
    scanQrTitle: 'Quét mã QR Bàn / Mang về',
    scanQrDesc: 'Vui lòng nhấp vào bất kỳ thẻ mã QR giả lập nào bên dưới. Kính ngắm sẽ lấy nét và tự động quét để tải bàn hoặc chế độ mang về.',
    scanSuccess: 'QUÉT THÀNH CÔNG!',
    scanningSim: 'Đang mô phỏng quét mã QR...',
    scanModalListTitle: 'Danh sách mã QR Bàn / Mang về tại quán (Click để mô phỏng quét)',
    close: 'Đóng',
    collapse: 'Thu gọn',
    takeoutQr: 'Mang về QR',
    dineInMode: 'Chế độ ăn tại quán'
  },
  ru: {
    qrScan: 'Сканировать QR',
    subtitle: 'Аутентичный тайский гриль на углях — Система заказа (Песочница)',
    bbq: 'Гриль на углях',
    appetizers: 'Тайские закуски',
    drinks: 'Напитки',
    itemsCount: 'шт.',
    staffZone: 'Для персонала Staff',
    staffConfirmTitle: 'Войти в зону для персонала?',
    staffConfirmDesc: 'Эта зона предназначена исключительно для авторизованного персонала и администраторов. Для продолжения требуется ввести логин/пароль администратора или 6-значный PIN-код.',
    securityNotice: 'Уведомление о безопасности:',
    securityDesc: 'Клиентам рекомендуется оставаться на странице заказа. Если вы сотрудник, нажмите «Подтвердить и продолжить».',
    cancel: 'Отмена',
    confirmProceed: 'Подтвердить и продолжить',
    scanQrTitle: 'Сканировать QR-код стола / с собой',
    scanQrDesc: 'Нажмите на любой смоделированный QR-код ниже. Видоискатель сфокусируется и автоматически выполнит сканирование для загрузки стола или режима «с собой».',
    scanSuccess: 'УСПЕШНО СКАНИРОВАНО!',
    scanningSim: 'Симуляция сканирования QR-кода...',
    scanModalListTitle: 'Доступные QR-коды в зале (Нажмите для симуляции)',
    close: 'Закрыть',
    collapse: 'Свернуть',
    takeoutQr: 'С собой QR',
    dineInMode: 'В зале'
  }
};

const CATEGORIES = ['BBQ', 'Appetizers', 'Beverages'];

const DISH_TRANSLATIONS: Record<string, Record<'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru', { name: string; description: string }>> = {
  'bbq-1': {
    zh: { name: '特級香烤泰式豬肉串', description: '經典街頭風味，秘製香料醃製，碳火香烤，鮮嫩多汁。' },
    en: { name: 'Moo Ping (Thai Grilled Pork Skewers)', description: 'Classic street food skewers marinated in lemongrass and sweet soy sauce, grilled to perfection.' },
    th: { name: 'หมูปิ้ง (Moo Ping)', description: 'หมูปิ้งเสียบไม้สไตล์สตรีทฟู้ดคลาสสิก หมักด้วยตะไคร้และซีอิ๊วหวาน ย่างเตาถ่านร้อนๆ หอมกรุ่น' },
    ja: { name: 'ムーピン（タイ風焼き豚串）', description: 'レモングラスと甘口醤油に漬け込み、炭火で香ばしく焼き上げたタイ伝統の屋台串。' },
    ko: { name: '무삥 (태국식 돼지고기 꼬치구이)', description: '레몬그라스와 달콤한 간장 소스로 양념해 숯불에 노릇하게 구워낸 태국 전통 길거리 꼬치구이.' },
    vi: { name: 'Thịt xiên nướng kiểu Thái (Moo Ping)', description: 'Thịt xiên nướng đường phố cổ điển được ướp với sả và nước tương ngọt, nướng chín vàng thơm phức.' },
    ru: { name: 'Му Пинг (Тайские свиные шашлычки)', description: 'Классические шашлычки из свинины, маринованные в лемонграссе и сладком соевом соусе, обжаренные на углях.' }
  },
  'bbq-2': {
    zh: { name: '泰式脆皮烤三層肉', description: '外皮金黃酥脆，肉質香嫩Q彈，搭配獨家酸辣涼拌醬。' },
    en: { name: 'Thai Crispy Pork Belly', description: 'Golden crispy skin with tender, layered meat, served with sweet-sour chili dipping sauce.' },
    th: { name: 'หมูกรอบ (Thai Crispy Pork Belly)', description: 'หมูสามชั้นหนังกรอบสีเหลืองทอง เนื้อนุ่มฉ่ำเป็นชั้นๆ เสิร์ฟพร้อมน้ำจิ้มแจ่วรสเด็ด' },
    ja: { name: 'タイ風カリカリ豚の三枚肉焼き', description: '皮は黄金色でパリパリ、肉はジューシーな層になっており、特製の甘酸っぱいピリ辛タレで。' },
    ko: { name: '태국식 크리스피 삼겹살 구이', description: '겉은 바삭하고 속은 촉촉한 황금빛 삼겹살구이로, 특제 매콤새콤 소스와 함께 제공됩니다.' },
    vi: { name: 'Ba chỉ heo quay giòn kiểu Thái', description: 'Da heo quay giòn rụm màu vàng óng với thịt ba chỉ mềm mọng nước, ăn kèm nước sốt chua cay.' },
    ru: { name: 'Хрустящая свиная грудинка по-тайски', description: 'Золотистая хрустящая свиная грудинка с нежным сочным мясом, подается с кисло-сладким острым соусом.' }
  },
  'bbq-3': {
    zh: { name: '香烤泰式香茅雞翅', description: '淡雅香茅芳香，佐以特製羅望子烤肉沾醬。' },
    en: { name: 'Grilled Lemongrass Chicken Wings', description: 'Marinated with fresh lemongrass and herbs, served with homemade tamarind barbecue sauce.' },
    th: { name: 'ปีกไก่ย่างตะไคร้ (Grilled Lemongrass Chicken Wings)', description: 'ปีกไก่หมักตะไคร้สดและสมุนไพรไทย ย่างจนหนังกรอบเนื้อนุ่ม เสิร์ฟพร้อมน้ำจิ้มมะขามสูตรพิเศษ' },
    ja: { name: 'タイ風レモングラス手羽先焼き', description: '新鮮なレモングラスとハーブでしっかりと漬け込み、自家製タマリンドソースを添えて焼き上げた手羽先。' },
    ko: { name: '레몬그라스 닭날개 구이', description: '신선한 레몬그라스와 허브로 양념하여 구운 닭날개로, 수제 타마린드 바베큐 소스가 곁들여집니다.' },
    vi: { name: 'Cánh gà nướng sả kiểu Thái', description: 'Cánh gà ướp sả tươi và các loại thảo mộc, nướng vàng ươm, kèm nước sốt me tự làm.' },
    ru: { name: 'Куриные крылышки на гриле с лемонграссом', description: 'Куриные крылышки, маринованные с лемонграссом и травами, подаются с домашним соусом из тамаринда.' }
  },
  'app-1': {
    zh: { name: '青木瓜沙拉 (泰式涼拌木瓜絲)', description: '酸、甜、香、辣完美融合，清脆爽口開胃首選。' },
    en: { name: 'Som Tum (Green Papaya Salad)', description: 'Fresh, shredded green papaya pounded with garlic, chili, lime, and crushed peanuts.' },
    th: { name: 'ส้มตำ (Som Tum)', description: 'ส้มตำมะละกอดิบขูดสดๆ ตำผสมกระเทียม พริก มะนาว และถั่วลิสงคั่ว รสชาติเปรี้ยวหวานเค็มเผ็ดครบรส' },
    ja: { name: 'ソムタム（青パパイヤサラダ）', description: '千切りにした新鮮な青パパイヤを、ニンニク、唐辛子、ライム、砕いたピーナッツと一緒に叩いて仕上げたヘルシーサラダ。' },
    ko: { name: '솜땀 (그린 파파야 샐러드)', description: '채 썬 그린 파파야를 마늘, 고추, 라임, 으깬 땅콩과 함께 빻아 만든 아삭하고 새콤매콤한 태국 대표 샐러드.' },
    vi: { name: 'Gỏi đu đủ Thái (Som Tum)', description: 'Đu đủ xanh bào sợi tươi giòn giã cùng tỏi, ớt, chanh và đậu phộng rang giòn, hòa quyện đủ vị chua cay mặn ngọt.' },
    ru: { name: 'Сом Там (Салат из зеленой папайи)', description: 'Освежающий салат из хрустящей зеленой папайи, измельченной с чесноком, перечным чили, лаймом и арахисом.' }
  },
  'app-2': {
    zh: { name: '泰式月亮蝦餅', description: '滿滿蝦仁內餡，酥脆外皮搭配甜梅醬。' },
    en: { name: 'Thai Moon Shrimp Cake', description: 'Thick crispy cakes packed with minced shrimp, served with sweet plum sauce.' },
    th: { name: 'ทอดมันกุ้ง (Thai Moon Shrimp Cake)', description: 'ทอดมันกุ้งเนื้อแน่นหนานุ่ม ชุบเกล็ดขนมปังทอดจนกรอบนอกนุ่มใน เสิร์ฟคู่กับน้ำจิ้มบ๊วยหวานเจี๊ยบ' },
    ja: { name: 'タイ風エビのすり身揚げ（トードマングン）', description: 'ぷりぷりのエビのすり身を贅沢に使い、衣をまぶしてサクサクに揚げた一品。甘い梅ソースと一緒に。' },
    ko: { name: '텃만쿵 (태국식 다진 새우튀김)', description: '다진 새우살을 듬뿍 넣어 겉은 바삭하고 속은 부드럽게 튀겨낸 새우 케이크로, 달콤한 자두 소스와 제공됩니다.' },
    vi: { name: 'Chả tôm bọc sả chiên giòn', description: 'Bánh tôm chiên giòn dày nhân thịt tôm tươi xay nhuyễn, ăn kèm sốt mận ngọt thanh.' },
    ru: { name: 'Тайский креветочный пирог (Тод Ман Кунг)', description: 'Плотные хрустящие лепешки со смесью из рубленых креветок, подаются со сладким сливовым соусом.' }
  },
  'app-3': {
    zh: { name: '冬蔭功酸辣海鮮湯', description: '經典泰式酸辣海鮮湯，含有鮮蝦、蕈菇，充滿香草芬芳。' },
    en: { name: 'Tom Yum Goong (Spicy Shrimp Soup)', description: 'Traditional lemongrass-infused hot and sour broth with juicy shrimp and mushrooms.' },
    th: { name: 'ต้มยำกุ้ง (Tom Yum Goong)', description: 'ต้มยำกุ้งน้ำข้นรสชาติจัดจ้าน หอมกลิ่นสมุนไพร ตะไคร้ ใบมะกรูด พร้อมกุ้งตัวโตและเห็ดสด' },
    ja: { name: 'トムヤムクン（エビの酸辣スープ）', description: 'レмоングラスやハーブの香りが豊かな、タイを代表するエビとマッシュルームのスパイシーで酸味のある名物スープ。' },
    ko: { name: '똠얌꿍 (매콤새콤한 새우 수프)', description: '레몬그라스 향이 가득한 매콤새콤한 국물에 오동통한 새우와 버섯을 넣어 끓인 세계 3대 수프 중 하나.' },
    vi: { name: 'Súp tôm chua cay kiểu Thái (Tom Yum Goong)', description: 'Nước súp tôm chua cay đậm đà hương sả thảo mộc truyền thống cùng tôm sú tươi ngon và nấm.' },
    ru: { name: 'Том Ям Гунг (Острый суп с креветками)', description: 'Традиционный острый и кислый суп с креветками, грибами и ароматным бульоном на основе лемонграсса.' }
  },
  'bev-1': {
    zh: { name: '手標手作泰式奶茶', description: '經典泰國手標茶葉現沖，茶香濃郁，奶甜滑順。' },
    en: { name: 'Thai Iced Milk Tea', description: 'Authentic brewed ChaTraMue Thai tea mixed with condensed milk and poured over crushed ice.' },
    th: { name: 'ชาไทยเย็น (Thai Iced Milk Tea)', description: 'ชาไทยตรามือชงสดใหม่หอมกรุ่น ผสมนมข้นหวานมันกลมกล่อม ราดบนน้ำแข็งบดเย็นชื่นใจ' },
    ja: { name: 'タイ風アイスミルクティー', description: '有名な「チャトラムー」茶葉から淹れた濃厚なタイティーに、練乳をたっぷり混ぜてクラッシュアイスに注いだ至極の一杯。' },
    ko: { name: '태국식 아이스 밀크티', description: '태국 전통 차트라뮤 찻잎을 직접 우려내어 연유와 섞어 크러시드 아이스에 부어 마시는 진하고 달콤한 아이스 밀크티.' },
    vi: { name: 'Trà sữa Thái đỏ', description: 'Trà Thái đỏ ChaTraMue chính hiệu được pha chế cùng sữa đặc ngọt béo ngậy, rót lên đá bào mát lạnh.' },
    ru: { name: 'Тайский холодный чай с молоком', description: 'Настоящий свежезаваренный тайский чай ChaTraMue, смешанный со сгущенным молоком и колотым льдом.' }
  },
  'bev-2': {
    zh: { name: '鮮椰子汁', description: '整顆新鮮椰子，清涼解渴，果肉鮮甜。' },
    en: { name: 'Fresh Young Coconut', description: 'Whole chilled sweet young coconut, full of refreshing natural water and tender coconut meat.' },
    th: { name: 'มะพร้าวน้ำหอม (Fresh Young Coconut)', description: 'มะพร้าวน้ำหอมธรรมชาติแช่เย็นเจาะสดๆ ทั้งลูก น้ำหวานหอมชื่นใจพร้อมเนื้อมะพร้าวอ่อนแสนอร่อย' },
    ja: { name: '新鮮なヤシの実ジュース', description: '丸ごと冷やした新鮮なココナッツジュース。天然のすっきりとした甘さの果汁と、柔らかな果肉をお楽しみください。' },
    ko: { name: '생코코넛 주스', description: '차갑게 보관한 신선한 코코넛 열매 통째로 제공되며, 천연 코코넛 워터와 부드러운 과육을 즐길 수 있습니다.' },
    vi: { name: 'Nước dừa tươi nguyên quả', description: 'Quả dừa xiêm tươi ướp lạnh bổ nguyên trái, nước dừa ngọt mát tự nhiên kèm cùi dừa non.' },
    ru: { name: 'Свежий молодой кокос', description: 'Свежий молодой кокос, наполненный освежающей натуральной кокосовой водой и нежной мякотью.' }
  }
};

export function getTranslatedMenuItemName(item: MenuItem, lang: 'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru'): string {
  const customTrans = DISH_TRANSLATIONS[item.id];
  if (customTrans && customTrans[lang]) {
    return customTrans[lang].name;
  }
  if (lang === 'zh') {
    return item.name;
  }
  return item.nameEn || item.name;
}

export function getTranslatedMenuItemDesc(item: MenuItem, lang: 'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru'): string {
  const customTrans = DISH_TRANSLATIONS[item.id];
  if (customTrans && customTrans[lang]) {
    return customTrans[lang].description;
  }
  if (lang === 'zh') {
    return item.description || '';
  }
  return item.descriptionEn || item.description || '';
}

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
  const [lang, setLang] = useState<'zh' | 'en' | 'th' | 'ja' | 'ko' | 'vi' | 'ru'>('zh');
  const t = TRANSLATIONS[lang];
  const ui = CUSTOMER_UI_TEXTS[lang];

  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState<boolean>(false);

  // QR Modal States
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Clear Cart Confirmation Modal state
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState<boolean>(false);

  const handleScanQr = (tbl: string) => {
    setScannedFeedback(tbl);
    
    // Play visual scan feedback, update table, then close modal
    setTimeout(() => {
      setTableId(tbl);
      const isTk = tbl.toLowerCase() === 'takeout';
      setIsTakeout(isTk);
      
      const url = new URL(window.location.href);
      url.searchParams.set('tableId', tbl);
      window.history.pushState({}, '', url.toString());
      
      setScannedFeedback(null);
      setIsQrModalOpen(false);
    }, 850);
  };

  const LANGUAGES_LIST = [
    { code: 'zh', flag: '🇹🇼', name: '繁體中文' },
    { code: 'en', flag: '🇺🇸', name: 'English' },
    { code: 'th', flag: '🇹🇭', name: 'ไทย' },
    { code: 'ja', flag: '🇯🇵', name: '日本語' },
    { code: 'ko', flag: '🇰🇷', name: '한국어' },
    { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
    { code: 'ru', flag: '🇷🇺', name: 'Русский' }
  ] as const;

  // Cart & Catalog
  const [cart, setCart] = useState<CartItem[]>([]);

  const lastLoadedTenantIdRef = useRef<string>('');

  // Load saved cart from localStorage on mount or when tenantId changes
  useEffect(() => {
    if (tenantId) {
      const savedCart = localStorage.getItem(`sabay_thai_cart_${tenantId}`);
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error("Failed to parse saved cart", e);
        }
      } else {
        setCart([]);
      }
      lastLoadedTenantIdRef.current = tenantId;
    }
  }, [tenantId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (tenantId && lastLoadedTenantIdRef.current === tenantId) {
      localStorage.setItem(`sabay_thai_cart_${tenantId}`, JSON.stringify(cart));
    }
  }, [cart, tenantId]);

  const getItemQuantityInCart = (itemId: string) => {
    return cart.reduce((sum, cartItem) => {
      if (cartItem.menuItem.id === itemId) {
        return sum + cartItem.quantity;
      }
      return sum;
    }, 0);
  };
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Derive categories dynamically from the menu items that are assigned to this branch
  const dynamicCategories = useMemo(() => {
    const activeMenu = menu.filter(item => !item.assignedBranches || item.assignedBranches.includes(tenantId));
    const cats = activeMenu.map(item => item.category);
    // filter out duplicates and empty/invalid strings
    const uniqueCats = Array.from(new Set(cats)).filter(Boolean);
    // Keep 'BBQ', 'Appetizers', 'Beverages' ordered first if they exist, and others after them
    const ordered = ['BBQ', 'Appetizers', 'Beverages'];
    const result: string[] = [];
    ordered.forEach(c => {
      if (uniqueCats.includes(c)) {
        result.push(c);
      }
    });
    uniqueCats.forEach(c => {
      if (!result.includes(c)) {
        result.push(c);
      }
    });
    return result;
  }, [menu, tenantId]);
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

    const translatedName = getTranslatedMenuItemName(item, lang).toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      translatedName.includes(searchQuery.toLowerCase());
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

  const handleClearCart = () => {
    setCart([]);
    setIsClearCartConfirmOpen(false);
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
      <section className="bg-gradient-to-r from-red-700 to-rose-600 text-white shadow-md relative">
        {/* Isolated background overflow wrapper */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-b-[inherit]">
          <div className="absolute right-0 bottom-0 opacity-10">
            <Flame className="h-64 w-64 translate-y-12 translate-x-12" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-6 md:py-8 flex flex-wrap justify-between items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-yellow-400 text-red-950 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow">
                {lang === 'zh' ? activeTenant.name : (activeTenant.nameEn || activeTenant.name)}
              </span>
              
              {/* QR-code styled trigger badge for current table/takeout display */}
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-white/20 focus:outline-none cursor-pointer transition-all shadow-sm"
              >
                <QrCode className="h-3.5 w-3.5 text-yellow-350 animate-pulse" />
                <span>
                  {isTakeout ? t.takeout : `${t.table}: ${tableId}`}
                </span>
                <span className="text-[9px] bg-red-800 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-1">
                  {ui.qrScan}
                </span>
              </button>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1.5">
              {lang === 'zh' ? activeTenant.name : (activeTenant.nameEn || activeTenant.name)}
            </h1>
            <p className="text-rose-100 text-xs md:text-sm mt-0.5">
              {ui.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Elegant Language Dropdown Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border border-white/20 cursor-pointer shadow-sm select-none"
              >
                <Languages className="h-4 w-4 text-rose-200" />
                <span>
                  {LANGUAGES_LIST.find(l => l.code === lang)?.flag} {LANGUAGES_LIST.find(l => l.code === lang)?.name}
                </span>
              </button>
              
              <AnimatePresence>
                {isLangDropdownOpen && (
                  <>
                    {/* Backdrop to close language dropdown */}
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setIsLangDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute left-0 mt-2 w-max min-w-full md:min-w-[12rem] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden py-1"
                    >
                      {LANGUAGES_LIST.map((item) => (
                        <button
                          key={item.code}
                          onClick={() => {
                            setLang(item.code);
                            setIsLangDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer text-left ${
                            lang === item.code
                              ? 'bg-red-50 text-red-600'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-sm">{item.flag}</span>
                            <span>{item.name}</span>
                          </span>
                          {lang === item.code && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <Link
              to={`/FSY20260606?tenantId=${tenantId}`}
              onClick={(e) => {
                e.preventDefault();
                setShowStaffConfirm(true);
              }}
              className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md shadow-yellow-500/10 cursor-pointer animate-pulse"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>{ui.staffZone}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Grid - Now Full Width */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Left Side Fixed Category Sidebar */}
        <div className="fixed left-0 top-[180px] md:top-[220px] z-30 bg-white/95 backdrop-blur-md shadow-lg border border-slate-200 rounded-r-2xl w-20 md:w-24 flex flex-col max-h-[60vh]">
          {/* Search Input at the very top */}
          <div className="p-1.5 border-b border-slate-100 bg-slate-50/50 flex-shrink-0 rounded-tr-2xl h-10 relative">
            <div className="absolute left-1.5 top-1.5 w-[calc(100%-12px)] transition-all duration-300 ease-out focus-within:w-44 md:focus-within:w-52 focus-within:shadow-xl focus-within:z-50 bg-white rounded-lg">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t.searchMenu}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-6 pr-6 py-1 text-[10px] md:text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 text-slate-800"
                />
                <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Category Selector with square buttons, no gaps or empty space */}
          <div className="flex flex-col divide-y divide-slate-150 w-full overflow-y-auto scrollbar-none">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`aspect-square w-full flex flex-col items-center justify-center gap-1 p-2 transition-all cursor-pointer flex-shrink-0 ${
                selectedCategory === 'All'
                  ? 'bg-red-600 text-white font-black'
                  : 'bg-white text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              <Grid className="h-4.5 w-4.5 md:h-5 md:w-5" />
              <span className="text-[9px] md:text-[10px] tracking-tight text-center leading-none">{t.allCategories}</span>
            </button>
            {dynamicCategories.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`aspect-square w-full flex flex-col items-center justify-center gap-1 p-2 transition-all cursor-pointer flex-shrink-0 ${
                    isActive
                      ? 'bg-red-600 text-white font-black'
                      : 'bg-white text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  {cat === 'BBQ' ? (
                    <Flame className="h-4.5 w-4.5 md:h-5 md:w-5" />
                  ) : cat === 'Appetizers' ? (
                    <Soup className="h-4.5 w-4.5 md:h-5 md:w-5" />
                  ) : cat === 'Beverages' ? (
                    <CupSoda className="h-4.5 w-4.5 md:h-5 md:w-5" />
                  ) : (
                    <Soup className="h-4.5 w-4.5 md:h-5 md:w-5" />
                  )}
                  <span className="text-[9px] md:text-[10px] tracking-tight text-center leading-none">
                    {cat === 'BBQ' ? ui.bbq : cat === 'Appetizers' ? ui.appetizers : cat === 'Beverages' ? ui.drinks : cat}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="w-full grid grid-cols-4 gap-6 items-start">
          {/* Spacer column on desktop so catalog doesn't overlap the fixed sidebar */}
          <div className="hidden md:block col-span-1" />

          {/* Right Side Column containing Menu Catalog and Order Tracker */}
          <div className="col-span-4 md:col-span-3 pl-24 md:pl-0 space-y-6">
            {/* Menu Catalog */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMenu.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white rounded-2xl border border-slate-100 hover:border-red-500/30 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 p-4 relative"
                >
                  {/* Item Thumbnail Placeholder */}
                  <div className="relative w-24 h-24 rounded-xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center text-red-500 font-extrabold border border-slate-100 shrink-0 select-none">
                    <Flame className="h-10 w-10 text-red-500/60" />
                    
                    {/* Selected count badge on the top-right corner of the image */}
                    {getItemQuantityInCart(item.id) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-red-950 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-scale-in">
                        {getItemQuantityInCart(item.id)}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-col justify-between flex-grow min-w-0 w-full">
                    <div className="min-w-0 w-full">
                      <h3 className="font-black text-slate-800 text-lg sm:text-xl md:text-2xl break-words tracking-tight leading-tight w-full">
                        {getTranslatedMenuItemName(item, lang)}
                      </h3>
                    </div>
                    <div className="flex justify-between items-center mt-3 gap-2">
                      <span className="font-mono text-2xl font-black text-red-600 shrink-0">${item.price}</span>
                      <button className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 font-extrabold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0">
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
          </div>
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
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} {ui.itemsCount}
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-slate-400 hover:text-white font-extrabold text-sm flex items-center gap-1 bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-xl transition cursor-pointer border-none outline-none"
                >
                  <span>{ui.collapse}</span>
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
                        <div className="space-y-1.5 flex-1 min-w-0 w-full">
                          <h4 className="font-extrabold text-slate-800 text-base sm:text-lg break-words w-full leading-snug">
                            {getTranslatedMenuItemName(item.menuItem, lang)}
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

                    {/* Clear All Items button */}
                    <div className="pt-4 border-t border-dashed border-slate-200 flex justify-end">
                      <button
                        onClick={() => setIsClearCartConfirmOpen(true)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer border border-dashed border-slate-200 hover:border-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-500" />
                        <span>{CLEAR_CART_TRANSLATIONS[lang].clearAll}</span>
                      </button>
                    </div>
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
                  {getTranslatedMenuItemName(selectedMenuItem, lang)}
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
              {getTranslatedMenuItemDesc(selectedMenuItem, lang) && (
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100/80">
                  {getTranslatedMenuItemDesc(selectedMenuItem, lang)}
                </p>
              )}
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
                  {ui.staffConfirmTitle}
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                {ui.staffConfirmDesc}
              </p>

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-300 mb-6 space-y-2 leading-relaxed">
                <h4 className="font-bold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{ui.securityNotice}</span>
                </h4>
                <p>
                  {ui.securityDesc}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowStaffConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                >
                  {ui.cancel}
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
                  <span>{ui.confirmProceed}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCAN QR CODE MODAL: TABLE / TAKEOUT SELECTION */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-slate-100 my-8"
            >
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-750 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-3 text-red-500 mb-2">
                <div className="bg-red-500/15 p-2 rounded-xl border border-red-500/30">
                  <QrCode className="h-5 w-5 stroke-[2.5]" />
                </div>
                <h2 className="text-lg font-black text-slate-100">
                  {ui.scanQrTitle}
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                {ui.scanQrDesc}
              </p>

              {/* Camera Viewfinder Simulator */}
              <div className="relative w-full max-w-[240px] aspect-square mx-auto bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col items-center justify-center mb-6">
                {scannedFeedback ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center justify-center text-emerald-400"
                  >
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce mb-2" />
                    <span className="text-xs font-black tracking-widest uppercase">
                      {ui.scanSuccess}
                    </span>
                    <span className="text-[10px] text-emerald-300/80 mt-1 font-mono">
                      {scannedFeedback === 'takeout' ? t.takeout : `${t.table} ${scannedFeedback}`}
                    </span>
                  </motion.div>
                ) : (
                  <>
                    {/* Floating corner frame indicators for camera */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-red-500" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-red-500" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-red-500" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-red-500" />
                    
                    {/* Scanning Laser line */}
                    <motion.div
                      animate={{ y: [-70, 70] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                      className="absolute left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]"
                    />
                    
                    <QrCode className="h-28 w-28 text-slate-800 animate-pulse" />
                    <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase mt-3">
                      {ui.scanningSim}
                    </span>
                  </>
                )}
              </div>

              {/* QR List of Active Tenant Tables */}
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  {ui.scanModalListTitle}
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Dine-in tables */}
                  {activeTenant.tables.map((tbl) => (
                    <button
                      key={tbl}
                      onClick={() => handleScanQr(tbl)}
                      className={`p-3 rounded-2xl border text-left transition-all active:scale-95 flex items-center gap-3 cursor-pointer ${
                        tableId === tbl && !isTakeout
                          ? 'bg-red-950/20 border-red-500/50 text-red-400'
                          : 'bg-slate-850 border-slate-800 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      {/* Mini QR graphic design */}
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 shrink-0 p-1.5 flex items-center justify-center relative overflow-hidden group">
                        <QrCode className="h-full w-full text-slate-400" />
                        <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <p className="text-xs font-black">{t.table} {tbl}</p>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">{ui.dineInMode}</p>
                      </div>
                    </button>
                  ))}

                  {/* Takeout options */}
                  <button
                    onClick={() => handleScanQr('takeout')}
                    className={`p-3 rounded-2xl border text-left transition-all active:scale-95 flex items-center gap-3 cursor-pointer ${
                      isTakeout
                        ? 'bg-red-950/20 border-red-500/50 text-red-400'
                        : 'bg-slate-850 border-slate-800 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 shrink-0 p-1.5 flex items-center justify-center relative overflow-hidden group">
                      <QrCode className="h-full w-full text-slate-400" />
                      <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <p className="text-xs font-black">{t.takeout}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">{ui.takeoutQr}</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 text-center">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-750/50"
                >
                  {ui.close}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DOUBLE CONFIRMATION MODAL: CLEAR ALL ITEMS FROM CART */}
      <AnimatePresence>
        {isClearCartConfirmOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-slate-100"
            >
              <button
                onClick={() => setIsClearCartConfirmOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-850 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <div className="bg-rose-500/15 p-2 rounded-xl border border-rose-500/30">
                  <Trash2 className="h-5 w-5 stroke-[2.5]" />
                </div>
                <h2 className="text-lg font-black text-slate-100">
                  {CLEAR_CART_TRANSLATIONS[lang].confirmTitle}
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {CLEAR_CART_TRANSLATIONS[lang].confirmMessage}
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setIsClearCartConfirmOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                >
                  {CLEAR_CART_TRANSLATIONS[lang].cancel}
                </button>
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-650/15 active:scale-[0.98]"
                >
                  {CLEAR_CART_TRANSLATIONS[lang].confirm}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
