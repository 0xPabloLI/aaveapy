import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

// Localized landing page for Traditional Chinese search markets (TW / HK).
// Chinese here is intentional user-facing content; excluded from no-chinese-visible check.
const content: RatesPageContent = {
  path: '/zh/aave-lilv-apy',
  lang: 'zh-Hant',
  ogLocale: 'zh_TW',
  title: 'Aave 利率與 APY 即時查詢 | Aave V3 存借利率',
  description:
    '即時比較 Aave V3 各條鏈的存款與借款 APY，了解利率如何形成，以及 Merit、Merkl、Brevis 等獎勵對實際年化收益的影響。',
  h1: 'Aave 利率與 APY：看懂 Aave V3 的存借收益',
  intro:
    'Aave 的利率會隨資金池使用率持續變動。這一頁說明 APY 到底代表什麼、V3 帶來哪些改變，以及該怎麼把獎勵計入實際年化收益。最新數字請直接看即時看板。',
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
        'Aave 是非託管的流動性市場：沒有任何機構保管你的資金，所有規則都寫在公開的智能合約裡。存入資產後你會拿到對應的 aToken，餘額會隨著利息自動增加。',
        '借款者必須先存入高於借款金額的抵押品（超額抵押），再向資金池支付利息。利率不是由誰決定的，而是依照資金池使用率（已被借出的資金比例）沿著利率曲線自動算出。',
        '當抵押品價值下跌、健康因子（health factor）低於 1，部位就可能被清算：由第三方代為償還部分債務，並以折價取得你的抵押品。',
      ],
    },
    {
      id: 'v3',
      h2: 'Aave V3 有什麼不同',
      paragraphs: [
        'V3 從一開始就以多鏈為前提設計：同一種資產在不同網路上各有獨立的資金池與利率，所以「Aave 的 USDC 利率」如果沒有指明是哪一條鏈，其實沒有意義。',
        'V3 另外加入 E-Mode（ETH 與 LST 等高度相關資產可提高借貸額度）、隔離模式（新上架資產設有獨立債務上限），以及每個儲備池各自的供應與借款上限。越接近上限，利率波動就越劇烈。',
      ],
    },
    {
      id: 'composition',
      h2: '看板上的 APY 由什麼組成',
      paragraphs: [
        '看板上的每個數字都可以拆成兩塊：協議的基礎利率，以及獎勵 APR。基礎利率由利率曲線算出，獎勵則來自 Merit、Merkl、Brevis 等分發計畫。',
        '獎勵有預算也有期限，不是長期穩定的收益來源。評估一個儲備池時，建議先單獨看基礎利率，再判斷活動結束後是否還值得續抱。',
      ],
    },
    {
      id: 'example',
      h2: '試算範例：在 Base 存入 10,000 USDC',
      paragraphs: [
        '假設在 Base 鏈存入 10,000 USDC，存款 APY 為 4.2%，一年的利息約 420 USDC，平均每月約 35 USDC。這是把利率固定住的推估，實際上利率每個區塊都可能變動。',
        '若同一個儲備池另有 1.8% APR 的 Merit 獎勵，實際年化收益會提高到約 6%，一年約 600 USDC。看板上基礎利率與有效 APY 之間的差距，指的就是這一段。',
        '借款端：以價值 10,000 USDC 的 ETH 作為抵押、借出 4,000 USDC，在借款 APY 5.5% 之下，一年利息成本約 220 USDC。Base 等 L2 一次操作的手續費只要幾美分，但在 Ethereum 主網，小額操作的手續費可能就吃掉大半收益。',
      ],
    },
  ],
  drivers: {
    id: 'drivers',
    h2: '影響 APY 的四個因素',
    items: [
      {
        title: '資金池使用率',
        body: '最主要的因素。一旦超過最佳使用率（多數儲備池落在 80%–90%），利率曲線的斜率會大幅拉高，存款與借款利率同時快速上升。',
      },
      {
        title: '儲備池參數',
        body: '基礎利率、slope 1／slope 2、reserve factor、供應與借款上限都由治理投票決定；同一種資產在不同鏈上的設定可能完全不同。',
      },
      {
        title: '網路與流動性深度',
        body: '成熟網路的利率相對穩定；新興 L2 的資金量較薄，往往幾筆大額進出就足以讓 APY 明顯跳動。',
      },
      {
        title: '外部獎勵',
        body: 'Merit、Merkl、Brevis 的獎勵會疊加在基礎利率之上，且多半是限期活動；活動一結束，有效 APY 就會回落到基礎水準。',
      },
    ],
  },
  howTo: {
    id: 'how-to',
    h2: '四個步驟用好這個看板',
    steps: [
      '在即時看板搜尋你關注的資產，一次比較所有鏈上的存款與借款 APY。',
      '把基礎利率與獎勵 APR 分開來看，判斷有多少收益屬於長期可持續的部分。',
      '打開單一鏈的頁面（例如 /chain/base），一次瀏覽該網路上的所有儲備池。',
      '用投資組合模擬輸入自己的金額，估算存款與借款搭配後的淨年化收益。',
    ],
  },
  faq: {
    h2: '常見問題',
    items: [
      {
        q: 'APR 與 APY 有什麼差別？',
        a: 'APR 是不含複利的單利年化；APY 則已把利息持續複投的效果算進去。Aave 的利息會直接累積在餘額裡，所以用 APY 衡量實際報酬更貼近真實情況。',
      },
      {
        q: 'Aave 的利率多久變動一次？',
        a: '理論上每個區塊都可能變動。只要有一筆較大額的存入或還款改變了資金池使用率，利率就會立刻跟著調整。',
      },
      {
        q: '台灣的稅務上要如何處理 DeFi 收益？',
        a: '虛擬資產的獲利通常會被歸類為財產交易所得或海外所得，實務認定仍會依交易型態而異，DeFi 借貸與獎勵的處理方式也還在釐清中。金額較大時，建議先諮詢會計師或稅務專業人士。',
      },
      {
        q: '台灣與香港的法規對使用 Aave 有影響嗎？',
        a: 'Aave 本身是非託管協議，不過台灣金管會針對虛擬資產服務業、香港證監會針對虛擬資產交易平台的規範都仍在調整中，主要影響的是出入金與交易所端。建議持續留意主管機關公告。',
      },
      {
        q: 'Aave 上有沒有台幣或港幣穩定幣？',
        a: '目前沒有。主要儲備池以美元穩定幣（USDC、USDT）為主，部分網路另有歐元穩定幣。若你用台幣或港幣入金，通常得先在交易所換成 USDC 等資產，再轉到鏈上。',
      },
      {
        q: '小額資金該選哪一條鏈？',
        a: '小額資金建議走 Base、Arbitrum、Optimism 等 L2，手續費低上許多。若資金規模較大、又在意出場時的流動性深度，Ethereum 主網仍然比較合適。',
      },
      {
        q: '獎勵 APR 一定拿得到嗎？',
        a: '沒有保證。獎勵取決於各計畫的預算、期間與資格條件，隨時可能調整或提前結束。活動期間若已公布，看板會一併顯示。',
      },
      {
        q: '如何降低被清算的風險？',
        a: '最基本的做法有三個：健康因子留足緩衝、避免抵押品與債務之間的波動性差距過大，以及保留一筆可以隨時還款或補抵押品的資金。',
      },
      {
        q: '網站上的數據來自哪裡？',
        a: '資料來自 Aave V3 的鏈上狀態與各獎勵計畫的公開資訊，每幾分鐘更新一次。實際操作前，請再以官方前端顯示的數字為準。',
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
