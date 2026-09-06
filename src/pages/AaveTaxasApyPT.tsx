import type { ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { trackFaqToggle, trackInternalLink } from '@/lib/pageAnalytics';
import { useTimeOnPage } from '@/hooks/useTimeOnPage';
import { useStripStaticHeadTags } from '@/components/seo/useStripStaticHeadTags';

const ANALYTICS_PAGE = 'pt-br/taxas-aave-apy';

const SITE_ORIGIN = 'https://aaveapy.com';
const CANONICAL = `${SITE_ORIGIN}/pt-br/taxas-aave-apy`;
const TITLE = 'Aave APY e taxas V3 — como funciona o protocolo Aave';
const DESCRIPTION =
  'Veja as taxas (APY) de depósito e empréstimo da Aave V3 em todas as redes, entenda como funciona o protocolo Aave e como os incentivos entram no rendimento real.';

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'O que é APY na Aave?',
    a: 'APY (Annual Percentage Yield) é a taxa anualizada já considerando a capitalização dos juros. Na Aave existem dois APYs por ativo: o APY de depósito (o que você recebe ao fornecer liquidez) e o APY de empréstimo (o que você paga ao tomar emprestado). Os dois variam continuamente conforme a utilização do pool.',
  },
  {
    q: 'Como funciona o protocolo Aave?',
    a: 'A Aave é um mercado de liquidez sem custódia. Usuários depositam ativos em pools e recebem aTokens que acumulam juros automaticamente. Outros usuários tomam empréstimos desses pools deixando garantia sobrecolateralizada. A taxa de juros é definida por uma curva que depende da utilização do pool: quanto maior a proporção emprestada, maiores as taxas de depósito e de empréstimo.',
  },
  {
    q: 'O que muda nas taxas da Aave V3 em relação à V2?',
    a: 'A V3 introduziu o modo isolamento (isolation mode), o modo de eficiência (E-Mode) para ativos correlacionados, limites de fornecimento e de empréstimo por reserva, e implantações em várias redes. Na prática isso significa curvas de juros por reserva e por rede — a taxa de USDC na Ethereum e na Base podem ser bem diferentes no mesmo momento.',
  },
  {
    q: 'Por que o APY da Aave muda o tempo todo?',
    a: 'Porque a taxa é função da utilização (total emprestado ÷ total depositado). Quando alguém faz um depósito grande, a utilização cai e as taxas caem junto. Quando há muita demanda por empréstimo, a utilização sobe e as taxas disparam acima do ponto ótimo da curva.',
  },
  {
    q: 'O que são Merit, Merkl e Brevis, e por que eles aparecem no APY?',
    a: 'São programas de recompensa em token que distribuem incentivos adicionais a quem deposita ou toma emprestado em determinadas reservas. Eles não fazem parte da taxa base da Aave, mas afetam o rendimento real. Por isso mostramos o APY efetivo = APY base + incentivos, além da taxa base isolada.',
  },
  {
    q: 'Qual é a melhor taxa de depósito da Aave hoje?',
    a: 'Muda a cada minuto e depende do ativo, da rede e dos incentivos ativos. Stablecoins como USDC e USDT em redes L2 (Base, Arbitrum, Polygon) costumam concentrar as melhores combinações de APY e liquidez. Use o painel ao vivo para ordenar por APY efetivo em vez de confiar em listas estáticas.',
  },
  {
    q: 'Qual é a diferença entre APR e APY na Aave?',
    a: 'APR é a taxa simples, sem capitalização. APY considera os juros compostos ao longo do ano. As recompensas de incentivo geralmente são divulgadas em APR; nós convertemos para APY quando faz sentido comparar com a taxa base, e o painel tem um seletor APR/APY para você escolher a visão.',
  },
  {
    q: 'Preciso conectar carteira para consultar as taxas?',
    a: 'Não. A consulta é somente leitura e não exige carteira nem cadastro. Você só conecta carteira no app oficial da Aave na hora de depositar ou tomar emprestado.',
  },
];

