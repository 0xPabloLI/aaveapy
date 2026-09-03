import { LocalizedRatesPage, type RatesPageContent } from '@/components/seo/LocalizedRatesPage';

const content: RatesPageContent = {
  path: '/id/apy-aave',
  lang: 'id',
  ogLocale: 'id_ID',
  title: 'APY Adalah? Bunga dan APY Aave V3 secara real-time',
  description:
    'APY adalah imbal hasil tahunan dengan bunga majemuk. Pelajari cara kerja protokol Aave, bandingkan bunga deposit dan pinjam Aave V3 di semua jaringan, plus efek insentif pada hasil nyata.',
  h1: 'APY adalah apa? Panduan bunga dan APY Aave V3',
  intro:
    'Panduan ringkas soal bunga Aave: apa itu APY, bagaimana protokol menentukan bunga deposit dan pinjaman, apa yang berubah di V3, serta bagaimana Merit, Merkl, dan Brevis menambah imbal hasil nyata. Angka live tersedia di dasbor dan diperbarui setiap menit.',
  cta: { label: 'Lihat bunga Aave secara live', to: '/' },
  breadcrumb: {
    ariaLabel: 'Navigasi remah roti',
    home: { label: 'Beranda', to: '/' },
    current: 'Bunga dan APY Aave',
  },
  sections: [
    {
      id: 'apy-adalah',
      h2: 'APY adalah: definisi singkat',
      paragraphs: [
        'APY (Annual Percentage Yield) adalah tingkat imbal hasil tahunan yang sudah memperhitungkan bunga majemuk. Berbeda dengan APR yang merupakan bunga sederhana tanpa penggandaan, APY menunjukkan hasil sebenarnya bila bunga terus ditambahkan ke pokok sepanjang tahun.',
        'Di Aave setiap aset punya dua APY: APY deposit (yang Anda terima saat menyediakan likuiditas) dan APY pinjam (yang Anda bayar saat meminjam). Keduanya bergerak terus mengikuti utilisasi pool.',
      ],
    },
    {
      id: 'cara-kerja',
      h2: 'Cara kerja protokol Aave',
      paragraphs: [
        'Aave adalah pasar likuiditas non-kustodial: tidak ada pihak yang menyimpan dana Anda, semua aturan ada di smart contract publik. Yang deposit menerima aToken yang saldonya bertambah otomatis karena bunga. Yang meminjam wajib menaruh jaminan melebihi nilai utang (overcollateralized) dan membayar bunga ke pool.',
        'Bunga tidak ditetapkan siapa pun: ia lahir dari kurva yang bergantung pada utilisasi pool, yaitu porsi dana deposit yang sedang dipinjam. Dekat titik optimal bunga naik pelan; di atasnya bunga melonjak agar deposit baru masuk dan likuiditas penarikan tetap aman.',
        'Jika jaminan peminjam turun di bawah batas (health factor di bawah 1), posisi bisa dilikuidasi: sebagian utang dilunasi pihak lain dengan imbalan bonus atas jaminan.',
      ],
    },
    {
      id: 'v3',
      h2: 'Apa yang berubah pada Aave V3',
      paragraphs: [
        'V3 dirancang multichain: reserve yang sama hadir di banyak jaringan dengan pool dan bunga terpisah. V3 juga membawa E-Mode (daya pinjam lebih besar untuk aset berkorelasi seperti ETH dan LST), isolation mode (aset baru dengan batas utang sendiri), serta supply cap dan borrow cap per reserve. Jadi membandingkan "bunga Aave" secara umum sudah tidak relevan — bandingkan per reserve dan per jaringan.',
      ],
    },
    {
      id: 'contoh-hitung',
      h2: 'Contoh hitungan: Rp 50 juta dalam USDC di Base',
      paragraphs: [
        'Misalnya Anda menaruh dana setara Rp 50 juta (sekitar 3.000 USDC) di jaringan Base. Bila APY deposit yang tampil 4,2 %, hasil kotor setahun sekitar Rp 2,1 juta atau kira-kira Rp 175 ribu per bulan — dengan asumsi bunganya diam di angka itu, yang pada praktiknya tidak pernah terjadi.',
        'Tambahkan insentif Merit sebesar 1,8 % APR pada reserve yang sama, maka hasil efektifnya naik ke sekitar 6 %, atau kurang lebih Rp 3 juta setahun. Selisih inilah yang ditampilkan dasbor sebagai perbedaan antara bunga dasar dan APY efektif.',
        'Di sisi pinjaman: jaminan ETH senilai Rp 50 juta dengan pinjaman USDC senilai Rp 20 juta pada APY pinjam 5,5 % berbiaya sekitar Rp 1,1 juta setahun. Health factor tetap aman selama harga ETH tidak anjlok tajam; di bawah 1, posisi bisa dilikuidasi. Biaya gas di L2 seperti Base hanya ratusan rupiah per transaksi sehingga tidak berpengaruh, berbeda dengan Ethereum mainnet yang bisa memakan puluhan hingga ratusan ribu rupiah untuk nominal kecil.',
      ],
    },
  ],
  drivers: {
    id: 'faktor',
    h2: 'Faktor penentu APY tiap reserve',
    items: [
      {
        title: 'Utilisasi pool',
        body: 'Faktor utama. Kurva bunga punya titik optimal (umumnya 80 %–90 % utilisasi); di atas titik itu kemiringannya jauh lebih agresif untuk menarik deposit baru.',
      },
      {
        title: 'Parameter reserve',
        body: 'Setiap reserve punya base rate, slope 1, slope 2, dan reserve factor sendiri yang ditetapkan governance. Itulah pembeda kurva USDC dengan kurva ETH.',
      },
      {
        title: 'Jaringan dan likuiditas lokal',
        body: 'Reserve yang sama punya pool terpisah di tiap jaringan. Jaringan kecil likuiditasnya tipis, sehingga deposit besar menggeser bunga jauh lebih kuat.',
      },
      {
        title: 'Insentif eksternal',
        body: 'Merit, Merkl, dan Brevis menambah APR di atas bunga dasar. Pool dengan APY dasar biasa saja bisa memberi hasil efektif terbaik berkat insentif.',
      },
    ],
  },
  howTo: {
    id: 'cara-membandingkan',
    h2: 'Cara membandingkan bunga di AaveAPY',
    steps: [
      'Buka dasbor live lalu urutkan berdasarkan kolom APY deposit atau APY pinjam.',
      'Gunakan pemilih APR/APY agar perbandingan sejalan dengan cara tiap program menampilkan rewardnya.',
      'Saring per jaringan lewat halaman chain, atau per aset lewat halaman aset.',
      'Sebelum memutuskan, pakai simulator: masukkan nominal yang ingin Anda deposit atau pinjam dan lihat seberapa besar posisi Anda menggeser kurva.',
    ],
  },
  faq: {
    h2: 'Pertanyaan yang sering diajukan',
    items: [
      {
        q: 'APY adalah apa dalam kripto?',
        a: 'APY adalah imbal hasil tahunan yang sudah memasukkan efek bunga majemuk. Dalam kripto, APY dipakai untuk menggambarkan hasil staking, lending, atau farming selama setahun bila bunga terus digulung kembali ke pokok.',
      },
      {
        q: 'Apa beda APR dan APY?',
        a: 'APR adalah bunga sederhana tanpa penggandaan, APY memperhitungkan bunga majemuk sepanjang tahun. Program insentif biasanya mengumumkan APR; kami mengonversinya ke APY saat perlu dibandingkan dengan bunga dasar, dan dasbor menyediakan pemilih APR/APY.',
      },
      {
        q: 'Bagaimana cara kerja Aave lending?',
        a: 'Pengguna mendepositkan aset ke pool dan menerima aToken yang otomatis mengakumulasi bunga. Pengguna lain meminjam dari pool tersebut dengan jaminan overcollateralized. Bunganya mengikuti kurva yang bergantung pada utilisasi pool.',
      },
      {
        q: 'Kenapa APY Aave berubah terus?',
        a: 'Karena bunga adalah fungsi dari utilisasi (total dipinjam ÷ total didepositkan). Deposit besar menurunkan utilisasi sehingga bunga turun; permintaan pinjaman tinggi menaikkan utilisasi dan bunga melonjak melewati titik optimal.',
      },
      {
        q: 'Apa itu Merit, Merkl, dan Brevis?',
        a: 'Program reward token yang membagikan insentif tambahan bagi pengguna yang deposit atau meminjam di reserve tertentu. Insentif ini bukan bagian dari bunga dasar Aave, tetapi memengaruhi hasil nyata. Karena itu kami menampilkan APY efektif = APY dasar + insentif, di samping bunga dasar.',
      },
      {
        q: 'Berapa APY deposit Aave terbaik saat ini?',
        a: 'Berubah tiap menit tergantung aset, jaringan, dan insentif yang aktif. Stablecoin seperti USDC dan USDT di jaringan L2 (Base, Arbitrum, Polygon) sering memberi kombinasi APY dan likuiditas terbaik. Urutkan berdasarkan APY efektif di dasbor live, jangan mengandalkan daftar statis.',
      },
      {
        q: 'Perlu connect wallet untuk melihat bunga?',
        a: 'Tidak. Semua data hanya untuk dibaca, tanpa wallet dan tanpa registrasi. Wallet baru diperlukan di aplikasi resmi Aave ketika Anda benar-benar deposit atau meminjam.',
      },
      {
        q: 'Apakah Aave aman dipakai dari Indonesia?',
        a: 'Aave adalah protokol terdesentralisasi yang bisa diakses dari dompet EVM mana pun, dan bunganya sama untuk semua pengguna karena ditentukan pool dan jaringan, bukan negara. Tetap perhatikan risiko smart contract, volatilitas jaminan, serta aturan pajak dan regulasi aset kripto setempat.',
      },
      {
        q: 'Bagaimana pajak hasil lending kripto di Indonesia?',
        a: 'Ini bukan nasihat pajak. Di Indonesia transaksi aset kripto lewat pedagang fisik aset kripto terdaftar dikenai PPh final dan PPN dengan tarif kecil per transaksi, sedangkan perlakuan atas imbal hasil dari protokol DeFi seperti Aave belum diatur sedetail itu dan umumnya perlu dilaporkan sebagai penghasilan lain dalam SPT Tahunan. Simpan catatan deposit, penarikan, dan reward beserta nilai rupiahnya, lalu konsultasikan dengan konsultan pajak.',
      },
      {
        q: 'Bisakah deposit langsung dari rupiah?',
        a: 'Tidak langsung. Alurnya biasanya: beli USDC atau USDT di exchange lokal terdaftar Bappebti memakai rupiah, tarik ke wallet EVM pribadi di jaringan murah seperti Base atau Polygon, baru deposit ke Aave. Perhatikan biaya penarikan exchange dan pastikan jaringan penarikan sama dengan jaringan yang Anda pakai di Aave, karena salah jaringan berisiko kehilangan dana.',
      },
      {
        q: 'Apakah ada stablecoin rupiah di Aave?',
        a: 'Reserve Aave yang likuid hampir semuanya stablecoin dolar (USDC, USDT, DAI); stablecoin rupiah belum tersedia sebagai reserve. Artinya, saat Anda menghitung hasil dalam rupiah, ada risiko kurs USD/IDR di atas APY yang ditampilkan — kurs bisa menambah atau mengurangi hasil akhir.',
      },
      {
        q: 'Berapa modal minimum yang masuk akal?',
        a: 'Tidak ada minimum di protokol, tetapi biaya jaringan menentukan kelayakannya. Di L2 seperti Base atau Polygon, deposit beberapa juta rupiah sudah masuk akal karena gas hanya ratusan rupiah. Di Ethereum mainnet, biaya transaksi bisa menghabiskan hasil beberapa bulan untuk nominal kecil, jadi sebaiknya dipakai untuk posisi besar saja.',
      },
    ],
  },
  related: {
    ariaLabel: 'Halaman terkait',
    links: [
      { to: '/', label: 'Dasbor live' },
      { to: '/defi-yield-tracker', label: 'DeFi Yield Tracker' },
      { to: '/asset/usdt', label: 'APY USDT' },
    ],
  },
};

export default function AaveApyID() {
  return <LocalizedRatesPage content={content} />;
}
