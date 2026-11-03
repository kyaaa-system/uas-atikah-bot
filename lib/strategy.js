// STRATEGI MA 50/100/200 (adaptasi strategi UTS saham Kompas100 harian ke kripto IDR Indodax 4 jam) — SATU fungsi sinyal dipakai backtest DAN bot.
// Input hanya candle 4 jam yang SUDAH TERTUTUP. Keputusan di close bar t, dieksekusi sesudahnya (bot: order book live; backtest: open bar t+1 ± biaya terukur).
// UTS: BUY bila close > MA50 > MA100 > MA200 dan kondisi itu BARU berubah false → true; SELL bila close < MA200 (prioritas) atau MA50 < MA100.
// MA100 = round(sqrt(50 × 200)) seperti di UTS. Panjang MA dalam BAR (candle 4 jam), bukan hari.
// Timeframe 4 jam dipilih SETELAH membandingkan backtest 1 jam / 4 jam / harian dengan aturan yang sama (in-sample, dicatat di README).
import { PAIRS } from './indodax.js';

export const PARAMS = Object.freeze({
  tf: 240,                  // menit per candle
  maFast: 50, maMid: Math.round(Math.sqrt(50 * 200)), maSlow: 200,   // 50 / 100 / 200 bar
  slot: 0.15, maxPos: 5,    // 15% ekuitas per posisi, maks 5 posisi (UTS: 10% × 10 posisi)
  maxPosValue: 0.15,        // ukuran maksimum satu posisi (porsi ekuitas)
  dailyLoss: 0.03,          // daily loss limit: ekuitas ≤ 97% ekuitas awal hari WIB → tidak membuka posisi baru sampai 00.00 WIB berikutnya
  warmup: 201,              // bar minimal: MA200 bar ini + MA200 bar sebelumnya (syarat "baru berubah")
  window: 240,              // jendela waktu (dalam bar = 40 hari) candle tertutup terakhir yang diberikan ke decide() — dipotong menurut WAKTU, sama di bot & backtest
});

export const sma = (a, n, i) => { if (i < n - 1) return NaN; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n; };
const up = (c, i, P) => { const f = sma(c, P.maFast, i), m = sma(c, P.maMid, i), s = sma(c, P.maSlow, i); return c[i] > f && f > m && m > s; };

// bars: { PAIR: [{t,o,h,l,c,v}, ...] } candle tertutup, urut waktu, bar terakhir = bar keputusan
// positions: [{pair}] ; blocked = true bila daily loss limit / kill switch aktif ; noEntry = Set pasangan yang datanya tidak valid untuk entry
// → { exits: [{pair, reason, signalPrice}], entries: [{pair, reason, signalPrice, weight}], rejected: [sinyal beli yang ditolak karena data tidak valid], info }
// Bila kandidat beli > slot kosong, urutan = peringkat likuiditas universe (PAIRS), bukan dipilih dengan melihat hasil.
export function decide(bars, positions, { blocked = false, noEntry = new Set() } = {}) {
  const P = PARAMS, out = { exits: [], entries: [], rejected: [], info: {} };
  const held = new Set(positions.map(p => p.pair));
  // ---- exit posisi terbuka (close < MA200 diperiksa lebih dulu)
  for (const p of positions) { const b = bars[p.pair]; if (!b || b.length < P.warmup) continue; const c = b.map(x => x.c), i = c.length - 1;
    const r = c[i] < sma(c, P.maSlow, i) ? 'CLOSE_DI_BAWAH_MA200' : sma(c, P.maFast, i) < sma(c, P.maMid, i) ? 'MA50_DI_BAWAH_MA100' : null;
    if (r) out.exits.push({ pair: p.pair, reason: r, signalPrice: c[i] }); }
  if (blocked) return out;   // daily loss / kill switch: sinyal beli tidak dihitung
  // ---- entry: kondisi tren naik baru berubah false → true
  const cand = [];
  for (const pair of PAIRS) { const b = bars[pair]; if (!b || held.has(pair) || b.length < P.warmup) continue; const c = b.map(x => x.c), i = c.length - 1;
    if (!(up(c, i, P) && !up(c, i - 1, P))) continue;
    const x = { pair, reason: 'MA_SELARAS_BARU', signalPrice: c[i], weight: Math.min(P.slot, P.maxPosValue) };
    if (noEntry.has(pair)) out.rejected.push({ ...x, reason: 'MA_SELARAS_BARU_DATA_TIDAK_VALID' }); else cand.push(x); }
  out.entries.push(...cand.slice(0, Math.max(0, P.maxPos - held.size)));
  out.info = { t: Object.values(bars).find(b => b?.length)?.at(-1)?.t ?? null, kandidat: cand.map(x => x.pair) };
  return out;
}
