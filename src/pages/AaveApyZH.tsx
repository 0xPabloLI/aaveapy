import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

// Localized landing page for Traditional Chinese search markets (TW / HK).
// Chinese here is intentional user-facing content; excluded from no-chinese-visible check.
const content: RatesPageContent = {
  path: '/zh/aave-lilv-apy',
  lang: 'zh-Hant',
  ogLocale: 'zh_TW',
  title: 'Aave 利率與 APY 即時查詢 | Aave V3 存借利率',
  description:
    '即時比較 Aave V3 各條鏈的存款與借款 APY。了解協議運作方式、利率如何形成，以及 Merit、Merkl、Brevis 等獎勵對實際收益率的影響。',
  h1: 'Aave 利率與 APY：看懂 Aave V3 的存借收益',
  intro:
    'Aave 的利率會隨資金池使用率持續變動。本頁說明 APY 的意義、V3 帶來哪些改變，以及如何把獎勵計入實際收益率。最新數字請看即時看板。',
  cta: { label: '查看即時利率看板', to: '/' },
  breadcrumb: {
    ariaLabel: '麵包屑導覽',
    home: { label: '首頁', to: '/' },
    current: 'Aave 利率與 APY',
  },
  sections: [
    {
      id: 'how-it-works',
      h2: 'Aave 協議如何運作',
      paragraphs: [
        'Aave 是非託管的流動性市場，沒有任何機構保管你的資金，所有規則都寫在公開的智能合約中。存款者會取得 aToken，餘額會隨利息自動增加。',
        '借款者必須提供高於借款金額的抵押品（超額抵押），並向資金池支付利息。利率不是由誰決定，而是依照使用率（已被借出的資金比例）沿著利率曲線計算出來。',
        '當抵押品價值下跌、健康係數低於 1 時，部位可能被清算：第三方代為償還部分債務，並以折扣取得抵押品。',
      ],
    },
    {
      id: 'v3',
      h2: 'Aave V3 有什麼不同',
      paragraphs: [
        'V3 以多鏈為前提設計，同一種資產在不同網路各自有獨立的資金池與利率，因此「Aave 的 USDC 利率」若不指明鏈別其實沒有意義。',
        'V3 另外加入 E-Mode（ETH 與 LST 等高度相關資產可提高借貸額度）、隔離模式（新資產設有獨立債務上限），以及每個 reserve 的供應與借款上限。越接近上限，利率波動就越劇烈。',
      ],
    },
    {
      id: 'composition',
      h2: '看板上的 APY 由什麼組成',
      paragraphs: [
        '每個數字都可拆成協議的基礎利率與獎勵 APR。基礎利率由利率曲線計算，獎勵則來自 Merit、Merkl、Brevis 等分發計畫。',
        '獎勵有預算與期限，並非長期結構性收益。評估 reserve 時，建議先單獨看基礎利率，再判斷活動結束後是否仍值得持有。',
      ],
    },
    {
      id: 'example',
      h2: '試算範例：在 Base 存入 10,000 USDC',
      paragraphs: [
        '假設在 Base 鏈存入 10,000 USDC、存款 APY 為 4.2%，年化毛收益約 420 USDC，換算每月約 35 USDC。這是以利率不變為前提的推估，實際上利率每個區塊都可能改變。',
        '若同一個 reserve 另有 1.8% APR 的 Merit 獎勵，實際收益率會提高到約 6%，一年約 600 USDC。看板上基礎利率與有效 APY 的差距，就是這一段。',
        '借款端：以價值 10,000 USDC 的 ETH 作為抵押、借出 4,000 USDC，借款 APY 5.5% 時，一年成本約 220 USDC。Base 等 L2 的手續費一次僅需數美分，而在 Ethereum 主網，小額操作的手續費可能吃掉大部分收益。',
      ],
    },
  ],
  drivers: {
    id: 'drivers',
    h2: '影響 APY 的四個因素',
    items: [
      {
        title: '資金池使用率',
        body: '最主要的因素。超過最佳使用率（多數 reserve 落在 80%–90%）之後，曲線斜率大幅拉高，存款與借款利率會同時快速上升。',
      },
      {
        title: 'Reserve 參數',
        body: '基礎利率、slope 1／slope 2、reserve factor、供應與借款上限皆由治理投票決定，同一資產在不同鏈上的設定可能完全不同。',
      },
      {
        title: '網路與流動性深度',
        body: '成熟網路的利率較穩定；新興 L2 資金量薄，少數幾筆大額進出就足以讓 APY 明顯跳動。',
      },
      {
        title: '外部獎勵',
        body: 'Merit、Merkl、Brevis 會疊加在基礎利率之上，多為限期活動，結束後有效 APY 會回落到基礎水準。',
      },
    ],
  },
  howTo: {
    id: 'how-to',
    h2: '四個步驟用好這個看板',
    steps: [
      '在即時看板搜尋你關注的資產，一次比較所有鏈上的存款與借款 APY。',
      '把基礎利率與獎勵 APR 分開檢視，判斷有多少收益屬於長期可持續的部分。',
      '打開鏈別頁面（例如 /chain/base），一次瀏覽該網路上的所有 reserve。',
      '使用投組模擬輸入你的金額，估算存款與借款組合後的淨收益率。',
    ],
  },
  faq: {
    h2: '常見問題',
    items: [
      {
        q: 'APR 與 APY 有什麼差別？',
        a: 'APR 是不含複利的單利年化，APY 則已計入利息持續複投的效果。Aave 的利息會直接累積在餘額中，因此以 APY 衡量實際報酬較貼近真實情況。',
      },
      {
        q: 'Aave 的利率多久變動一次？',
        a: '理論上每個區塊都可能變動。只要有較大額的存入或還款改變資金池使用率，利率就會立即調整。',
      },
      {
        q: '台灣的稅務上要如何處理 DeFi 收益？',
        a: '虛擬資產交易所得通常被視為財產交易所得或海外所得，實務認定會依交易型態而異，DeFi 借貸的處理也尚在釐清中。金額較大時建議先諮詢會計師。',
      },
      {
        q: '台灣與香港的法規對使用 Aave 有影響嗎？',
        a: 'Aave 本身是非託管協議，但台灣金管會對虛擬資產服務業、香港證監會對虛擬資產平台的規範仍在持續調整，主要影響的是出入金與交易所端。建議留意主管機關公告。',
      },
      {
        q: 'Aave 上有沒有台幣或港幣穩定幣？',
        a: '沒有。主要 reserve 以美元穩定幣（USDC、USDT）為主，部分網路另有歐元穩定幣。若以台幣或港幣入金，通常需先在交易所兌換成 USDC 等資產再轉入鏈上。',
      },
      {
        q: '小額資金該選哪一條鏈？',
        a: '小額建議使用 Base、Arbitrum、Optimism 等 L2，手續費低很多。資金規模大、重視出場流動性深度時，Ethereum 主網仍較合適。',
      },
      {
        q: '獎勵 APR 一定拿得到嗎？',
        a: '沒有保證。獎勵取決於各計畫的預算、期間與資格條件，隨時可能調整或結束。若活動期間已公布，看板會一併顯示。',
      },
      {
        q: '如何降低被清算的風險？',
        a: '保持較寬裕的健康係數、避免抵押品與債務波動性差異過大，並保留可隨時還款或補充抵押品的資金，是最基本的做法。',
      },
      {
        q: '網站上的數據來自哪裡？',
        a: '來自 Aave V3 的鏈上狀態與各獎勵計畫的公開資料，每幾分鐘更新一次。實際操作前請再以官方前端的數字為準。',
      },
    ],
  },
  related: {
    ariaLabel: '相關頁面',
    links: [
      { to: '/', label: '即時利率看板' },
      { to: '/asset/usdc', label: 'USDC 各鏈利率' },
      { to: '/defi-yield-tracker', label: 'DeFi Yield Tracker' },
    ],
  },
};

export default function AaveApyZH() {
  return <LocalizedRatesPage content={content} />;
}
