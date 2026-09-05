import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

const content: RatesPageContent = {
  path: '/it/tassi-aave-apy',
  lang: 'it',
  ogLocale: 'it_IT',
  title: 'Tassi Aave e APY in tempo reale | Aave V3',
  description:
    'Confronta i tassi di deposito e prestito di Aave V3 su tutte le reti in tempo reale. Come funziona il protocollo, cosa determina gli APY e quanto pesano gli incentivi sul rendimento effettivo.',
  h1: 'Tassi Aave e APY: come leggere i rendimenti di Aave V3',
  intro:
    'Gli APY di Aave cambiano di continuo con l’utilizzo delle pool. Qui trovi cosa significano i numeri, cosa è cambiato con la V3 e come incentivi come Merit, Merkl e Brevis modificano il rendimento reale. I valori aggiornati sono nella dashboard live.',
  cta: { label: 'Vedi i tassi Aave in tempo reale', to: '/' },
  breadcrumb: {
    ariaLabel: 'Percorso di navigazione',
    home: { label: 'Home', to: '/' },
    current: 'Tassi Aave e APY',
  },
  sections: [
    {
      id: 'come-funziona',
      h2: 'Come funziona il protocollo Aave',
      paragraphs: [
        'Aave è un mercato di liquidità non custodiale: nessuno detiene i tuoi fondi, le regole vivono in smart contract pubblici. Chi deposita riceve aToken il cui saldo cresce automaticamente con gli interessi maturati.',
        'Chi prende in prestito deve depositare un collaterale superiore al debito (sovracollateralizzazione) e paga interessi alla pool. I tassi non li decide nessuno: derivano da una curva legata all’utilizzo, cioè alla quota di liquidità effettivamente presa in prestito.',
        'Se il valore del collaterale scende e l’health factor va sotto 1, la posizione può essere liquidata: un liquidatore esterno ripaga parte del debito e riceve in cambio collaterale scontato.',
      ],
    },
    {
      id: 'v3',
      h2: 'Cosa cambia con Aave V3',
      paragraphs: [
        'La V3 nasce multichain: la stessa riserva esiste su più reti, con pool e tassi del tutto indipendenti. Parlare del “tasso Aave su USDC” senza indicare la rete non significa nulla.',
        'Si aggiungono E-Mode (maggiore capacità di prestito tra asset correlati come ETH e LST), isolation mode (asset nuovi con tetto di debito dedicato) e supply/borrow cap per riserva. Vicino ai cap i tassi diventano molto più volatili.',
      ],
    },
    {
      id: 'composizione',
      h2: 'Di cosa è fatto l’APY che vedi',
      paragraphs: [
        'Ogni numero in dashboard si scompone in tasso base del protocollo e APR da incentivi. Il tasso base è calcolato dalla curva; gli incentivi arrivano da programmi come Merit, Merkl e Brevis.',
        'Gli incentivi hanno un budget e una scadenza: non sono rendimento strutturale. Prima di scegliere una riserva conviene guardare il tasso base da solo e chiedersi se resta interessante una volta chiusa la campagna.',
      ],
    },
    {
      id: 'esempio',
      h2: 'Esempio: 10.000 € in USDC su Base',
      paragraphs: [
        'Con 10.000 € equivalenti in USDC depositati su Base e un APY di deposito del 4,2 %, gli interessi annui sono circa 420 €, poco più di 35 € al mese. È una proiezione a tasso fermo: nella realtà il tasso si muove a ogni blocco.',
        'Se sulla stessa riserva è attivo un incentivo Merit dell’1,8 % APR, il rendimento effettivo sale intorno al 6 %, cioè circa 600 € l’anno. La differenza tra tasso base e APY effettivo è esattamente quella evidenziata in dashboard.',
        'Lato prestito: con 10.000 € di collaterale in ETH e 4.000 € presi in prestito in USDC a un APY del 5,5 %, il costo è di circa 220 € l’anno. Su Base le commissioni di rete sono di pochi centesimi, mentre su Ethereum mainnet possono erodere il rendimento di importi contenuti.',
      ],
    },
  ],
  drivers: {
    id: 'fattori',
    h2: 'I fattori che muovono gli APY',
    items: [
      {
        title: 'Utilizzo della pool',
        body: 'È il fattore dominante. Superata la soglia ottimale (spesso 80–90 %), la curva si impenna e sia il tasso di deposito sia quello di prestito salgono rapidamente.',
      },
      {
        title: 'Parametri della riserva',
        body: 'Base rate, slope 1 e 2, reserve factor, supply cap e borrow cap sono decisi dalla governance e differiscono da rete a rete anche per lo stesso asset.',
      },
      {
        title: 'Rete e profondità di liquidità',
        body: 'Sulle reti mature i tassi sono più stabili; su L2 recenti bastano pochi movimenti importanti per spostare l’APY di diversi punti.',
      },
      {
        title: 'Incentivi esterni',
        body: 'Merit, Merkl e Brevis si sommano al tasso base. Sono temporanei: alla fine della campagna il rendimento effettivo torna al livello del solo tasso base.',
      },
    ],
  },
  howTo: {
    id: 'come-usare',
    h2: 'Come usare la dashboard in 4 passi',
    steps: [
      'Cerca l’asset che ti interessa nella dashboard live e confronta gli APY di deposito e prestito su tutte le reti.',
      'Separa tasso base e APR da incentivi per capire quanto del rendimento è strutturale.',
      'Apri la pagina della rete (ad esempio /chain/base) per vedere tutte le riserve disponibili lì.',
      'Usa la simulazione di portafoglio per inserire i tuoi importi e stimare il rendimento netto combinando deposito e prestito.',
    ],
  },
  faq: {
    h2: 'Domande frequenti',
    items: [
      {
        q: 'Qual è la differenza tra APR e APY su Aave?',
        a: 'L’APR è un tasso semplice, senza capitalizzazione; l’APY include l’effetto della capitalizzazione continua degli interessi. Poiché gli interessi di Aave si accumulano nel saldo, l’APY rappresenta meglio il rendimento reale.',
      },
      {
        q: 'Ogni quanto cambiano i tassi?',
        a: 'Potenzialmente a ogni blocco. Basta un deposito o un rimborso rilevante per spostare l’utilizzo della pool e quindi il tasso.',
      },
      {
        q: 'Come vengono tassati in Italia i rendimenti da DeFi?',
        a: 'I redditi da cripto-attività rientrano di norma tra i redditi diversi, con obblighi di monitoraggio nel quadro RW e possibile imposta sul valore delle cripto-attività. Sulle rendite da staking e lending le interpretazioni variano: conviene farsi seguire da un commercialista.',
      },
      {
        q: 'Aave rientra nella normativa MiCA?',
        a: 'MiCA regola soprattutto emittenti e prestatori di servizi su cripto-attività; un protocollo pienamente decentralizzato e non custodiale resta in un’area ancora da definire. Consob e le autorità europee stanno chiarendo il perimetro progressivamente.',
      },
      {
        q: 'Esistono stablecoin in euro utilizzabili su Aave?',
        a: 'Alcune riserve in euro, come EURC, sono presenti su determinate reti ma con liquidità molto inferiore rispetto a USDC e USDT: i tassi tendono a essere più volatili e gli spread di conversione più ampi.',
      },
      {
        q: 'Quale rete conviene per importi contenuti?',
        a: 'Per cifre piccole le L2 come Base, Arbitrum o Optimism riducono drasticamente i costi di transazione. Ethereum mainnet resta preferibile quando servono liquidità profonda e capacità di uscita su importi elevati.',
      },
      {
        q: 'Gli incentivi sono garantiti?',
        a: 'No. Dipendono da budget, durata e condizioni del programma e possono essere modificati o interrotti. Dove la durata è nota, la dashboard mostra il periodo della campagna.',
      },
      {
        q: 'Come si riduce il rischio di liquidazione?',
        a: 'Tenendo un health factor con ampio margine, evitando collaterali molto volatili rispetto al debito e conservando liquidità pronta per rimborsare o integrare il collaterale nei momenti di stress.',
      },
      {
        q: 'Da dove arrivano i dati mostrati?',
        a: 'Dallo stato on-chain di Aave V3 e dai dati pubblici dei programmi di incentivo, aggregati e aggiornati ogni pochi minuti. Verifica sempre i valori nell’app ufficiale prima di operare.',
      },
    ],
  },
  related: {
    ariaLabel: 'Pagine correlate',
    links: [
      { to: '/', label: 'Dashboard tassi in tempo reale' },
      { to: '/asset/usdc', label: 'Tassi USDC per rete' },
      { to: '/defi-yield-tracker', label: 'DeFi Yield Tracker' },
    ],
  },
};

export default function AaveTassiApyIT() {
  return <LocalizedRatesPage content={content} />;
}
