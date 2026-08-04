import { Language } from '../types';

/**
 * Built-in translation dictionary for standard dish names, descriptions, categories, and add-ons.
 * Provides fallback translations for all 6 supported languages.
 */
const TRANSLATION_DICTIONARY: Record<string, Partial<Record<Language, string>>> = {
  // --- Dish Names ---
  '正宗泰國 MAMA 海鮮酸辣麵': {
    zh: '正宗泰國 MAMA 海鮮酸辣麵',
    en: 'Authentic Thai MAMA Seafood Tom Yum Noodles',
    th: 'มาม่าต้มยำกุ้งสด',
    ja: 'タイMAMA海鮮トムヤムラーメン',
    ko: '태국 MAMA 해산물 똠얌 라면',
    vi: 'Mì MAMA hải sản Tom Yum Thái',
  },
  泰式酸辣海鮮湯: {
    zh: '泰式酸辣海鮮湯',
    en: 'Tom Yum Seafood Soup',
    th: 'ต้มยำกุ้งน้ำข้น',
    ja: 'トムヤムシーフードスープ',
    ko: '똠얌 해산물 수프',
    vi: 'Súp hải sản Tom Yum Thái',
  },
  泰式打拋豬肉飯: {
    zh: '泰式打拋豬肉飯',
    en: 'Thai Basil Pork Rice',
    th: 'ข้าวผัดกะเพราหมู',
    ja: 'ガパオ豚肉炒めご飯',
    ko: '태국식 바질 돼지고기 덮밥',
    vi: 'Cơm thịt heo xào húng quế Thái',
  },
  沙貝特調手標泰式奶茶: {
    zh: '沙貝特調手標泰式奶茶',
    en: 'Sabay Signature Thai Milk Tea',
    th: 'ชาไทยตรามือสูตรพิเศษ',
    ja: 'Sabay 特製タイミルクティー',
    ko: '사바이 시그니처 타이 밀크티',
    vi: 'Trà sữa Thái ChaTraMue',
  },
  頂級安格斯黑牛烤肉串: {
    zh: '頂級安格斯黑牛烤肉串',
    en: 'Premium Angus Beef Skewer',
    th: 'เนื้อมะพร้าวแองกัสย่าง',
    ja: '特上アンガス牛串焼き',
    ko: '프리미엄 앙구스 소고기 꼬치',
    vi: 'Thịt bò Angus nướng xiên',
  },
  祕製醬燒豬肉串: {
    zh: '祕製醬燒豬肉串',
    en: 'Secret Sauce Grilled Pork Skewer',
    th: 'หมูย่างหมักซอสสูตรพิเศษ',
    ja: '秘伝タレ豚肉串焼き',
    ko: '비법 양념 돼지고기 꼬치',
    vi: 'Thịt heo nướng xiên sốt đặc biệt',
  },
  鮮嫩雞肉串: {
    zh: '鮮嫩雞肉串',
    en: 'Tender Chicken Skewer',
    th: 'ไก่ย่างหมักสมุนไพร',
    ja: 'やわらか鶏肉串焼き',
    ko: '부드러운 닭고기 꼬치',
    vi: 'Thịt gà nướng xiên',
  },
  泰式香烤大大蝦: {
    zh: '泰式香烤大大蝦',
    en: 'Thai Grilled Jumbo Shrimp',
    th: 'กุ้งแม่น้ำเผา',
    ja: 'タイ風特大海老焼き',
    ko: '태국식 왕새우 구이',
    vi: 'Tôm nướng Thái khổng lồ',
  },
  烤新鮮大干貝: {
    zh: '烤新鮮大干貝',
    en: 'Grilled Fresh Giant Scallops',
    th: 'หอยเชลล์ย่างสด',
    ja: '新鮮ホタテ串焼き',
    ko: '신선한 가리비 구이',
    vi: 'Sò điệp nướng tươi',
  },
  香烤杏鮑菇串: {
    zh: '香烤杏鮑菇串',
    en: 'Grilled King Oyster Mushroom Skewer',
    th: 'เห็ดออรินจิย่าง',
    ja: 'エリンギ串焼き',
    ko: '새송이버섯 꼬치',
    vi: 'Nấm đùi gà nướng xiên',
  },
  鮮烤彩椒蔬菜串: {
    zh: '鮮烤彩椒蔬菜串',
    en: 'Grilled Mixed Pepper & Veggie Skewer',
    th: 'ผักพริกหวานย่าง',
    ja: 'パプリカ＆野菜串焼き',
    ko: '야채 피망 꼬치',
    vi: 'Rau củ nướng xiên',
  },
  香濃椰香芒果糯米飯: {
    zh: '香濃椰香芒果糯米飯',
    en: 'Coconut Mango Sticky Rice',
    th: 'ข้าวเหนียวมะม่วง',
    ja: 'マンゴーココナッツもち米',
    ko: '코코넛 망고 찰밥',
    vi: 'Xôi xoài nước cốt dừa',
  },
  泰香椰子水: {
    zh: '泰香椰子水',
    en: 'Fresh Thai Coconut Water',
    th: 'น้ำมะพร้าวสด',
    ja: 'フレッシュココナッツウォーター',
    ko: '태국 생코코넛 워터',
    vi: 'Nước dừa tươi Thái',
  },
  椰奶香濃冬陰功火鍋套餐: {
    zh: '椰奶香濃冬陰功火鍋套餐',
    en: 'Coconut Cream Tom Yum Hotpot Set',
    th: 'ชุดชาบูต้มยำน้ำข้น',
    ja: 'ココナッツトムヤム鍋セット',
    ko: '코코넛 똠얌 핫팟 세트',
    vi: 'Lẩu Tom Yum nước cốt dừa',
  },
  雙人泰式燒烤豪華組合套餐: {
    zh: '雙人泰式燒烤豪華組合套餐',
    en: 'Deluxe Thai BBQ Combo for Two',
    th: 'ชุดปิ้งย่างบาร์บีคิวไทยสำหรับ 2 ท่าน',
    ja: 'ペアタイ風豪華バーベキューセット',
    ko: '2인용 태국식 바비큐 디럭스 세트',
    vi: 'Set BBQ Thái cao cấp cho 2 người',
  },
  '經典泰式肉串組合 (6串)': {
    zh: '經典泰式肉串組合 (6串)',
    en: 'Classic Thai Skewer Platter (6 pcs)',
    th: 'ชุดเนื้อย่างรวม 6 ไม้',
    ja: '定番タイ風串焼き盛り合わせ (6本)',
    ko: '클래식 태국 꼬치 모듬 (6개)',
    vi: 'Set xiên nướng Thái cổ điển (6 xiên)',
  },

  // --- Descriptions ---
  '嚴選新鮮大草蝦與花枝，搭配正宗泰國進口冬陰功酸辣高湯，香辣濃郁開胃！': {
    zh: '嚴選新鮮大草蝦與花枝，搭配正宗泰國進口冬陰功酸辣高湯，香辣濃郁開胃！',
    en: 'Fresh jumbo tiger prawns & squid in authentic imported Thai Tom Yum broth. Zesty, spicy, and satisfying!',
    th: 'กุ้งและหมึกสดต้มในน้ำต้มยำเข้มข้น รสจัดจ้านหอมสมุนไพรไทย!',
    ja: '新鮮な大エビとイカを、本場タイ直輸入のトムヤムスープで煮込んだ一品。爽やかな酸味と辛味がやみつきに！',
    ko: '신선한 왕새우와 오징어를 넣은 정통 태국 똠얌 수프. 매콤달콤 시원한 맛!',
    vi: 'Tôm sú tươi & mực nấu cùng nước dùng Tom Yum nhập khẩu Thái Lan. Chua cay đậm đà hấp dẫn!',
  },
  '泰國熱銷 MAMA 泡麵，吸飽泰式酸辣海鮮湯汁，搭配鮮蝦與配料，彈牙爽口！': {
    zh: '泰國熱銷 MAMA 泡麵，吸飽泰式酸辣海鮮湯汁，搭配鮮蝦與配料，彈牙爽口！',
    en: 'Popular Thai MAMA instant noodles soaked in rich seafood Tom Yum soup with fresh prawns!',
    th: 'มาม่าต้มยำกุ้งยอดนิยม รสชาติแซ่บเข้มข้นถึงใจ!',
    ja: 'タイで大人気のMAMAラーメン。海鮮トムヤムスープの旨味を吸った麺とエビの相性が抜群！',
    ko: '태국 인기 MAMA 라면에 똠얌 수프와 새우가 어우러진 얼큰하고 쫄깃한 라면!',
    vi: 'Mì MAMA Thái Lan thấm vị súp Tom Yum hải sản kèm tôm tươi ngon giòn!',
  },
  '精選溫體豬肉末，加入手採泰國打拋葉與香料大火快炒，鹹香微辣超下飯！': {
    zh: '精選溫體豬肉末，加入手採泰國打拋葉與香料大火快炒，鹹香微辣超下飯！',
    en: 'Stir-fried minced pork with fresh Thai holy basil and fragrant chili. Savory & spicy!',
    th: 'หมูสับผัดใบกะเพราแท้รสจัดจ้าน ทานคู่กับข้าวสวยร้อนๆ!',
    ja: '豚ひき肉をタイのホーリーバジルとスパイスで強火炒め。ピリ辛でご飯が進む一品！',
    ko: '다진 돼지고기를 태국 바질과 함께 매콤하게 볶아낸 덮밥!',
    vi: 'Thịt heo băm xào húng quế Thái đậm đà cay nhẹ cực kỳ đưa cơm!',
  },
  '採用泰國進口 ChaTraMue 手標紅茶葉沖泡，加入濃郁煉乳與鮮奶，甜香順口。': {
    zh: '採用泰國進口 ChaTraMue 手標紅茶葉沖泡，加入濃郁煉乳與鮮奶，甜香順口。',
    en: 'Authentic ChaTraMue Thai black tea brewed with sweet condensed milk & fresh milk.',
    th: 'ชาไทยตรามือแท้ ชงสดใส่นมข้นหวานหอมมันลงตัว',
    ja: 'タイ名門ChaTraMueの茶葉を使用。練乳とミルクの甘く芳醇な味わい。',
    ko: '태국 명품 차트รามู 찻잎으로 우려낸 달콤하고 고소한 태국밀크티',
    vi: 'Trà đen ChaTraMue Thái Lan pha cùng sữa đặc và sữa tươi thơm béo',
  },
  '嚴選特級安格斯黑牛，油花均勻，炭火炙烤至香氣四溢，肉質多汁嫩口！': {
    zh: '嚴選特級安格斯黑牛，油花均勻，炭火炙烤至香氣四溢，肉質多汁嫩口！',
    en: 'Premium Angus beef grilled over charcoal. Juicy, tender, and rich in flavor!',
    th: 'เนื้อแองกัสคัดพิเศษย่างเตาถ่าน หอมนุ่มฉ่ำซอส',
    ja: '厳選アンガス牛を炭火でジューシーに焼き上げました。肉汁溢れる旨味！',
    ko: '숯불로 구워낸 프리미엄 앙구스 소고기. 풍부한 육즙과 부드러운 식감!',
    vi: 'Thịt bò Angus cao cấp nướng than hồng mọng nước thơm lừng',
  },
  '獨家特調泰式秘製醬汁醃漬，燒烤至表面金黃微焦，鹹甜交織超對味！': {
    zh: '獨家特調泰式秘製醬汁醃漬，燒烤至表面金黃微焦，鹹甜交織超對味！',
    en: 'Marinated in secret Thai BBQ sauce and grilled until golden and caramelized.',
    th: 'หมูหมักซอสสูตรเด็ด ย่างจนหอมสีเหลืองทองรสชาติกลมกล่อม',
    ja: '特製タイ風タレに漬け込んだ豚肉串。香ばしく香ばしい絶妙な甘辛さ！',
    ko: '비법 태국 양념소스에 재워 숯불에 노릇하게 구워낸 돼지고기 꼬치!',
    vi: 'Thịt heo nướng xiên sốt đặc biệt nướng vàng thơm vị mặn ngọt hài hòa',
  },
  '泰國特選金枕頭水蜜芒果，搭配現蒸香糯米與濃郁椰漿，甜而不膩！': {
    zh: '泰國特選金枕頭水蜜芒果，搭配現蒸香糯米與濃郁椰漿，甜而不膩！',
    en: 'Fresh sweet Thai mango served over warm coconut sticky rice and rich coconut syrup.',
    th: 'มะม่วงน้ำดอกไม้หวานฉ่ำ ทานคู่กับข้าวเหนียวน้ำกะทิหอมมัน',
    ja: '熟したタイマンゴーと温かいココナッツもち米の絶品デザート！',
    ko: '달콤한 태국 망고와 고소한 코코넛 찹쌀밥의 완벽한 조합!',
    vi: 'Xoài chín ngọt mọng ăn kèm xôi dừa dẻo thơm rưới nước cốt dừa',
  },

  // --- Categories ---
  燒烤類: {
    zh: '燒烤類',
    en: 'BBQ Skewers',
    th: 'เมนูย่าง',
    ja: '串焼き',
    ko: '꼬치 구이',
    vi: 'Xiên nướng BBQ',
  },
  湯麵類: {
    zh: '湯麵類',
    en: 'Noodles & Soup',
    th: 'เมนูก๋วยเตี๋ยว',
    ja: '麺類・スープ',
    ko: '면 & 수프',
    vi: 'Mì & Súp',
  },
  主食類: {
    zh: '主食類',
    en: 'Main Dishes',
    th: 'อาหารจานหลัก',
    ja: 'メイン料理',
    ko: '메인 요리',
    vi: 'Món chính',
  },
  海鮮類: {
    zh: '海鮮類',
    en: 'Seafood',
    th: 'อาหารทะเล',
    ja: '海鮮料理',
    ko: '해산물',
    vi: 'Hải sản',
  },
  蔬菜類: { zh: '蔬菜類', en: 'Vegetables', th: 'เมนูผัก', ja: '野菜', ko: '야채', vi: 'Rau củ' },
  甜點類: {
    zh: '甜點類',
    en: 'Desserts',
    th: 'ขนมหวาน',
    ja: 'デザート',
    ko: '디저트',
    vi: 'Tráng miệng',
  },
  飲料類: {
    zh: '飲料類',
    en: 'Beverages',
    th: 'เครื่องดื่ม',
    ja: 'ドリンク',
    ko: '음료',
    vi: 'Đồ uống',
  },
  套餐類: {
    zh: '套餐類',
    en: 'Combos & Sets',
    th: 'ชุดเซต',
    ja: 'セット',
    ko: '세트',
    vi: 'Set Combo',
  },

  // --- AddOns ---
  大鮮蝦: {
    zh: '大鮮蝦',
    en: 'Extra Jumbo Shrimp',
    th: 'เพิ่มกุ้งสด',
    ja: 'エビ追加',
    ko: '새우 추가',
    vi: 'Thêm tôm tươi',
  },
  '冬陰功泡麵 / 米線': {
    zh: '冬陰功泡麵 / 米線',
    en: 'Extra MAMA Noodles',
    th: 'เพิ่มเส้นมาม่า',
    ja: 'MAMA麺追加',
    ko: '라면 사리 추가',
    vi: 'Thêm mì MAMA',
  },
  頂級牛肉串: {
    zh: '頂級牛肉串',
    en: 'Extra Beef Skewer',
    th: 'เพิ่มเนื้อย่าง',
    ja: '牛肉串追加',
    ko: '소고기 꼬치 추가',
    vi: 'Thêm xiên bò',
  },
  '爆香豬五花 / 金針': {
    zh: '爆香豬五花 / 金針',
    en: 'Pork Belly & Mushroom',
    th: 'หมูสามชั้นย่าง',
    ja: '豚バラ・えのき追加',
    ko: '삼겹살/팽이버섯 추가',
    vi: 'Thêm thịt ba chỉ',
  },
  頂級椰奶罐: {
    zh: '頂級椰奶罐',
    en: 'Extra Coconut Cream',
    th: 'เพิ่มน้ำกะทิ',
    ja: 'ココナッツミルク追加',
    ko: '코코넛 밀크 추가',
    vi: 'Thêm cốt dừa',
  },
};