const RATE_DRIVERS = [
  {
    title: 'Utilização do pool',
    body: 'É o principal fator. A curva de juros tem um ponto ótimo (normalmente entre 80% e 90% de utilização); acima dele a inclinação fica muito mais agressiva para incentivar novos depósitos.',
  },
  {
    title: 'Parâmetros da reserva',
    body: 'Cada reserva tem taxa base, inclinação 1, inclinação 2 e fator de reserva próprios, definidos por governança. São eles que diferenciam a curva de USDC da curva de ETH.',
  },
  {
    title: 'Rede e liquidez local',
    body: 'A mesma reserva tem pools independentes por rede. Redes menores têm liquidez menor, então depósitos grandes movem a taxa muito mais.',
  },
  {
    title: 'Incentivos externos',
    body: 'Merit, Merkl e Brevis somam APR sobre a taxa base. Um pool com APY base modesto pode ter o melhor rendimento efetivo do mercado por causa dos incentivos.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const pageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: TITLE,
  description: DESCRIPTION,
  url: CANONICAL,
  inLanguage: 'pt-BR',
  isPartOf: { '@type': 'WebSite', name: 'AaveAPY', url: `${SITE_ORIGIN}/` },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_ORIGIN}/pt-br` },
      { '@type': 'ListItem', position: 2, name: 'Taxas e APY da Aave', item: CANONICAL },
    ],
  },
};

type TrackedLinkProps = ComponentProps<typeof Link> & { trackLabel: string };

const TrackedLink = ({ trackLabel, onClick, ...props }: TrackedLinkProps) => (
  <Link
    {...props}
    onClick={(e) => {
      trackInternalLink(ANALYTICS_PAGE, trackLabel, String(props.to));
      onClick?.(e);
    }}
  />
);

const AaveTaxasApyPT = () => {
  useTimeOnPage(ANALYTICS_PAGE);

  return (
  <>
    <Helmet>
      <html lang="pt-BR" />
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <link rel="canonical" href={CANONICAL} />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={CANONICAL} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="AaveAPY" />
      <meta property="og:image" content="https://aaveapy.com/og-image-1200x630.jpg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Taxas e APY do Aave V3 em tempo real" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={TITLE} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <meta name="twitter:image" content="https://aaveapy.com/og-image-1200x630.jpg" />
      <meta name="twitter:image:alt" content="Taxas e APY do Aave V3 em tempo real" />
      <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
    </Helmet>

    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
        <nav className="mb-6 text-sm text-muted-foreground" aria-label="Trilha de navegação">
          <TrackedLink trackLabel="breadcrumb_inicio" to="/pt-br" className="hover:text-foreground transition-colors">
            Início
          </TrackedLink>
          <span className="mx-2">/</span>
          <span className="text-foreground">Taxas e APY da Aave</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Taxas e APY da Aave V3: como funciona o protocolo
          </h1>
          <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
            Guia direto sobre as taxas da Aave: o que é APY, como o protocolo Aave define os juros de
            depósito e de empréstimo, o que muda na V3 e como os incentivos Merit, Merkl e Brevis
            entram no rendimento real. Os números ao vivo estão no painel, atualizados a cada minuto.
          </p>
        </header>

        <TrackedLink
          trackLabel="cta_painel_ao_vivo"
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
        >
          Ver as taxas da Aave ao vivo
          <ArrowRight className="h-4 w-4" aria-hidden />
        </TrackedLink>

        <section aria-labelledby="como-funciona" className="mt-10">
          <h2 id="como-funciona" className="text-xl font-semibold mb-3">
            Como funciona o protocolo Aave
          </h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              A Aave é um mercado de liquidez sem custódia: ninguém guarda seus fundos por você, e
              todas as regras estão em contratos inteligentes públicos. Quem deposita um ativo recebe
              um aToken correspondente, que acumula juros continuamente no próprio saldo. Quem toma
              emprestado precisa deixar garantia de valor maior do que a dívida (posição
              sobrecolateralizada) e paga juros ao pool.
            </p>
            <p>
              A taxa de juros não é fixada por ninguém — ela sai de uma curva que depende da{' '}
              <strong className="text-foreground">utilização</strong> do pool, ou seja, quanto do
              total depositado está emprestado. Perto do ponto ótimo da curva, as taxas sobem devagar.
              Acima dele, sobem rápido para atrair novos depósitos e proteger a liquidez de saque.
            </p>
            <p>
              Se a garantia de um tomador cair abaixo do limite (health factor menor que 1), a posição
              fica sujeita a liquidação: parte da dívida é paga por terceiros em troca de um bônus
              sobre a garantia.
            </p>
          </div>
        </section>

        <section aria-labelledby="v3" className="mt-10">
          <h2 id="v3" className="text-xl font-semibold mb-3">
            O que muda nas taxas da Aave V3
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            A V3 é multichain por natureza: a mesma reserva existe em várias redes, com pools e taxas
            independentes. Além disso trouxe E-Mode (mais poder de empréstimo entre ativos
            correlacionados, como ETH e LSTs), isolation mode (ativos novos com limite de dívida
            próprio) e limites de fornecimento/empréstimo por reserva. Na prática, comparar apenas
            "a taxa da Aave" deixou de fazer sentido — é preciso comparar reserva por reserva, rede
            por rede.
          </p>
        </section>

        <section aria-labelledby="fatores" className="mt-10">
          <h2 id="fatores" className="text-xl font-semibold mb-4">
            O que determina o APY de cada reserva
          </h2>
          <ul className="space-y-4">
            {RATE_DRIVERS.map((d) => (
              <li key={d.title} className="rounded-xl border border-border/60 bg-card p-4">
                <h3 className="text-base font-semibold">{d.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{d.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="como-usar" className="mt-10">
          <h2 id="como-usar" className="text-xl font-semibold mb-3">
            Como comparar taxas no AaveAPY
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground leading-relaxed">
            <li>
              Abra o{' '}
              <TrackedLink trackLabel="inline_painel_ao_vivo" to="/" className="text-secondary hover:underline">
                painel ao vivo
              </TrackedLink>{' '}
              e ordene pela coluna de APY de depósito ou de empréstimo.
            </li>
            <li>
              Use o seletor APR/APY para alinhar a comparação com a forma como cada programa divulga
              suas recompensas.
            </li>
            <li>
              Filtre por rede em{' '}
              <TrackedLink trackLabel="paginas_de_rede" to="/chain/ethereum" className="text-secondary hover:underline">
                páginas de rede
              </TrackedLink>{' '}
              ou por ativo em{' '}
              <TrackedLink trackLabel="paginas_de_ativo" to="/asset/usdc" className="text-secondary hover:underline">
                páginas de ativo
              </TrackedLink>
              .
            </li>
            <li>
              Antes de confirmar, use o simulador: informe o valor que pretende depositar ou tomar
              emprestado e veja o quanto a sua própria posição move a curva.
            </li>
          </ol>
        </section>

        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className="text-2xl font-bold tracking-tight mb-4">
            Perguntas frequentes
          </h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-border/60 bg-card p-5"
                onToggle={(e) => trackFaqToggle(ANALYTICS_PAGE, f.q, e.currentTarget.open)}
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-base font-semibold text-foreground">
                  <span>{f.q}</span>
                  <span className="text-muted-foreground transition group-open:rotate-45 text-xl leading-none select-none">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <nav aria-label="Páginas relacionadas" className="mt-12 text-sm text-muted-foreground">
          <TrackedLink trackLabel="related_aaveapy_brasil" to="/pt-br" className="text-secondary hover:underline">
            AaveAPY Brasil
          </TrackedLink>
          {' · '}
          <TrackedLink trackLabel="related_painel_ao_vivo" to="/" className="text-secondary hover:underline">
            Painel ao vivo
          </TrackedLink>
          {' · '}
          <TrackedLink trackLabel="related_defi_yield_tracker" to="/defi-yield-tracker" className="text-secondary hover:underline">
            DeFi Yield Tracker
          </TrackedLink>
        </nav>
      </div>
    </main>
  </>
  );
};

export default AaveTaxasApyPT;
