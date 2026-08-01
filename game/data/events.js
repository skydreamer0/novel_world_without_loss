// 《無漏之地》事件牌庫 — 改編自 manuscript/vol_01 第006~070章劇情節點
// 每張事件卡對應原作章節的核心抉擇，效果數值為遊戲化平衡，非正文原文引用。

export const INTRO = {
  title: '楔子：空胎',
  paragraphs: [
    '秦無漏，秦氏嫡系天才，開界大典上被奪走界種，界胚撐開卻無界核成形——一枚無邊無際、無法測量的「空胎」。',
    '他被逐出家族、退婚、收回遺產。唯一甦醒的殘核告訴他：容積為零，錨點為零，成功率低於萬分之一。',
    '他反殺前來滅口的秦罡，在界歸完成前的數息之間，截下了沉河城與它的居民——連同他們的信任、恐懼與生存。',
    '從這一刻起，你是這片黑暗中唯一的座標。你的每一個決定，都會由活生生的人來承受代價。',
  ],
  startLabel: '開始截界',
};

export const RESOURCE_META = {
  population: { label: '居民人口', icon: '👥', format: (v) => Math.max(0, Math.round(v)).toLocaleString('zh-Hant') },
  food: { label: '糧食', icon: '🌾', pct: true },
  order: { label: '界力', icon: '⚡', pct: true },
  trust: { label: '居民信任', icon: '🤝', pct: true },
  pressure: { label: '中樞定額壓力', icon: '⚠️', pct: true, invert: true },
};

export const ORGAN_META = {
  heart: { label: '心臟（城市）', icon: '❤️' },
  river: { label: '經脈（河流）', icon: '🌊' },
  mine: { label: '骨骼（礦山）', icon: '⛰️' },
  forest: { label: '肺（森林）', icon: '🌲' },
};

export const INITIAL_STATE = {
  turn: 1,
  resources: {
    population: 3800,
    food: 60,
    order: 30,
    trust: 50,
    pressure: 8,
  },
  organs: { heart: 0, river: 0, mine: 0, forest: 0 },
  debts: [],
  flags: {},
  log: [],
};

