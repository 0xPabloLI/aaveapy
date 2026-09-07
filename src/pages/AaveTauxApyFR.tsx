import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

const content: RatesPageContent = {
  path: '/fr/taux-aave-apy',
  lang: 'fr',
  languageSwitcherLabel: 'Autres langues',
  ogLocale: 'fr_FR',
  title: 'Taux et APY Aave V3 — rendement DeFi en temps réel',
  description:
    "Comparez les taux (APY) de dépôt et d'emprunt d'Aave V3 sur toutes les blockchains, comprenez le fonctionnement du protocole Aave et l'impact des incitations sur le rendement DeFi réel.",
  h1: 'Taux et APY Aave V3 : comprendre le rendement DeFi',
  intro:
    "Guide clair sur les taux d'Aave : ce qu'est l'APY, comment le protocole fixe les intérêts de dépôt et d'emprunt, ce que change la V3 et comment les programmes Merit, Merkl et Brevis s'ajoutent au rendement réel. Les chiffres en direct sont dans le tableau de bord, actualisés chaque minute.",
  cta: { label: 'Voir les taux Aave en direct', to: '/' },
  breadcrumb: {
    ariaLabel: "Fil d'Ariane",
    home: { label: 'Accueil', to: '/fr' },
    current: 'Taux et APY Aave',
  },
  sections: [
    {
      id: 'fonctionnement',
      h2: 'Comment fonctionne le protocole Aave',
      paragraphs: [
        "Aave est un marché de liquidité non custodial : personne ne détient vos fonds à votre place et toutes les règles vivent dans des contrats intelligents publics. Qui dépose un actif reçoit un aToken qui accumule les intérêts directement dans son solde. Qui emprunte doit déposer une garantie supérieure à sa dette (position surcollatéralisée) et paie des intérêts au pool.",
        "Le taux n'est fixé par personne : il découle d'une courbe qui dépend du taux d'utilisation du pool, c'est-à-dire la part des dépôts effectivement empruntée. Près du point optimal, les taux montent lentement ; au-delà, ils grimpent fortement pour attirer de nouveaux dépôts et protéger la liquidité de retrait.",
        "Si la garantie d'un emprunteur passe sous le seuil (health factor inférieur à 1), la position devient liquidable : une partie de la dette est remboursée par un tiers en échange d'un bonus sur la garantie.",
      ],
    },
    {
      id: 'v3',
      h2: 'Ce que change Aave V3 sur les taux',
      paragraphs: [
        "La V3 est multichaîne par nature : la même réserve existe sur plusieurs réseaux avec des pools et des taux indépendants. Elle apporte aussi l'E-Mode (pouvoir d'emprunt renforcé entre actifs corrélés comme ETH et les LST), l'isolation mode (actifs récents avec plafond de dette dédié) et des plafonds de dépôt et d'emprunt par réserve. Comparer « le taux d'Aave » globalement n'a donc plus de sens : il faut comparer réserve par réserve et réseau par réseau.",
      ],
    },
    {
      id: 'exemple',
      h2: 'Exemple chiffré : 10 000 € en USDC sur Base',
      paragraphs: [
        "Prenons un dépôt de 10 000 € convertis en USDC sur Base. Si l'APY de dépôt affiché est de 4,2 %, le rendement brut sur un an est d'environ 420 €, soit près de 35 € par mois — à condition que le taux reste stable, ce qui n'arrive jamais vraiment.",
        "Ajoutez maintenant une incitation Merit de 1,8 % d'APR sur la même réserve : le rendement effectif passe à environ 6 %, soit à peu près 600 € sur l'année. C'est exactement l'écart que le tableau de bord affiche entre « taux de base » et « APY effectif ».",
        "Côté emprunt, si vous déposez 10 000 € d'ETH en garantie et empruntez 4 000 € d'USDC à 5,5 % d'APY, le coût annuel est d'environ 220 €. Votre health factor reste confortable tant que l'ETH ne chute pas brutalement ; en dessous de 1, la position devient liquidable. Les frais de gaz sur un L2 comme Base restent de l'ordre de quelques centimes par transaction, donc négligeables face à ces montants — ce ne serait pas le cas sur le mainnet Ethereum pour un petit dépôt.",
      ],
    },
    {
      id: 'rendement-defi',
      h2: 'DeFi rendement : où trouver le meilleur rendement stablecoin',
      paragraphs: [
        "Quand on parle de rendement DeFi, on compare en réalité trois choses différentes : le taux de base payé par les emprunteurs, les incitations distribuées en tokens, et le risque propre à chaque réserve. Sur Aave, seul le premier est garanti par la courbe du protocole ; les deux autres varient selon les programmes en cours et la qualité de l'actif déposé.",
        "Pour un rendement stablecoin, la comparaison utile se fait réserve par réserve : USDC sur Base, USDT sur Arbitrum, USDC sur Ethereum n'ont ni la même utilisation, ni la même profondeur, ni les mêmes incitations. Un écart de 2 points d'APY entre deux réseaux est courant et se referme en quelques heures dès que la liquidité se déplace.",
        "Notre règle de lecture : partez de l'APY effectif (base + incitations), vérifiez la taille du pool pour savoir si votre montant déplacera la courbe, puis regardez si l'incitation a une date de fin. Un rendement à 9 % qui s'arrête dans dix jours ne vaut pas un rendement à 5 % stable sur six mois.",
      ],
    },
    {
      id: 'aave-lending-v3',
      h2: 'Aave lending et Aave V3 : prêter sans intermédiaire',
      paragraphs: [
        "Le lending sur Aave V3 ne ressemble pas à un compte à terme : il n'y a ni durée bloquée, ni contrepartie unique. Vous déposez, vous recevez un aToken, vous retirez quand vous voulez tant que le pool dispose de liquidité disponible. C'est cette liquidité disponible — et non un engagement contractuel — qui conditionne le retrait immédiat.",
        "Les risques à connaître restent le risque de contrat intelligent, le risque de dépeg du stablecoin déposé, et le risque d'illiquidité temporaire quand l'utilisation approche des 100 %. Le tableau de bord affiche justement l'utilisation de chaque réserve pour repérer ces situations avant de déposer.",
      ],
    },
  ],
  drivers: {
    id: 'facteurs',
    h2: "Ce qui détermine l'APY de chaque réserve",
    items: [
      {
        title: "Taux d'utilisation du pool",
        body: "C'est le facteur principal. La courbe a un point optimal (souvent entre 80 % et 90 % d'utilisation) ; au-delà, la pente devient bien plus agressive pour attirer de nouveaux dépôts.",
      },
      {
        title: 'Paramètres de la réserve',
        body: "Chaque réserve a son taux de base, sa pente 1, sa pente 2 et son facteur de réserve, définis par la gouvernance. C'est ce qui différencie la courbe de l'USDC de celle de l'ETH.",
      },
      {
        title: 'Réseau et liquidité locale',
        body: "La même réserve dispose de pools indépendants par réseau. Sur les réseaux plus petits, la liquidité est faible : un gros dépôt déplace beaucoup plus le taux.",
      },
      {
        title: 'Incitations externes',
        body: "Merit, Merkl et Brevis ajoutent un APR par-dessus le taux de base. Un pool au taux modeste peut offrir le meilleur rendement effectif du marché grâce aux incitations.",
      },
    ],
  },
  howTo: {
    id: 'comment-comparer',
    h2: 'Comment comparer les taux sur AaveAPY',
    steps: [
      "Ouvrez le tableau de bord en direct et triez par colonne APY de dépôt ou d'emprunt.",
      "Utilisez le sélecteur APR/APY pour aligner la comparaison sur la façon dont chaque programme publie ses récompenses.",
      "Filtrez par réseau via les pages de blockchain, ou par actif via les pages d'actif.",
      "Avant de valider, utilisez le simulateur : saisissez le montant à déposer ou à emprunter et voyez de combien votre propre position déplace la courbe.",
    ],
  },
  faq: {
    h2: 'Questions fréquentes',
    items: [
      {
        q: "Qu'est-ce que l'APY sur Aave ?",
        a: "L'APY (Annual Percentage Yield) est le taux annualisé qui tient compte de la capitalisation des intérêts. Sur Aave, chaque actif a deux APY : celui de dépôt (ce que vous recevez en fournissant de la liquidité) et celui d'emprunt (ce que vous payez). Les deux varient en continu selon l'utilisation du pool.",
      },
      {
        q: 'Comment fonctionne le protocole Aave ?',
        a: "Aave est un marché de liquidité non custodial. Les utilisateurs déposent des actifs dans des pools et reçoivent des aTokens qui accumulent automatiquement les intérêts. D'autres empruntent contre une garantie surcollatéralisée. Le taux est fixé par une courbe qui dépend du taux d'utilisation du pool.",
      },
      {
        q: 'Quelle différence entre APR et APY sur Aave ?',
        a: "L'APR est un taux simple, sans capitalisation. L'APY intègre les intérêts composés sur un an. Les récompenses d'incitation sont souvent publiées en APR ; nous les convertissons en APY quand la comparaison avec le taux de base l'exige, et un sélecteur APR/APY vous laisse choisir la vue.",
      },
      {
        q: "Pourquoi l'APY d'Aave change-t-il en permanence ?",
        a: "Parce que le taux est une fonction de l'utilisation (total emprunté ÷ total déposé). Un gros dépôt fait baisser l'utilisation et donc les taux ; une forte demande d'emprunt fait grimper l'utilisation et les taux s'envolent au-dessus du point optimal.",
      },
      {
        q: 'Que sont Merit, Merkl et Brevis ?',
        a: "Ce sont des programmes de récompense en tokens qui distribuent des incitations supplémentaires aux déposants ou aux emprunteurs de certaines réserves. Ils ne font pas partie du taux de base d'Aave mais influencent le rendement réel : nous affichons l'APY effectif = APY de base + incitations, en plus du taux de base isolé.",
      },
      {
        q: 'Quel est le meilleur rendement DeFi sur Aave aujourd’hui ?',
        a: "Cela change chaque minute selon l'actif, le réseau et les incitations actives. Les stablecoins comme l'USDC et l'USDT sur les L2 (Base, Arbitrum, Polygon) concentrent souvent les meilleures combinaisons APY / liquidité. Triez par APY effectif dans le tableau de bord en direct plutôt que de vous fier à des listes statiques.",
      },
      {
        q: 'Faut-il connecter un portefeuille pour consulter les taux ?',
        a: "Non. La consultation est en lecture seule, sans portefeuille ni inscription. Vous ne connectez un portefeuille que dans l'application officielle Aave, au moment de déposer ou d'emprunter.",
      },
      {
        q: "Aave est-il disponible en France ?",
        a: "Aave est un protocole décentralisé accessible depuis n'importe quel portefeuille compatible EVM. Les taux affichés ici sont identiques pour tous les utilisateurs : ils dépendent du pool et du réseau, pas du pays. Vérifiez toujours votre cadre fiscal et réglementaire local avant d'investir.",
      },
      {
        q: 'Comment sont imposés les intérêts perçus sur Aave en France ?',
        a: "Ceci n'est pas un conseil fiscal. En pratique, l'administration française taxe les plus-values de cession d'actifs numériques au prélèvement forfaitaire unique de 30 % pour les particuliers, avec option possible pour le barème progressif. Le traitement des intérêts de lending DeFi reste discuté selon qu'ils sont requalifiés en revenus ou intégrés au calcul de plus-value lors de la conversion en euros. Conservez l'historique de vos dépôts, retraits et récompenses, déclarez vos comptes d'actifs numériques détenus à l'étranger (formulaire 3916-bis) et faites valider votre situation par un professionnel.",
      },
      {
        q: 'Aave est-il concerné par le règlement MiCA ?',
        a: "MiCA encadre les émetteurs de stablecoins et les prestataires de services sur crypto-actifs (PSAN/CASP enregistrés auprès de l'AMF). Aave est un protocole décentralisé sans intermédiaire : ce sont surtout les stablecoins listés dans ses réserves et les plateformes par lesquelles vous achetez vos crypto-actifs qui relèvent directement du texte. Concrètement, cela influence surtout quels stablecoins restent facilement accessibles depuis l'Europe.",
      },
      {
        q: 'Peut-on prêter des euros sur Aave plutôt que des dollars ?',
        a: "Les réserves les plus liquides d'Aave sont libellées en stablecoins dollar (USDC, USDT, DAI). Des stablecoins euro comme EURC existent sur certaines réserves, mais avec beaucoup moins de liquidité, donc des taux plus volatils et des plafonds plus bas. Si vous raisonnez en euros, gardez à l'esprit qu'un dépôt en USDC ajoute un risque de change EUR/USD par-dessus l'APY affiché.",
      },
      {
        q: 'Quel réseau choisir depuis la France pour de petits montants ?',
        a: "Pour quelques milliers d'euros, les L2 (Base, Arbitrum, Optimism, Polygon) sont nettement plus adaptés : les frais de transaction s'y comptent en centimes, contre parfois plusieurs euros sur le mainnet Ethereum. Le mainnet garde l'avantage de la profondeur de liquidité, utile seulement pour des positions importantes.",
      },
      {
        q: 'Quel est le meilleur rendement stablecoin en DeFi aujourd’hui ?',
        a: "Il n'y a pas de réponse figée : le classement change plusieurs fois par jour. En pratique, les réserves USDC et USDT sur les L2 offrent le meilleur compromis rendement / liquidité, et les incitations Merit ou Merkl font souvent la différence finale. Triez le tableau de bord par APY effectif et vérifiez la date de fin des programmes avant de vous décider.",
      },
      {
        q: 'Le rendement DeFi affiché est-il garanti ?',
        a: "Non. Le taux de base bouge à chaque bloc en fonction de l'utilisation du pool, et les incitations peuvent être réduites ou arrêtées par les programmes qui les financent. Les chiffres affichés sont une photo de l'instant, pas un rendement contractuel.",
      },
      {
        q: 'Aave V3 est-il différent d’Aave V2 pour un prêteur ?',
        a: "Oui, sur trois points concrets : la V3 sépare les marchés par réseau avec des paramètres propres, elle ajoute des plafonds de dépôt et d'emprunt par réserve, et elle introduit l'E-Mode et l'isolation mode. Pour un prêteur, cela signifie surtout que le même actif peut afficher des taux très différents selon le réseau choisi.",
      },
    ],
  },
  related: {
    ariaLabel: 'Pages liées',
    links: [
      { to: '/fr', label: 'AaveAPY France' },
      { to: '/', label: 'Tableau de bord en direct' },
      { to: '/defi-yield-tracker', label: 'DeFi Yield Tracker' },
    ],
  },
};

export default function AaveTauxApyFR() {
  return <LocalizedRatesPage content={content} />;
}
