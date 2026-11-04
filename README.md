# UAS Algoritma Trading: bot dry run Indodax (MA 50/100/200, 4 jam)

Atikah Nurfatkiyah · NIM 25110200025 · Finance & Investment · Algorithmic Trading · tugas individu

Repositori: https://github.com/kyaaa-system/uas-atikah-bot

Bot dry run untuk pasar kripto IDR Indodax yang berjalan di Vercel (**https://uas-atikah-bot.vercel.app**, data mentah: `/api/state`).
- **Data dan eksekusi:** candle 4 jam yang sudah tertutup dan order book dari API publik Indodax, tanpa API key. Order disimulasikan di bid/ask dengan menghabiskan level order book.
- **Penyimpanan:** state dan log di Upstash Redis (prefix `atikahbot:`).
- **Satu fungsi sinyal:** `decide()` di [lib/strategy.js](lib/strategy.js) dipakai oleh bot ([api/tick.js](api/tick.js)) **dan** backtest ([tools/backtest.mjs](tools/backtest.mjs)). Validasi candle (`validateBars`) dan pemotongan jendela candle (`cutWindow`) di [lib/indodax.js](lib/indodax.js) juga dipakai keduanya.

## 1. Strategi (dibekukan saat freeze)

Strategi UTS (saham Kompas100 harian, MA 50/100/200) dipindahkan ke kripto IDR. Semua keputusan diambil di close candle 4 jam yang sudah tertutup. Parameter ada di `PARAMS` dalam `lib/strategy.js`.

| Aturan | Isi |
|---|---|
| Indikator | SMA 50, SMA 100 (= round(√(50 × 200)), sama dengan UTS), SMA 200 dari close, dalam **bar 4 jam** |
| **Beli** | close > MA50 > MA100 > MA200 **dan** kondisi itu baru berubah dari salah menjadi benar (bar sebelumnya belum selaras, MA200 bar sebelumnya sudah ada) |
| **Jual** | close < MA200 (diperiksa lebih dulu) **atau** MA50 < MA100 |
| Ukuran posisi | 15% ekuitas per posisi, maks 5 posisi, satu posisi per pasangan |
| Bila kandidat > slot kosong | urutan peringkat likuiditas universe (bagian 2), bukan dipilih menurut hasil |
| Daily loss limit | ekuitas ≤ 97% ekuitas awal hari WIB → tidak membuka posisi baru sampai 00.00 WIB berikutnya. Exit tetap berjalan. |
| Kill switch | flag `atikahbot:kill = 1` di Redis (lewat `/api/kill?aktif=1`) atau env `KILL_SWITCH=1`. Tidak membuka posisi baru, exit tetap berjalan, tercatat di log `kill`. |
| Validasi sebelum beli | candle terakhir ≤ 2× timeframe, tidak ada candle hilang di 201 bar, harga tidak nol, volume candle terakhir tidak nol, order book tidak kosong, spread bid–ask ≤ 2%. Sinyal beli yang ditolak tetap dicatat di log `signals` (`valid: false` + alasannya), dan semua pasangan yang tidak valid dicatat tiap candle di log `notes`. |

### Perubahan dari versi UTS (semua sebelum freeze)
1. **Pasar:** saham Kompas100 → 8 pasangan kripto IDR Indodax. Lot 100, fraksi harga, dan aturan ARA/ARB BEI diganti aturan Indodax: kuantitas pecahan 1e-8, minimum order Rp25.000, fill menghabiskan order book.
2. **Timeframe harian → 4 jam.** Panjang MA tetap 50/100/200 **bar**. Rencana awal 1 jam; keputusan pindah ke 4 jam diambil **setelah** membandingkan backtest dengan aturan yang sama (in-sample, lihat bagian 4). Di 1 jam, sinyal terlalu sering (746 trade dalam 3 tahun) sehingga biaya memakan 92% laba kotor.
3. **Ukuran posisi:** 10% × maks 10 posisi → 15% × maks 5 posisi, karena universe hanya 8 pasangan.
4. **Eksekusi:** UTS memakai open hari berikutnya. Bot mengeksekusi di order book live sesudah candle tutup (beli di ask, jual di bid). Backtest memakai open bar berikutnya ± setengah spread ± slippage terukur.
5. **Batas likuiditas UTS** (order ≤ 5% rata-rata nilai transaksi 20 hari) diganti dengan fill di order book nyata (slippage terukur) dan batas spread 2%.
6. **Tambahan wajib UAS:** daily loss limit 3% per hari WIB, kill switch, validasi data, idempotency per candle.

## 2. Universe (8 pasangan)

`BTCIDR, ETHIDR, XRPIDR, DOGEIDR, TRXIDR, VELOIDR, ADAIDR, BNBIDR` (urutan = peringkat likuiditas)

**Kriteria.** Diukur pada **awal periode backtest**, bukan hari ini:
- rata-rata nilai transaksi harian (IDR) **3 Agustus – 31 Oktober 2023**, tertinggi;
- sudah tercatat ≥ 1 tahun;
- bukan stablecoin, emas, atau saham tokenisasi.

| Peringkat Okt 2023 | Pasangan | Nilai transaksi (miliar Rp/hari) | Status sekarang |
|---|---|---|---|
| 1 | BTC | 10,6 | aktif |
| 2 | ETH | 3,75 | aktif |
| 3 | XRP | 3,58 | aktif |
| 4 | DOGE | 1,74 | aktif |
| 5 | TRX | 1,09 | aktif |
| 6 | VRA | 1,02 | sudah delisting |
| 7 | LOOM | 0,91 | sudah delisting |
| 8 | VELO | 0,86 | aktif |
| 9 | ADA | 0,76 | aktif |
| 10 | BNB | 0,74 | aktif |

**Survivorship.** VRA dan LOOM sudah delisting sehingga tidak bisa diperdagangkan. Universe memakai 8 sisanya dengan urutan yang sama, tanpa pengganti yang dipilih dengan melihat hari ini. Ini dicatat sebagai keterbatasan.

**VELO** spreadnya ±3% (> 2%). Bot menolak entry VELO selama spread > 2%. Backtest memakai aturan yang sama dengan median spread terukur, sehingga VELO juga tidak pernah dibeli di backtest (92 sinyal beli ditolak validasi).

## 3. Biaya dan eksekusi

| Hal | Nilai dipakai | Sumber (diakses 2 Nov 2026) |
|---|---|---|
| Fee taker `/api/pairs` | 0,20% (`trade_fee_percent_taker`) | https://indodax.com/api/pairs (salinan: `data/sumber_biaya/api_pairs_2026-11-02.json`) |
| Fee taker all-in halaman resmi (pasar IDR, mode Pro, berlaku sejak 1 Okt 2026) | **beli 0,20555%** (service 0,20% + pajak 0% + CFX 0,00555%) · **jual 0,41555%** (service 0,20% + pajak 0,21% + CFX 0,00555%). Lebih mahal dari 0,20%, jadi **ini yang dipakai**. | https://help.indodax.com/hc/id/articles/4416646599705-Rincian-Biaya-Transaksi-di-INDODAX (tabel berupa gambar, salinan: `data/sumber_biaya/indodax_biaya_trading_2026-11-02.png`) |
| Minimum order | Rp25.000 (lebih ketat dari `trade_min_base_currency` Rp10.000) | /api/pairs + ketentuan mode Pro |
| Kuantitas | dibulatkan ke bawah 1e-8 | /api/pairs |
| Fill bot | beli menghabiskan level **ask**, jual menghabiskan level **bid** (harga rata-rata). Tidak pernah memakai mid atau close. | /api/depth |
| Fill backtest | open bar berikutnya × (1 ± setengah spread ± slippage), median **terukur** per pasangan dari snapshot order book (`data/spread_median.json`, ukuran order Rp15 jt) | snapshot 2 Nov – 4 Nov 2026 01.25 UTC |
| Penilaian ekuitas | posisi terbuka dinilai di best bid; ekuitas harian = panggilan pertama sesudah 00.00 WIB | — |

## 4. Backtest (≥ 3 tahun, data asli Indodax)

```
node tools/fetch_history.mjs 240 2022-02-01      # tarik candle 4 jam mundur (laptop, berurutan, < 3 request/detik)
node tools/spread_stats.mjs 15000000 2026-11-04T01:25   # median spread & slippage dari snapshot, batas data 4 Nov 01.25 UTC (08.25 WIB)
node tools/backtest.mjs 2023-11-01 --trades data/bt_trades.csv --sinyal data/bt_sinyal.csv --ekuitas data/bt_ekuitas.csv --ringkasan public/backtest_ringkasan.json
```

**Hasil 1 Nov 2023 – 4 Nov 2026 (3,0 tahun)**, modal Rp100 jt:

| Metrik | Bot MA 50/100/200 4 jam | Beli & tahan BTC/IDR |
|---|---|---|
| Return total | +78,8% | +155,9% |
| CAGR | 21,31% | – |
| MDD | −24,1% | −49,4% |
| Trade | 174 | – |
| Win rate | 29,3% | – |
| Profit factor | 1,52 | – |
| Rata-rata untung / rugi | +21,7% / −4,7% | – |
| Porsi biaya (Σ biaya ÷ hasil sebelum biaya) | 32,1% | – |

Per tahun: 2023 (Nov–Des) +19,5% · 2024 +71,9% · 2025 −1,0% · 2026 −12,2%. Per pasangan: `data/backtest_2023-11.txt`.

**Catatan slippage.** Angka di `data/spread_median.json` adalah median dari 31 snapshot per pasangan (ukuran order Rp15 jt). Median slippage banyak yang mendekati 0 karena level harga terbaik sering cukup dalam, tetapi kuartil atasnya lebih besar (mis. TRX beli 0,07%, ADA jual 0,15%). Backtest memakai median, jadi bisa sedikit lebih optimistis dibanding fill nyata di saat order book tipis. Selisihnya diukur di refleksi.

**Perbandingan timeframe** (aturan dan mesin sama, `data/banding_timeframe.txt`; dijalankan 3 Nov dengan median spread saat itu, baris 4 jam di sini sudah angka final):

| Timeframe | CAGR | MDD | PF | Trade | Porsi biaya |
|---|---|---|---|---|---|
| 1 jam (rencana awal) | 3,3% | −41,3% | 1,04 | 746 | 92,2% |
| **4 jam (dipakai)** | **21,31%** | −24,1% | 1,52 | 174 | 32,1% |
| Harian (seperti UTS) | 10,7% | −29,1% | 2,28 | 26 | 10,5% |

**Catatan jujur:**
- Pemilihan 4 jam dilakukan setelah melihat hasil backtest, jadi angka 21,31% bersifat in-sample.
- Bila backtest dimulai 1 Nov 2022, CAGR turun menjadi **12,5%** (MDD −24,1%, PF 1,36, 234 trade); `data/backtest_2022-11.txt`.
- Strategi kalah jauh dari beli & tahan BTC dalam return, tetapi MDD-nya sekitar setengah.
- 2025 dan 2026 negatif.

## 5. Bot di Vercel

| File | Fungsi |
|---|---|
| `api/tick.js` | Satu panggilan bot. Dilindungi `Authorization: Bearer CRON_SECRET` atau tanda tangan QStash. |
| `api/state.js` | Data publik dashboard: state dan log mentah, tanpa secret |
| `api/kill.js` | Kill switch, dilindungi `CRON_SECRET` |
| `api/jadwal.js` | Membuat/memeriksa jadwal QStash dari server (token QStash tidak keluar) |
| `vercel.json` | Cron Vercel harian sebagai cadangan, `maxDuration` 300 detik |

**Pengaman di kode:**
- **Idempotency:** kunci Redis `SET NX EX 240` menolak panggilan paralel, dan `state.lastCandle` memastikan tiap candle hanya diproses sekali. Panggilan tiap jam aman; candle 4 jam tetap diproses sekali.
- **Retry:** tiap request maks 3 kali, timeout 10 detik. Error tercatat di log `errors`.
- **Candle tertutup saja:** bar dengan `Time + 4 jam > server_time` dibuang.
- **Forward test mulai datar:** saat freeze, state masa persiapan direset sekali (tercatat di log `notes`).

**Log di Redis** (list `atikahbot:log:*`, JSON per baris): `calls`, `signals`, `orders`, `equity`, `errors`, `snapshots`, `kill`, `notes`.

**Penjadwal:**
| Penjadwal | Jadwal | Otorisasi |
|---|---|---|
| Upstash QStash (utama) | tiap jam menit ke-3 (`3 * * * *`) → `GET /api/tick?sumber=qstash` | tanda tangan QStash, diverifikasi di [lib/auth.js](lib/auth.js) |
| GitHub Actions (cadangan, opsional) | tiap jam menit ke-9, `.github/workflows/tick.yml` | secret `CRON_SECRET` + `TICK_URL` |
| Vercel Cron (cadangan) | 00.17 UTC tiap hari | `CRON_SECRET` (otomatis dari Vercel) |

Uji lokal tanpa Vercel (Redis tiruan di memori, API Indodax asli): `node tools/tes_lokal.mjs`. Panggilan kedua harus `CANDLE_SUDAH_DIPROSES`.

## 5b. Dashboard, log, dan hitung ulang

Dashboard Vercel dihitung di browser dari `/api/state` lewat [public/metrics.js](public/metrics.js) dan ditampilkan oleh [public/render.js](public/render.js).

Sesudah forward test selesai:
```
node tools/ekspor_log.mjs                 # semua log mentah → data/forward/state.json + log_*.csv
node tools/fetch_history.mjs 240 2022-02-01
node tools/hitung_ulang.mjs               # backtest ulang + backtest jendela forward + pencocokan sinyal & fill + dashboard_offline.html
```

| Metrik | Definisi |
|---|---|
| Porsi biaya | Σ (fee + spread + slippage) ÷ Σ hasil sebelum biaya |
| Spread/slippage per order | selisih harga fill terhadap mid ((best bid + best ask) ÷ 2) |
| Uptime | candle 4 jam yang diproses sebelum candle berikutnya tutup ÷ jumlah candle di jendela forward |

## 6. Freeze

| Hal | Isi |
|---|---|
| Waktu freeze | **Rabu 4 Nov 2026 12.00 WIB** (05.00 UTC) |
| Forward test | 4 Nov 12.00 – 14 Nov 2026 12.00 WIB |
| Commit freeze | *(hash diisi sesudah commit)* |

Aturan, parameter, dan universe di `lib/strategy.js`, `lib/costs.js`, dan `lib/indodax.js` (`PAIRS`) **tidak diubah** sesudah commit freeze. Perbaikan bug yang tidak mengubah aturan dicatat di bagian 7.

## 7. Catatan perubahan sesudah freeze
*(kosong)*