/**
 * Safely resolves localized text from a potentially malformed or string-only object.
 * Intelligently falls back to dictionary translation or alternative languages if current language is unavailable or identical to Chinese.
 */
export const getLocalizedText = (
  textObj: { [key in Language]?: string } | string | undefined | null,
  currentLang: Language,
): string => {
  if (!textObj) return '';

  let parsedObj: { [key in Language]?: string } | null = null;
  let rawStr = '';

  if (typeof textObj === 'string') {
    const trimmed = textObj.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        parsedObj = JSON.parse(trimmed);
      } catch {
        rawStr = textObj;
      }
    } else {
      rawStr = textObj;
    }
  } else if (typeof textObj === 'object') {
    parsedObj = textObj;
  }

  // 1. Direct match if parsedObj exists
  if (parsedObj) {
    const directVal = parsedObj[currentLang]?.trim();
    const zhVal = parsedObj['zh']?.trim() || '';

    // If directVal exists and is NOT identical to zhVal (or if currentLang is zh), return it!
    if (directVal && (currentLang === 'zh' || directVal !== zhVal)) {
      return directVal;
    }

    // Check dictionary using zhVal or any available value
    const lookupKey = zhVal || parsedObj['en'] || '';
    if (lookupKey && TRANSLATION_DICTIONARY[lookupKey]?.[currentLang]) {
      return TRANSLATION_DICTIONARY[lookupKey]![currentLang]!;
    }

    // Fallback to English if currentLang is not zh/en and en is distinct from zh
    if (currentLang !== 'en' && parsedObj['en'] && parsedObj['en'] !== zhVal) {
      return parsedObj['en'];
    }

    // Fallback to zh or first non-empty value
    return (
      zhVal ||
      parsedObj['en'] ||
      parsedObj['th'] ||
      parsedObj['ja'] ||
      parsedObj['ko'] ||
      parsedObj['vi'] ||
      ''
    );
  }

  // 2. If textObj was a raw string
  if (rawStr) {
    // Check dictionary
    if (TRANSLATION_DICTIONARY[rawStr]?.[currentLang]) {
      return TRANSLATION_DICTIONARY[rawStr]![currentLang]!;
    }

    // Check for "Chinese / English" split format
    if (rawStr.includes('/')) {
      const parts = rawStr.split('/').map((s) => s.trim());
      if (parts.length >= 2) {
        if (currentLang === 'zh') return parts[0];
        return parts[1] || parts[0];
      }
    }

    // Check for "Chinese (English)" format
    const match = rawStr.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      if (currentLang === 'zh') return match[1].trim();
      return match[2].trim();
    }

    return rawStr;
  }

  return '';
};
