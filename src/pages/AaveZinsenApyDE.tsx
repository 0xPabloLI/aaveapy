import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

const content: RatesPageContent = {
  path: '/de/aave-zinsen-apy',
  lang: 'de',
  ogLocale: 'de_DE',
  title: 'Aave Zinsen & APY — Lending-Rendite V3 in Echtzeit',
  description:
    'Vergleiche die Aave-V3-Zinsen (APY) für Einlagen und Kredite über alle Netzwerke, verstehe wie das Aave-Protokoll funktioniert und wie Anreizprogramme die reale Rendite verändern.',
  h1: 'Aave Zinsen und APY in V3: so entsteht die Rendite',
  intro:
    'Kompakter Leitfaden zu den Zinsen von Aave: was APY bedeutet, wie das Protokoll Einlage- und Kreditzinsen bestimmt, was sich mit V3 ändert und wie Merit, Merkl und Brevis auf die reale Rendite einzahlen. Die Live-Zahlen stehen im Dashboard und werden jede Minute aktualisiert.',
  cta: { label: 'Aave Zinsen live ansehen', to: '/' },
  breadcrumb: {
    ariaLabel: 'Brotkrumen-Navigation',
    home: { label: 'Startseite', to: '/' },
    current: 'Aave Zinsen und APY',
  },
  sections: [
    {
      id: 'funktionsweise',
      h2: 'Wie das Aave-Protokoll funktioniert',
      paragraphs: [
        'Aave ist ein nicht-verwahrender Liquiditätsmarkt: niemand hält deine Mittel für dich, alle Regeln stehen in öffentlichen Smart Contracts. Wer einen Vermögenswert einzahlt, erhält einen aToken, dessen Guthaben laufend Zinsen ansammelt. Wer leiht, muss überbesicherte Sicherheiten hinterlegen und zahlt Zinsen an den Pool.',
        'Den Zinssatz legt niemand fest: er ergibt sich aus einer Kurve, die von der Auslastung des Pools abhängt — also vom Anteil der Einlagen, der verliehen ist. Nahe am optimalen Punkt steigen die Zinsen langsam, darüber sehr steil, um neue Einlagen anzuziehen und die Auszahlungsliquidität zu schützen.',
        'Fällt die Besicherung eines Kreditnehmers unter die Grenze (Health Factor unter 1), wird die Position liquidierbar: ein Teil der Schuld wird von Dritten getilgt, die dafür einen Bonus auf die Sicherheiten erhalten.',
      ],
    },
    {
      id: 'v3',
      h2: 'Was Aave V3 an den Zinsen ändert',
      paragraphs: [
        'V3 ist von Grund auf multichain: dieselbe Reserve existiert auf mehreren Netzwerken mit unabhängigen Pools und Zinsen. Dazu kommen E-Mode (höhere Kreditkraft bei korrelierten Assets wie ETH und LSTs), Isolation Mode (neue Assets mit eigenem Schuldenlimit) sowie Supply- und Borrow-Caps je Reserve. In der Praxis lohnt sich nur noch der Vergleich Reserve für Reserve und Netzwerk für Netzwerk.',
      ],
    },
    {
      id: 'rechenbeispiel',
      h2: 'Rechenbeispiel: 10.000 € in USDC auf Base',
      paragraphs: [
        'Angenommen, du legst 10.000 € als USDC auf Base ein. Bei einem angezeigten Einlage-APY von 4,2 % ergibt das rund 420 € Bruttoertrag im Jahr, also etwa 35 € pro Monat — vorausgesetzt, der Zins bliebe konstant, was in der Praxis nie der Fall ist.',
        'Kommt auf dieselbe Reserve ein Merit-Anreiz von 1,8 % APR dazu, liegt die effektive Rendite bei etwa 6 %, also grob 600 € im Jahr. Genau diese Differenz zeigt das Dashboard als Unterschied zwischen Basiszins und effektivem APY.',
        'Auf der Kreditseite: 10.000 € ETH als Sicherheit, davon 4.000 € USDC geliehen zu 5,5 % Kredit-APY, kostet rund 220 € im Jahr. Der Health Factor bleibt komfortabel, solange ETH nicht stark einbricht; unter 1 wird die Position liquidierbar. Die Transaktionsgebühren auf einem L2 wie Base liegen im Cent-Bereich und fallen gegenüber diesen Beträgen nicht ins Gewicht — auf dem Ethereum-Mainnet wäre das bei kleinen Summen anders.',
      ],
    },
  ],
  drivers: {
    id: 'faktoren',
    h2: 'Was den APY jeder Reserve bestimmt',
    items: [
      {
        title: 'Auslastung des Pools',
        body: 'Der wichtigste Faktor. Die Zinskurve hat einen optimalen Punkt (meist zwischen 80 % und 90 % Auslastung); darüber wird die Steigung deutlich aggressiver, um neue Einlagen anzulocken.',
      },
      {
        title: 'Parameter der Reserve',
        body: 'Jede Reserve hat eigenen Basiszins, Slope 1, Slope 2 und Reservefaktor, festgelegt durch die Governance. Genau das unterscheidet die USDC-Kurve von der ETH-Kurve.',
      },
      {
        title: 'Netzwerk und lokale Liquidität',
        body: 'Dieselbe Reserve hat pro Netzwerk eigene Pools. Kleinere Netzwerke haben weniger Liquidität, dort bewegen große Einlagen den Zins viel stärker.',
      },
      {
        title: 'Externe Anreize',
        body: 'Merit, Merkl und Brevis addieren APR auf den Basiszins. Ein Pool mit moderatem Basis-APY kann dank Anreizen die beste effektive Rendite im Markt liefern.',
      },
    ],
  },
  howTo: {
    id: 'vergleichen',
    h2: 'So vergleichst du Zinsen auf AaveAPY',
    steps: [
      'Öffne das Live-Dashboard und sortiere nach der Spalte Einlage-APY oder Kredit-APY.',
      'Nutze den APR/APY-Umschalter, damit der Vergleich zur Darstellung des jeweiligen Anreizprogramms passt.',
      'Filtere nach Netzwerk über die Chain-Seiten oder nach Asset über die Asset-Seiten.',
      'Nutze vor der Entscheidung den Simulator: gib den geplanten Einlage- oder Kreditbetrag ein und sieh, wie stark deine eigene Position die Kurve verschiebt.',
    ],
  },
  faq: {
    h2: 'Häufige Fragen',
    items: [
      {
        q: 'Was ist APY bei Aave?',
        a: 'APY (Annual Percentage Yield) ist der Jahreszins inklusive Zinseszins. Bei Aave gibt es je Asset zwei Werte: den Einlage-APY (was du für bereitgestellte Liquidität bekommst) und den Kredit-APY (was du zahlst). Beide ändern sich laufend mit der Auslastung des Pools.',
      },
      {
        q: 'Wie funktioniert das Aave-Protokoll?',
        a: 'Nutzer zahlen Assets in Pools ein und erhalten aTokens, die automatisch Zinsen ansammeln. Andere leihen aus diesen Pools gegen überbesicherte Sicherheiten. Der Zins folgt einer Kurve, die von der Auslastung des Pools abhängt.',
      },
      {
        q: 'Was ist der Unterschied zwischen APR und APY?',
        a: 'APR ist der einfache Zins ohne Zinseszins, APY berücksichtigt die Kapitalisierung über ein Jahr. Anreizprogramme veröffentlichen meist APR; wir rechnen für den Vergleich mit dem Basiszins in APY um und bieten einen APR/APY-Umschalter an.',
      },
      {
        q: 'Warum ändert sich der Aave-Zins ständig?',
        a: 'Weil er eine Funktion der Auslastung ist (geliehene Summe ÷ eingezahlte Summe). Eine große Einzahlung senkt die Auslastung und damit die Zinsen; hohe Kreditnachfrage treibt Auslastung und Zinsen über den optimalen Punkt hinaus.',
      },
      {
        q: 'Was sind Merit, Merkl und Brevis?',
        a: 'Token-Belohnungsprogramme, die zusätzliche Anreize an Einleger oder Kreditnehmer bestimmter Reserven ausschütten. Sie gehören nicht zum Basiszins, verändern aber die reale Rendite. Deshalb zeigen wir effektiven APY = Basis-APY + Anreize sowie den isolierten Basiszins.',
      },
      {
        q: 'Welche Aave-Einlagezinsen sind heute am besten?',
        a: 'Das ändert sich minütlich und hängt von Asset, Netzwerk und aktiven Anreizen ab. Stablecoins wie USDC und USDT auf L2-Netzwerken (Base, Arbitrum, Polygon) bündeln oft die beste Kombination aus APY und Liquidität. Sortiere im Live-Dashboard nach effektivem APY statt statischen Listen zu vertrauen.',
      },
      {
        q: 'Brauche ich eine Wallet, um Zinsen anzusehen?',
        a: 'Nein. Die Abfrage ist rein lesend, ohne Wallet und ohne Registrierung. Eine Wallet verbindest du erst in der offiziellen Aave-App, wenn du tatsächlich einzahlst oder leihst.',
      },
      {
        q: 'Wie werden Aave-Erträge in Deutschland besteuert?',
        a: 'Das hängt von deiner persönlichen Situation ab und ist keine Steuerberatung. Erträge aus Lending werden in Deutschland üblicherweise als Kapital- oder sonstige Einkünfte behandelt; dokumentiere Ein- und Auszahlungen sowie Belohnungen und kläre die Einordnung mit einer Steuerberatung.',
      },
      {
        q: 'Fällt Aave unter MiCA und die BaFin-Aufsicht?',
        a: 'MiCA reguliert Stablecoin-Emittenten und Krypto-Dienstleister (CASP), die in Deutschland von der BaFin beaufsichtigt werden. Aave selbst ist ein dezentrales Protokoll ohne Vermittler; direkt betroffen sind vor allem die Stablecoins in den Reserven und die Handelsplätze, über die du Krypto kaufst. Praktisch beeinflusst das vor allem, welche Stablecoins aus Europa heraus gut zugänglich bleiben.',
      },
      {
        q: 'Gibt es Euro-Stablecoins auf Aave?',
        a: 'Die liquidesten Aave-Reserven lauten auf Dollar-Stablecoins (USDC, USDT, DAI). Euro-Stablecoins wie EURC existieren auf einzelnen Reserven, aber mit deutlich geringerer Liquidität, volatileren Zinsen und niedrigeren Caps. Wer in Euro rechnet, trägt bei einer USDC-Einlage zusätzlich das EUR/USD-Wechselkursrisiko über dem angezeigten APY.',
      },
      {
        q: 'Welches Netzwerk lohnt sich für kleinere Beträge aus Deutschland?',
        a: 'Für einige tausend Euro sind L2-Netzwerke (Base, Arbitrum, Optimism, Polygon) klar geeigneter: Transaktionsgebühren liegen dort im Cent-Bereich, auf dem Ethereum-Mainnet dagegen häufig bei mehreren Euro. Das Mainnet punktet nur mit Liquiditätstiefe, was erst bei großen Positionen zählt.',
      },
      {
        q: 'Gilt die einjährige Haltefrist für Aave-Einlagen?',
        a: 'Das ist keine Steuerberatung. Für private Veräußerungsgeschäfte mit Kryptowerten gilt in Deutschland grundsätzlich eine einjährige Haltefrist; ob Lending-Erträge diese Einordnung verändern oder als sonstige Einkünfte zu behandeln sind, hängt vom Einzelfall und der aktuellen Verwaltungsauffassung ab. Dokumentiere Einzahlungen, Abhebungen und Rewards mit Zeitstempel und lass die Einordnung steuerlich prüfen.',
      },
    ],
  },
  related: {
    ariaLabel: 'Verwandte Seiten',
    links: [
      { to: '/', label: 'Live-Dashboard' },
      { to: '/defi-yield-tracker', label: 'DeFi Yield Tracker' },
      { to: '/asset/usdc', label: 'USDC APY' },
    ],
  },
};

export default function AaveZinsenApyDE() {
  return <LocalizedRatesPage content={content} />;
}
