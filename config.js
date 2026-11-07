/* ============================================================
   世界的尺：背包客生存挑戰  —— 所有可修改的資料都在這個檔案
   ============================================================ */

/* ---- 1. Firebase 設定 ----
   照 README 的步驟建立 Firebase 專案後，把你的設定貼在下面。
   如果 apiKey 還是 "" ，遊戲會自動進入「本機示範模式」：
   只能在同一台電腦的不同分頁之間測試，不會連到網路。 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCkhUWnSMZYszvgCpjhm75LznBtqSbT5Vc",
  authDomain: "world-ruler-afd42.firebaseapp.com",
  databaseURL: "https://world-ruler-afd42-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "world-ruler-afd42",
  storageBucket: "world-ruler-afd42.firebasestorage.app",
  messagingSenderId: "782953191388",
  appId: "1:782953191388:web:280e86dd648238febae119"
};

window.CONFIG = {
  title: "世界的尺：背包客生存挑戰",
  retainDays: 30,            // 房間資料保留天數
  usdPerDay: 3,              // 世界銀行極端貧窮線
  usdRate: 32.6,             // 1 美元 ≈ 台幣
  wbLineTWD: 98,             // 3 美元換算（直接使用，不再計算）
  rateNote: "金額已四捨五入，匯率會變動，只是大約的數字。",
  storeNote: "物價來源：Numbeo 各國平均物價（2026 年 11 月），日本的水果、番茄、礦泉水及台灣的香蕉、番茄為首都資料。",
  rateDate: "匯率：2026 年 11 月 Numbeo 採用匯率（1 美元≈32.6 元台幣）",
  tolerance: 2,              // 步驟 2 答案容許誤差（元）
  reminderCard: "這份物價清單是城市裡一般的價格。真正生活困難的家庭，常常會買更便宜的在地食物、住更簡陋的房子，但這也代表他們的生活品質很差。",

  /* ---- 2. 國家資料卡 ---- */
  countryOrder: ["KE", "IN", "BR", "JP", "US", "TW"],
  countries: {
    KE: { name: "肯亞", code: "ke", color: "#2E8B57",
      how: "住在城市的人，一個月花不到這麼多錢買吃的和生活用品，就算貧窮。",
      raw: "每人每月 8,006 肯亞先令", calc: "8,006 ÷ 30 ≈ 267 先令（一天）", calc2: "267 × 0.25 ≈ 67 元台幣",
      daily: 67, source: "肯亞國家統計局《Kenya Poverty Report 2022》（都市地區）" },
    IN: { name: "印度", code: "in", color: "#F28C28",
      how: "印度政府很多年沒有公布新的貧窮線，這是研究單位依最新物價推算的城市貧窮線。",
      raw: "每人每月 1,944 盧比", calc: "1,944 ÷ 30 ≈ 65 盧比（一天）", calc2: "65 × 0.35 ≈ 22 元台幣",
      daily: 22, source: "印度國家銀行研究部（SBI Research）2025 年推估（2023–24 年物價）" },
    BR: { name: "巴西", code: "br", color: "#E0A800",
      how: "全家平均每人每月收入低於這個金額，就能申請政府的「家庭補助金」。",
      raw: "每人每月 218 雷亞爾", calc: "218 ÷ 30 ≈ 7.3 雷亞爾（一天）", calc2: "7.3 × 5.97 ≈ 43 元台幣",
      daily: 43, source: "巴西社會發展部「家庭補助金（Bolsa Família）」2026 年申請標準" },
    JP: { name: "日本", code: "jp", color: "#D7263D",
      how: "收入不到全國「中間那個人」收入的一半，就算相對貧窮。",
      raw: "每人每年 138 萬日圓", calc: "1,380,000 ÷ 365 ≈ 3,781 日圓（一天）", calc2: "3,781 × 0.21 ≈ 779 元台幣",
      daily: 779, source: "日本厚生勞動省《2025 年國民生活基礎調查》（2024 年所得）" },
    US: { name: "美國", code: "us", color: "#2F5DA8",
      how: "一個人一年的收入低於這個金額，就算貧窮，可以申請各種補助。",
      raw: "一人每年 15,960 美元", calc: "15,960 ÷ 365 ≈ 43.7 美元（一天）", calc2: "43.7 × 32.6 ≈ 1,425 元台幣",
      daily: 1425, source: "美國衛生及公共服務部（HHS）2026 年貧窮指標" },
    TW: { name: "台灣", code: "tw", color: "#3A86C8", tag: "（對照組）",
      how: "全家平均每人每月收入低於最低生活費，就能申請低收入戶（上一節學過）。",
      raw: "每人每月 15,515 元", calc: "15,515 ÷ 30 ≈ 517 元（一天）", calc2: "台灣本來就用台幣，不用換算",
      daily: 517, source: "衛生福利部 115 年最低生活費（臺灣省）" }
  },

  /* ---- 3. 必需品（價格順序：肯亞 印度 巴西 日本 美國 台灣） ---- */
  needs: [
    { id: "breakfast", icon: "🍞", name: "早餐", options: [
      { id: "bf_self", name: "自己做", desc: "吐司 1/4 條＋1 顆蛋＋1 杯牛奶", p: [15, 11, 26, 30, 47, 45] } ] },
    { id: "lunch", icon: "🍚", name: "午餐", options: [
      { id: "meal_self", name: "自己煮", desc: "白米 150 克＋1 顆蛋＋番茄 200 克", p: [17, 9, 21, 67, 66, 50] },
      { id: "meal_shop", name: "小吃店一餐", desc: "", p: [125, 69, 209, 206, 652, 150] },
      { id: "meal_fast", name: "速食套餐", desc: "", p: [219, 121, 239, 165, 391, 169] } ] },
    { id: "dinner", icon: "🍲", name: "晚餐", options: [
      { id: "meal_self", name: "自己煮", desc: "白米 150 克＋1 顆蛋＋番茄 200 克", p: [17, 9, 21, 67, 66, 50] },
      { id: "meal_shop", name: "小吃店一餐", desc: "", p: [125, 69, 209, 206, 652, 150] },
      { id: "meal_fast", name: "速食套餐", desc: "", p: [219, 121, 239, 165, 391, 169] } ] },
    { id: "housing", icon: "🏠", name: "住", options: [
      { id: "home_share", name: "三人合租一房小公寓", desc: "含水電，一天份", p: [78, 49, 112, 203, 560, 143] },
      { id: "home_solo", name: "自己租一房小公寓", desc: "含水電，一天份", p: [233, 146, 335, 609, 1681, 430] } ] },
    { id: "daily", icon: "📱", name: "日常", options: [
      { id: "phone", name: "手機網路", desc: "一天份", p: [14, 4, 13, 27, 67, 19] } ] }
  ],

  /* ---- 4. 當地商店：10 項額外商品 ---- */
  store: [
    { id: "water",  icon: "💧", name: "礦泉水 1.5 公升", p: [19, 10, 24, 28, 76, 37] },
    { id: "bus",    icon: "🚌", name: "公車單程票",     p: [25, 8, 31, 45, 65, 20] },
    { id: "milk",   icon: "🥛", name: "鮮奶 1 公升",    p: [25, 21, 32, 48, 35, 97] },
    { id: "bread",  icon: "🍞", name: "一條吐司",       p: [15, 14, 47, 48, 108, 54] },
    { id: "eggs",   icon: "🥚", name: "雞蛋一盒（12 顆）", p: [53, 31, 69, 67, 140, 83] },
    { id: "banana", icon: "🍌", name: "香蕉 1 公斤",    p: [32, 22, 42, 80, 55, 101] },
    { id: "apple",  icon: "🍎", name: "蘋果 1 公斤",    p: [93, 64, 68, 162, 172, 147] },
    { id: "tomato", icon: "🍅", name: "番茄 1 公斤",    p: [27, 16, 48, 188, 161, 142] },
    { id: "cola",   icon: "🥤", name: "一小瓶可樂",     p: [21, 13, 38, 37, 88, 32] },
    { id: "coffee", icon: "☕", name: "一杯咖啡",       p: [79, 56, 63, 103, 179, 93] }
  ],

  /* ---- 5. 步驟與教師口白 ---- */
  steps: [
    { title: "大廳", tip: "上一節課我們知道，世界銀行把每天 3 美元當作極端貧窮線。但每個國家物價不一樣，自己畫的及格線也不一樣。今天各組要化身『國際背包客』！" },
    { title: "開箱國家任務卡", tip: "請各組念出自己的國家，在世界地圖上找到它的位置。" },
    { title: "找出「及格線」", tip: "巡視協助換算；提醒學生看「一天」的金額，不是一個月或一年。" },
    { title: "生存採買 第一回合", tip: "預期：肯亞、印度、巴西連必需品都買不齊；日本、台灣買完還有剩，但房租占很大一部分；美國如果選自己租房子，錢會不夠。" },
    { title: "當地商店（補買）", tip: "提醒：這裡買的是「必需品之後，還能額外買到的東西」。" },
    { title: "生存採買 第二回合", tip: "同樣 98 元，在印度、肯亞能買到比較多，在日本、美國幾乎只夠一兩餐。引導說出「因為物價不一樣」。" },
    { title: "數字排排站", tip: "提問：「為什麼日本、美國的貧窮線比肯亞高好幾倍，在當地生活的人依然很辛苦？」關鍵：物價、房租。" },
    { title: "比較海報", tip: "預告：下一節課各組要正式發表，請貼上手寫的「我的大發現」。" }
  ]
};

/* 把價格陣列轉成各國查詢表：CONFIG.price[國家代號][品項id] */
(function () {
  const C = CONFIG;
  C.price = {};
  C.countryOrder.forEach((cc, i) => {
    C.price[cc] = {};
    C.needs.forEach(n => n.options.forEach(o => { C.price[cc][o.id] = o.p[i]; }));
    C.store.forEach(s => { C.price[cc][s.id] = s.p[i]; });
  });
})();
