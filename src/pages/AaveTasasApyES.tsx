import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

const content: RatesPageContent = {
  path: '/es/tasas-aave-apy',
  lang: 'es',
  ogLocale: 'es_ES',
  title: 'Tasas Aave V3 y APY — lending cripto en tiempo real',
  description:
    'Compara las tasas (APY) de depósito y préstamo de Aave V3 en todas las redes, entiende cómo funciona el protocolo Aave y cómo los incentivos afectan al rendimiento real del lending.',
  h1: 'Tasas y APY de Aave V3: cómo se forma el rendimiento',
  intro:
    'Guía directa sobre las tasas de Aave: qué es el APY, cómo el protocolo fija los intereses de depósito y préstamo, qué cambia en la V3 y cómo Merit, Merkl y Brevis suman al rendimiento real. Los números en vivo están en el panel, actualizados cada minuto.',
  cta: { label: 'Ver las tasas de Aave en vivo', to: '/' },
  breadcrumb: {
    ariaLabel: 'Ruta de navegación',
    home: { label: 'Inicio', to: '/' },
    current: 'Tasas y APY de Aave',
  },
  sections: [
    {
      id: 'como-funciona',
      h2: 'Cómo funciona el protocolo Aave',
      paragraphs: [
        'Aave es un mercado de liquidez sin custodia: nadie guarda tus fondos por ti y todas las reglas viven en contratos inteligentes públicos. Quien deposita un activo recibe un aToken que acumula intereses de forma continua en el propio saldo. Quien pide prestado debe dejar garantía sobrecolateralizada y paga intereses al pool.',
        'La tasa no la fija nadie: sale de una curva que depende de la utilización del pool, es decir, qué parte de lo depositado está prestada. Cerca del punto óptimo las tasas suben despacio; por encima suben con fuerza para atraer depósitos nuevos y proteger la liquidez de retiro.',
        'Si la garantía de un prestatario cae por debajo del límite (health factor menor que 1), la posición queda expuesta a liquidación: un tercero paga parte de la deuda a cambio de un bono sobre la garantía.',
      ],
    },
    {
      id: 'v3',
      h2: 'Qué cambia Aave V3 en las tasas',
      paragraphs: [
        'La V3 es multichain por diseño: la misma reserva existe en varias redes con pools y tasas independientes. Además incorpora E-Mode (mayor poder de préstamo entre activos correlacionados como ETH y LSTs), isolation mode (activos nuevos con límite de deuda propio) y límites de suministro y préstamo por reserva. En la práctica, comparar "la tasa de Aave" en general ya no sirve: hay que comparar reserva por reserva y red por red.',
      ],
    },
    {
      id: 'ejemplo',
      h2: 'Ejemplo con números: 10.000 € en USDC en Base',
      paragraphs: [
        'Supón un depósito de 10.000 € convertidos a USDC en Base. Con un APY de depósito del 4,2 %, el rendimiento bruto anual ronda los 420 €, unos 35 € al mes, siempre que la tasa se mantuviera estable — algo que en la práctica nunca ocurre.',
        'Si a esa misma reserva se suma un incentivo Merit del 1,8 % de APR, el rendimiento efectivo sube a cerca del 6 %, aproximadamente 600 € al año. Esa es justo la diferencia que el panel muestra entre «tasa base» y «APY efectivo».',
        'En el lado del préstamo: con 10.000 € de ETH como garantía y 4.000 € de USDC prestados al 5,5 % de APY, el coste anual es de unos 220 €. El health factor se mantiene holgado mientras el ETH no caiga con fuerza; por debajo de 1 la posición pasa a ser liquidable. Las comisiones en una L2 como Base son de céntimos por transacción y resultan irrelevantes frente a estas cifras, algo que no sucede en la red principal de Ethereum con importes pequeños.',
      ],
    },
  ],
  drivers: {
    id: 'factores',
    h2: 'Qué determina el APY de cada reserva',
    items: [
      {
        title: 'Utilización del pool',
        body: 'Es el factor principal. La curva tiene un punto óptimo (normalmente entre 80 % y 90 % de utilización); por encima, la pendiente se vuelve mucho más agresiva para atraer depósitos.',
      },
      {
        title: 'Parámetros de la reserva',
        body: 'Cada reserva tiene tasa base, pendiente 1, pendiente 2 y factor de reserva propios, definidos por la gobernanza. Eso diferencia la curva de USDC de la de ETH.',
      },
      {
        title: 'Red y liquidez local',
        body: 'La misma reserva tiene pools independientes por red. Las redes pequeñas tienen menos liquidez, así que un depósito grande mueve mucho más la tasa.',
      },
      {
        title: 'Incentivos externos',
        body: 'Merit, Merkl y Brevis suman APR sobre la tasa base. Un pool con APY base modesto puede ofrecer el mejor rendimiento efectivo del mercado gracias a los incentivos.',
      },
    ],
  },
  howTo: {
    id: 'como-comparar',
    h2: 'Cómo comparar tasas en AaveAPY',
    steps: [
      'Abre el panel en vivo y ordena por la columna de APY de depósito o de préstamo.',
      'Usa el selector APR/APY para alinear la comparación con la forma en que cada programa publica sus recompensas.',
      'Filtra por red en las páginas de cada blockchain, o por activo en las páginas de activo.',
      'Antes de confirmar, usa el simulador: introduce el importe que piensas depositar o pedir prestado y observa cuánto mueve la curva tu propia posición.',
    ],
  },
  faq: {
    h2: 'Preguntas frecuentes',
    items: [
      {
        q: '¿Qué es el APY en Aave?',
        a: 'El APY (Annual Percentage Yield) es la tasa anualizada considerando la capitalización de intereses. En Aave hay dos APY por activo: el de depósito (lo que recibes al aportar liquidez) y el de préstamo (lo que pagas). Ambos varían continuamente según la utilización del pool.',
      },
      {
        q: '¿Cómo funciona Aave lending?',
        a: 'Los usuarios depositan activos en pools y reciben aTokens que acumulan intereses automáticamente. Otros usuarios toman prestado de esos pools dejando garantía sobrecolateralizada. La tasa la define una curva que depende de la utilización del pool.',
      },
      {
        q: '¿Cuál es la diferencia entre APR y APY?',
        a: 'El APR es la tasa simple, sin capitalización. El APY incluye el interés compuesto a lo largo del año. Los incentivos suelen publicarse en APR; los convertimos a APY cuando conviene compararlos con la tasa base, y el panel incluye un selector APR/APY.',
      },
      {
        q: '¿Por qué el APY de Aave cambia todo el tiempo?',
        a: 'Porque la tasa es función de la utilización (total prestado ÷ total depositado). Un depósito grande baja la utilización y las tasas; una fuerte demanda de préstamo sube la utilización y las tasas se disparan por encima del punto óptimo.',
      },
      {
        q: '¿Qué son Merit, Merkl y Brevis?',
        a: 'Son programas de recompensas en tokens que reparten incentivos adicionales a quienes depositan o toman prestado en ciertas reservas. No forman parte de la tasa base, pero afectan al rendimiento real: mostramos el APY efectivo = APY base + incentivos, además de la tasa base aislada.',
      },
      {
        q: '¿Cuál es la mejor tasa de depósito de Aave hoy?',
        a: 'Cambia cada minuto según el activo, la red y los incentivos activos. Stablecoins como USDC y USDT en redes L2 (Base, Arbitrum, Polygon) suelen concentrar la mejor combinación de APY y liquidez. Ordena por APY efectivo en el panel en vivo en lugar de confiar en listas estáticas.',
      },
      {
        q: '¿Necesito conectar una wallet para consultar las tasas?',
        a: 'No. La consulta es de solo lectura y no requiere wallet ni registro. Solo conectas wallet en la app oficial de Aave cuando vas a depositar o pedir prestado.',
      },
      {
        q: '¿Aave v3 es seguro?',
        a: 'Aave V3 es uno de los protocolos más auditados de DeFi, pero ningún contrato inteligente está libre de riesgo. Los riesgos reales incluyen fallos de contrato, oráculos de precio, liquidaciones en caídas rápidas y la calidad del colateral de cada reserva. Diversifica y vigila tu health factor.',
      },
      {
        q: '¿Cómo tributan en España los intereses obtenidos en Aave?',
        a: 'Esto no es asesoramiento fiscal. En España las ganancias por transmisión de criptoactivos suelen integrarse en la base del ahorro del IRPF, mientras que ciertos rendimientos de lending pueden calificarse como rendimientos del capital mobiliario. Además existen obligaciones informativas específicas para criptomonedas en el extranjero (modelo 721) y para saldos en plataformas. Guarda el histórico de depósitos, retiradas y recompensas con fecha y valor en euros, y confirma la calificación con un asesor.',
      },
      {
        q: '¿Aave está afectada por MiCA?',
        a: 'MiCA regula a los emisores de stablecoins y a los proveedores de servicios de criptoactivos supervisados en España por la CNMV y el Banco de España. Aave es un protocolo descentralizado sin intermediario: lo que queda directamente bajo la norma son los stablecoins de sus reservas y los exchanges donde compras. En la práctica, eso condiciona sobre todo qué stablecoins siguen siendo cómodamente accesibles desde Europa.',
      },
      {
        q: '¿Puedo prestar euros en lugar de dólares?',
        a: 'Las reservas más líquidas de Aave están denominadas en stablecoins dólar (USDC, USDT, DAI). Existen stablecoins euro como EURC en algunas reservas, pero con mucha menos liquidez, tasas más volátiles y límites más bajos. Si razonas en euros, un depósito en USDC añade riesgo de tipo de cambio EUR/USD por encima del APY mostrado.',
      },
      {
        q: '¿Qué red conviene desde España para importes pequeños?',
        a: 'Para unos pocos miles de euros, las L2 (Base, Arbitrum, Optimism, Polygon) son claramente más adecuadas: las comisiones se cuentan en céntimos, frente a varios euros habituales en la red principal de Ethereum. La red principal solo compensa por profundidad de liquidez en posiciones grandes.',
      },
    ],
  },
  related: {
    ariaLabel: 'Páginas relacionadas',
    links: [
      { to: '/', label: 'Panel en vivo' },
      { to: '/defi-yield-tracker', label: 'DeFi Yield Tracker' },
      { to: '/asset/usdc', label: 'APY de USDC' },
    ],
  },
};

export default function AaveTasasApyES() {
  return <LocalizedRatesPage content={content} />;
}