// effects: 對 resources 的增量；organs 的增量；addDebt：延遲生效的代價；setFlags：劇情旗標
export const EVENTS = [
  {
    id: 'ch006', chapter: '第六至七章 · 截界', title: '截界時刻',
    text: '秦罡授首，秦氏祖界的界歸通道正在收攏。你只有數息時間，決定要截下多大的範圍——範圍越大，能救下的人越多，控制起來也越吃力。',
    choices: [
      { label: '全力擴大截取範圍，能救就救', effects: { population: 1200, order: -10, pressure: 5, organs: { heart: 1 } },
        log: '沉河城、四村與枯河一同墜入空胎，人口大增，但地脈開始不穩。' },
      { label: '只截取沉河城主城，穩妥為上', effects: { population: 600, order: 5, trust: 5, organs: { heart: 1 } },
        log: '你只帶回了沉河城，範圍雖小，第一個錨點卻站得很穩。' },
    ],
  },
  {
    id: 'ch008a', chapter: '第八章 · 第一顆心臟', title: '糧倉大火',
    text: '沉河城糧倉失火，居民陷入混亂。你無法靠武力維持秩序——是放手讓居民自己組織救援與分工，還是親自下場鎮壓？',
    choices: [
      { label: '放權讓居民自治救火、重建分工', effects: { trust: 10, order: 8, organs: { heart: 1 } },
        log: '登記、配糧、救火、醫療重新運轉起來，城市的第一顆心臟開始跳動。' },
      { label: '親自下場，以強硬手段壓下混亂', effects: { trust: -8, order: 4, population: -50 },
        log: '火勢暫時壓下，居民對你多了畏懼，少了信任。' },
    ],
  },
  {
    id: 'ch008b', chapter: '第八章 · 借城三息', title: '枯河倒流',
    text: '枯河開始倒流，地脈持續流失。借用城市三息之力可以立刻封堵，但代價會由居民承擔，且不會即時顯現。',
    choices: [
      { label: '借城三息，緊急封堵地脈', effects: { order: 10 },
        addDebt: { label: '借城三息代價', source: '沉河城居民', amount: '三息界力', dueInTurns: 2, effect: { trust: -6, population: -40 } },
        log: '枯河暫時止住，代價會在稍後降臨。' },
      { label: '不強行借力，尋求自然修復', effects: { order: -5, pressure: 5 },
        log: '枯河持續倒灌，地脈流失沒有止住。' },
    ],
  },
  {
    id: 'ch009', chapter: '第九章 · 萬族囚車', title: '萬族囚車',
    text: '一百二十七名青角族即將被押往牧場煉化。出手相救會引入陌生的異族法則與母根，拒絕則是任由他們死去。',
    choices: [
      { label: '出手救下青角族', effects: { population: 300, trust: 6, order: -4 }, setFlags: ['saved_qingjiao'],
        log: '棘蘿帶著青角族進入空胎，母根隨即開始與地脈爭奪養分。' },
      { label: '明哲保身，不節外生枝', effects: { pressure: -3, trust: -10 },
        log: '你選擇冷眼旁觀，居民對你的信任第一次出現裂縫。' },
    ],
  },
  {
    id: 'ch010', chapter: '第十章 · 記憶雨', title: '記憶雨',
    text: '截界殘念與死亡記憶匯聚成雨，人族與異族被迫看見彼此被圈養、犧牲的經歷。是否放任這場雨自然沖刷兩族的敵意？',
    choices: [
      { label: '任由記憶雨沖刷，促成兩族和解', effects: { trust: 12, order: 5, pressure: 5 },
        log: '人族與異族在雨中達成了短暫但真實的諒解。' },
      { label: '強行分隔兩族，阻止記憶交融', effects: { trust: -5, population: -30, pressure: 5 },
        log: '衝突被壓下了，但沒有人真正得到理解。' },
    ],
  },
  {
    id: 'ch011', chapter: '第十一章 · 名冊之外', title: '名冊之外',
    text: '三百六十五名漏民與青角族沒有合法座標，舊界碑不承認他們的存在。建立一份不依賴界核的新名冊，還是維持舊制以免觸怒中樞？',
    choices: [
      { label: '建立新名冊，承認所有居民', effects: { trust: 15, order: 6 }, setFlags: ['new_registry'],
        log: '梁秋娘的名字率先在界圖中亮起——共同承認，第一次創造了新座標。' },
      { label: '維持舊制，避免觸怒中樞規則', effects: { pressure: -5, trust: -12 },
        log: '漏民繼續遊蕩在秩序邊緣，隨時可能出事。' },
    ],
  },
  {
    id: 'ch013', chapter: '第十三章 · 第一份契約', title: '第一份契約',
    text: '沈季年、棘蘿、阮青禾、方折提議締結居民契約，規範借力與煉化的界線，也會限制你的裁量權。',
    choices: [
      { label: '簽署居民契約，自我約束權力', effects: { trust: 14, order: 4 }, setFlags: ['resident_contract'],
        log: '契約生效，界圖中浮現出「共議」法則的雛形。' },
      { label: '拒絕受契約束縛，保留絕對裁量權', effects: { order: 10, trust: -10 },
        log: '你保留了全部權力，居民卻更加提防你。' },
    ],
  },
  {
    id: 'ch014', chapter: '第十四章 · 追界犬', title: '追界犬',
    text: '巡界司第七號追界犬即將識破空胎入口。梁禾發現牠體內有一條控制鏈。',
    choices: [
      { label: '切斷控制鏈，收留灰七', effects: { order: 5, population: 1, pressure: -4 },
        log: '灰七反咬犬鏈，進入空胎——卻也留下了通往犬庫的線索。' },
      { label: '直接擊殺追界犬，避免後患', effects: { pressure: -8, order: -3 },
        log: '追界犬死了，但巡界司很快會派出下一隻。' },
    ],
  },
  {
    id: 'ch015', chapter: '第十五章 · 借城三息', title: '第三息',
    text: '巡界司以照界釘包圍廢院，議事會只批准借用兩息。第三息需要你獨斷借出，才能阻止四千多名居民的資料被記錄下來。',
    choices: [
      { label: '擅自借出第三息，擊退賀鳴川', effects: { pressure: -10 },
        addDebt: { label: '擅自借息代價', source: '工匠與孕婦', amount: '超額一息界力', dueInTurns: 1, effect: { population: -80, trust: -10 } },
        log: '賀鳴川暫退，代價會立刻落在無辜的居民身上。' },
      { label: '只用被批准的兩息，承受曝露風險', effects: { pressure: 12, order: -5 },
        log: '居民名冊險些曝光，巡界司記下了蛛絲馬跡。' },
    ],
  },
  {
    id: 'ch016', chapter: '第十六章 · 殘序市集', title: '殘序市集',
    text: '記憶雨凝成的殘序晶體開始私下流通，一名守卒已因人格覆寫而失控。',
    choices: [
      { label: '建立記市與篩查制度，疏導交易', effects: { order: 8, trust: 6 },
        log: '記市成立，危險的交易第一次變得可以追蹤。' },
      { label: '全面查禁殘序交易', effects: { trust: -6, order: -4, pressure: -3 },
        log: '交易轉入地下，風險並沒有真正消失。' },
    ],
  },
  {
    id: 'ch019', chapter: '第十九章 · 空胎名單', title: '下池黑礦表決',
    text: '下池黑礦仍囚著近三百名礦工。救援能取得空胎急需的礦山骨骼，但風險會落在全體居民身上。',
    choices: [
      { label: '議事會全票通過，全力救援', effects: { order: -6, pressure: 5 },
        log: '五席議事會第一次就對外行動達成一致。' },
      { label: '暫緩救援，先穩固既有城池', effects: { order: 8, trust: -8 },
        log: '你選擇了保守，議事會對你的猶豫感到不滿。' },
    ],
  },
  {
    id: 'ch020', chapter: '第二十章 · 第一根骨', title: '突襲黑礦',
    text: '拆除生命錨的瞬間，爆界陣隨時可能引爆。要冒險救下所有生還者，還是只搶救核心區域？',
    choices: [
      { label: '冒險拆除生命錨，救下所有生還者', effects: { population: 283, trust: 8, pressure: 4, organs: { mine: 1 } },
        log: '二百八十三人生還，黑礦成為空胎第一根界骨。' },
      { label: '只救核心區域，放棄外圍礦道', effects: { population: 150, order: 6, organs: { mine: 1 } },
        log: '救援範圍縮小，一部分礦工被留在了原地。' },
    ],
  },
  {
    id: 'ch022', chapter: '第二十二章 · 空胎之價', title: '安置條款',
    text: '大批新居民造成糧食與住處壓力，議事會要求制定安置條款，禁止用糧債恢復礦奴身份。',
    choices: [
      { label: '制定三十日安置條款，明文禁止礦奴身份', effects: { trust: 10, food: -10 }, setFlags: ['settlement_clause'],
        log: '安置條款生效，第一個無核錨點逐漸成形。' },
      { label: '暫不設限，先解決眼前糧食問題', effects: { food: 10, trust: -8 },
        log: '沒有規範的安置，埋下了未來的矛盾。' },
    ],
  },
  {
    id: 'ch024', chapter: '第二十四章 · 封界令', title: '換藥材',
    text: '賀鳴川封鎖城西物資，礦毒治療所需的沉肺草只剩七日存量。紙鳶願以三十日藥材換取遺界門片的解析權。',
    choices: [
      { label: '用門片解析換三十日藥材', effects: { trust: 4, food: 8 },
        addDebt: { label: '門片交換代價', source: '遺界情報主動權', amount: '一次解析結果', dueInTurns: 3, effect: { order: -10 } },
        log: '紙鳶送來了藥材，但情報的主動權已經不完全在你手上。' },
      { label: '硬撐存量，拒絕交換情報', effects: { food: -15, population: -60 },
        log: '藥材耗盡，一部分傷患沒能撐過封鎖。' },
    ],
  },
  {
    id: 'ch029', chapter: '第二十九章 · 界歸陷阱', title: '界歸陷阱',
    text: '秦懷忠處死秦讓，用他的八十里天地設下界歸陷阱，等你自投羅網。',
    choices: [
      { label: '用無核錨點製造盲區，謹慎避開陷阱', effects: { order: 6, pressure: -5, organs: { mine: -1 } },
        log: '黑礦界骨因此開裂，但你避開了陷阱的核心。' },
      { label: '正面壓過陷阱，賭一次直接反殺', effects: { pressure: 10, trust: -6, order: 5 },
        log: '你正面壓了過去，卻讓中樞的注意力提前集中到這裡。' },
    ],
  },
  {
    id: 'ch031', chapter: '第三十一章 · 十二城人質', title: '十二城人質',
    text: '秦懷忠以十二城近四萬人的性命要脅談判，願以秦徹的最後記錄交換黑礦與殘核。',
    choices: [
      { label: '查看保城契真相，拒絕交換', effects: { trust: 10, pressure: 8 },
        log: '保城契的黑幕曝光，十二城居民開始動搖對秦懷忠的信任。' },
      { label: '暫時接受條件，換取喘息時間', effects: { order: 8, trust: -10 },
        log: '你換來了時間，卻也默許了保城契繼續運作。' },
    ],
  },
  {
    id: 'ch032', chapter: '第三十二章 · 掌界人的帳', title: '掌界人的帳',
    text: '忠脈定額缺口逐年擴大，三槐村被列為下一個填補對象。',
    choices: [
      { label: '公開帳冊缺口，爭取三槐村自主權', effects: { trust: 8, pressure: 5 }, setFlags: ['accounts_exposed'],
        log: '忠脈居民第一次看見完整的犧牲帳。' },
      { label: '暫不介入，避免過早暴露立場', effects: { order: 6, trust: -5 },
        log: '三槐村的命運仍懸而未決。' },
    ],
  },
  {
    id: 'ch034', chapter: '第三十四章 · 抽村', title: '三槐村的選擇',
    text: '三槐村八百餘人必須在進主城、被抽取與遷入空胎之間選擇。公開風險讓村民自行投票，還是直接下令節省時間？',
    choices: [
      { label: '公開空胎風險，讓村民自行投票', effects: { population: 823, trust: 15, food: -10, organs: { forest: 1 } },
        log: '八百二十三人自願遷入，帶著完整的關係與自己的決定。' },
      { label: '直接下令強制遷入', effects: { population: 823, trust: -15, order: 5, organs: { forest: 1 } },
        log: '村民雖然遷入了，卻對你多了一層畏懼與怨懟。' },
    ],
  },
  {
    id: 'ch035', chapter: '第三十五章 · 第十三座城', title: '三槐台',
    text: '空胎人口暴增，糧食只剩十二日，居民卻自發利用黑礦台地建起了三槐台。',
    choices: [
      { label: '全力支持居民自建三槐台', effects: { order: 8, trust: 6, organs: { heart: 1 } },
        log: '三槐台成為第一座由居民自己建成的城市錨點。' },
      { label: '收回部分自建資源，集中調度', effects: { order: 10, trust: -8 },
        log: '效率提高了，居民的自主感卻被削弱。' },
    ],
  },
  {
    id: 'ch036', chapter: '第三十六章 · 一日斷糧', title: '一日斷糧',
    text: '糧食即將見底。是否要求全界同額配糧，共同承擔短缺？',
    choices: [
      { label: '全界同額配糧，共渡難關', effects: { trust: 12, food: -5, organs: { forest: 1 } },
        log: '第一株暗生灰穗發芽——共同承擔，孕育出了新的資源。' },
      { label: '按貢獻分配糧食，優先核心居民', effects: { order: 6, trust: -10, food: 5 },
        log: '核心居民無虞，邊緣居民卻怨聲載道。' },
    ],
  },
  {
    id: 'ch037', chapter: '第三十七章 · 第一次公示', title: '第一次公示',
    text: '顧寒生取得了保城契與抽村帳的罪證。要利用照影陣向十二城公開真相，還是暫時隱藏？',
    choices: [
      { label: '公開真相，正面衝擊忠脈制度', effects: { pressure: 10, trust: 10 }, setFlags: ['truth_public'],
        log: '十二城第一次看見完整真相，連秦昭都開始動搖。' },
      { label: '暫時隱藏證據，等待更好時機', effects: { pressure: -5, order: 5 },
        log: '證據仍在你手中，但真相繼續被掩埋。' },
    ],
  },
  {
    id: 'ch038', chapter: '第三十八章 · 雙界初戰', title: '雙界初戰',
    text: '秦昭要求你交出殘核與帳冊接受公開審理。',
    choices: [
      { label: '拒絕交出，正面交鋒但彼此克制', effects: { order: 5, pressure: 6 },
        log: '你與秦昭都留了手，轉而合力阻止忠脈提前界歸。' },
      { label: '主動釋出部分證據緩和衝突', effects: { trust: 6, order: -5 },
        log: '衝突暫緩了，但你手中的底牌變少了。' },
    ],
  },
  {
    id: 'ch040', chapter: '第四十至四十一章 · 借一座城', title: '柳峽自治',
    text: '柳峽城七成一住戶同意解除保城契，請求借用你的界力守城一息，助他們成為第一座自治城市。',
    choices: [
      { label: '借出一息，助柳峽解除保城契', effects: { trust: 12, organs: { river: 1 } },
        addDebt: { label: '柳峽借息代價', source: '柳峽城居民', amount: '守城一息界力', dueInTurns: 2, effect: { trust: -4, order: -6 } },
        log: '柳峽成為第一座自治城市，代價會在之後顯現。' },
      { label: '拒絕介入，讓柳峽獨自承擔後果', effects: { trust: -12, pressure: -5 },
        log: '柳峽的自治嘗試，失去了你的支持。' },
    ],
  },
  {
    id: 'ch043', chapter: '第四十三章 · 自己的風暴', title: '自己的風暴',
    text: '虛無風暴提前抵達，柳峽表決先靠自身力量抵抗，只在最後一息求援。',
    choices: [
      { label: '尊重柳峽的表決，只在最後一息出手', effects: { population: -41, trust: 10, organs: { river: 1 } },
        log: '四十一人犧牲，但柳峽證明了自治城市能夠自保。' },
      { label: '不顧表決，提前全力介入', effects: { population: -10, trust: -8, order: -8 },
        log: '傷亡減少了，但居民的自主權被你踐踏了。' },
    ],
  },
  {
    id: 'ch044', chapter: '第四十四至四十五章 · 影子出走', title: '離影異常',
    text: '五千餘道居民的影子離開本體，重演未曾實行的選擇。紙鳶失去十七年的舊影拒絕回歸，想要一個屬於自己的名字。',
    choices: [
      { label: '承認遲影為獨立居民，為離影建立安全路徑', effects: { trust: 10, order: 6 }, setFlags: ['chiying_independent'],
        log: '遲影自取姓名，界圖出現了「自我命名」的未知法則。' },
      { label: '強行磨滅離影，盡快結束異常', effects: { trust: -14, population: -20 },
        log: '危機平息了，但許多居民永遠失去了那段自我認知。' },
    ],
  },
  {
    id: 'ch049', chapter: '第四十九至五十章 · 補天使者', title: '中樞介入',
    text: '天衡補天使者晏平章前來接管，要求封存甲字令、遺界門片與殘核，以赦免三槐村作為交換。',
    choices: [
      { label: '拒絕交出證物，啟動七息守城', effects: { pressure: 15, trust: 10, organs: { heart: 1 } },
        log: '七個自治節點首次聯手，擋下了中樞的接管。' },
      { label: '交出部分證物，換取赦免與喘息', effects: { pressure: -10, trust: -12 },
        log: '你換來了暫時的安全，卻也讓出了部分主動權。' },
    ],
  },
  {
    id: 'ch053', chapter: '第五十三至五十四章 · 中樞的帳', title: '合併或自治',
    text: '暗生灰穗首次收割的同時，晏平章公開天衡總帳，提出合併弱城以換取續存。你必須提出自己的方案。',
    choices: [
      { label: '推行自治協同方案，承擔前三年風險', effects: { order: -8, trust: 12, food: 10 },
        log: '你選擇了更慢卻更公平的路，居民重新獲得了選擇權。' },
      { label: '傾向中樞合併方案，換取短期穩定', effects: { order: 12, trust: -14, pressure: -8 },
        log: '效率提升了，但更多弱小的聚落將被犧牲。' },
    ],
  },
  {
    id: 'ch055', chapter: '第五十五至五十九章 · 十城合核', title: '合核與聯約',
    text: '秦懷忠強行合核十城造成大量死傷，清河城拒絕加入並尋求脫離，提議簽署三城聯約。',
    choices: [
      { label: '支持清河城脫離，簽署三城聯約', effects: { trust: 14, pressure: 6, organs: { river: 1 } },
        log: '三城聯約保留了各城的否決權，效率雖低，卻守住了尊嚴。' },
      { label: '不介入，任由十城合核完成', effects: { order: 10, trust: -16, population: -300 },
        log: '合核穩定了核心，卻抹平了邊區與三百餘條性命。' },
    ],
  },
  {
    id: 'ch060', chapter: '第六十章 · 第一寸新土', title: '第一寸新土', single: true,
    text: '記憶糧契、遲影的補記與三城聯約仍願共同維持的部分，在三槐台外緣凝結出一條長十二步的新土——界域第一次沒有支出地增加了一寸。',
    choices: [
      { label: '繼續', effects: { trust: 10, order: 10 },
        log: '中樞確認界域總量無支出地增加後，將忠脈失控與新增座標合併升為特級清收。' },
    ],
  },
  {
    id: 'ch061', chapter: '第六十一章 · 特級清收', title: '低效情感干擾？',
    text: '晏平章降下特級清收符印，殘核質疑你堅持契約與對價是「低效情感干擾」，建議改用更冷酷的效率算法。',
    choices: [
      { label: '冷靜剖析生存邏輯，堅持契約與對價', effects: { trust: 15, pressure: 10 }, setFlags: ['rejected_core_temptation'],
        log: '你拒絕了殘核的純理性誘惑——居民的信任，才是你最大的底牌。' },
      { label: '採納殘核建議，提高決策效率', effects: { order: 15, trust: -20 },
        log: '效率提升的代價，是居民開始把你和中樞畫上等號。' },
    ],
  },
  {
    id: 'ch064', chapter: '第六十四至六十五章 · 合核底部的牌', title: '兵器之誘',
    text: '殘核誘導你將萬界城數萬居民煉成「絕對合界兵器」；與此同時秦懷忠啟動保城契，強抽剩餘九城的生靈。你必須決定如何應戰。',
    choices: [
      { label: '拒絕兵器化，以半生軀傀儡正面迎擊', effects: { population: -1800, pressure: -20, trust: 10, organs: { mine: -1 } },
        log: '半生軀傀儡衝入死穴，秦懷忠身亡，特級清收令被粉碎——代價慘重，但你沒有變成你痛恨的那種人。' },
      { label: '接受殘核方案，以居民為代價換取效率', effects: { population: -3000, order: 20, trust: -25 },
        log: '你贏得了戰鬥，卻第一次真正成為了自己曾經痛恨的那種人。' },
    ],
  },
  {
    id: 'ch067', chapter: '第六十七至七十章 · 無核重創與新土宣告', title: '獨立宣告', single: true,
    text: '跨階違背了「借力必由具體區域承擔代價」的鐵律，反噬當場落下：黑礦焚毀、居民折壽、你的神魂重創、右臂徹底廢用。你選擇性截取旁支殘骸與清河城倖存者，鎖入空胎。',
    choices: [
      { label: '宣告無漏之地獨立', effects: { population: 4200, trust: 20, organs: { forest: 1 } },
        log: '約四萬二千人錨定入空胎，灰色新土劇烈擴展，第一道空間極光亮起——秦無漏宣告無漏之地獨立。第一卷「空胎」落幕，第二卷「獵界」開啟。', end: 'win' },
    ],
  },
];
