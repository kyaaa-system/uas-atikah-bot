// TAMPILAN DASHBOARD — satu kode untuk halaman Vercel (public/index.html) dan HTML offline (tools/hitung_ulang.mjs menyematkan file ini).
// Input: { bt: ringkasan backtest (public/backtest_ringkasan.json), fw: forwardFromLogs(...), gap: hasil pencocokan (opsional, dari hitung_ulang), sumber }
export function renderDashboard(el, { bt, fw, gap = null, sumber = '', status = null, latihan = null }) {
  const pct = (x, d = 2) => x == null || !isFinite(x) ? '–' : (x * 100).toFixed(d).replace('.', ',') + '%', num = (x, d = 2) => x == null ? '–' : x === Infinity ? '∞' : x.toFixed(d).replace('.', ','), rp = x => x == null ? '–' : 'Rp' + Math.round(x).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tbl = (head, rows) => '<div class="w"><table><thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' + (rows.length ? rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') : `<tr><td colspan="${head.length}" class="m">belum ada</td></tr>`) + '</tbody></table></div>';
  const T = fw.trade, B = bt.trade, op = fw.operasional;
  let h = `<p class="m">Sumber data: ${esc(sumber)} · jendela forward ${esc(fw.jendela.mulai)} → ${esc(fw.jendela.akhir)} UTC · semua angka dihitung dari log mentah (public/metrics.js), sama dengan skrip hitung_ulang.</p>`;
  if (status) { const wib = t => t ? new Date(Date.parse(t.length === 16 ? t + ':00Z' : t) + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' WIB' : '–', L = status.terakhir;
    const fase = { sebelum_freeze: `Persiapan: forward test mulai ${wib(status.freeze)}. Trade sebelum itu hanya latihan dan direset saat freeze.`, forward: `Forward test berjalan sampai ${wib(status.akhir)}.`, selesai: 'Forward test selesai.' }[status.fase];
    h += '<h2>Status bot</h2><p class="m">' + esc(fase) + '</p>' + tbl(['Panggilan terakhir', 'Pemanggil', 'Hasil', 'Candle terakhir diproses (waktu buka)', 'Total panggilan sejak deploy', 'Panggilan error', 'Ekuitas', 'Posisi terbuka'],
      [[wib(L?.t), esc(L?.sumber), esc(L?.hasil) + (L?.error ? ` (${L.error} error)` : ''), wib(status.candle_terakhir_diproses), status.panggilan_total, status.panggilan_error, rp(status.ekuitas), esc(status.posisi.join(', ') || '–')]]); }
  if (latihan && status?.fase === 'sebelum_freeze') { const o = latihan.operasional;
    h += '<h2>Uji coba sebelum freeze</h2><p class="m">Jendela ' + esc(latihan.jendela.mulai.slice(0, 16)) + ' UTC (panggilan terjadwal pertama) → sekarang. Rumus sama dengan forward test; angka ini TIDAK masuk hasil UAS.</p>'
      + tbl(['Candle terjadwal', 'Terproses tepat waktu', 'Uptime', 'Panggilan', 'Panggilan error', 'Error API', 'Kill switch', 'Trade latihan', 'Return latihan'],
        [[o.candle_terjadwal, o.candle_tepat_waktu, pct(o.uptime, 1), o.panggilan, o.panggilan_error, o.error_api, o.kill_switch, latihan.trade.jumlah, pct(latihan.ekuitas.return_total)]]);
    if (o.candle_terlewat.length) h += `<p class="m">Candle terlewat: ${o.candle_terlewat.map(esc).join(', ')}</p>`;
    h += latihan.error_terakhir.length ? tbl(['Waktu', 'Tahap / URL', 'Error'], latihan.error_terakhir.map(e => [esc(e.t), esc(e.tahap || e.url || e.pair || ''), esc(String(e.error).slice(0, 160))])) : '<p class="m">Belum ada error yang tercatat.</p>'; }
  h += '<h2>Ringkasan</h2>'   + tbl(['Metrik', `Backtest ${esc(bt.mulai.slice(0, 10))} → ${esc(bt.akhir.slice(0, 10))}`, 'Forward test (10 hari)'], [
    ['Return total', pct(bt.ekuitas.return_total), pct(fw.ekuitas.return_total)], ['CAGR', pct(bt.ekuitas.cagr), '— (tidak bermakna untuk 10 hari)'], ['Maximum drawdown', '−' + pct(bt.ekuitas.mdd), fw.ekuitas.mdd == null ? '–' : '−' + pct(fw.ekuitas.mdd)],
    ['Jumlah trade', B.jumlah, T.jumlah], ['Win rate', pct(B.win_rate, 1), pct(T.win_rate, 1)], ['Profit factor', num(B.profit_factor), num(T.profit_factor)],
    ['Rata-rata untung / rugi per trade', pct(B.rata_untung, 1) + ' / ' + pct(B.rata_rugi, 1), pct(T.rata_untung, 1) + ' / ' + pct(T.rata_rugi, 1)],
    ['Porsi biaya (fee + spread + slippage) ÷ laba kotor', pct(B.porsi_biaya, 1), pct(T.porsi_biaya, 1)], ['Beli & tahan BTC/IDR (periode sama)', pct(bt.beli_tahan_btc.return_total), pct(fw.beli_tahan_btc)]]);
  h += '<h2>Operasional</h2>' + tbl(['Candle terjadwal', 'Terproses tepat waktu', 'Uptime', 'Panggilan', 'Panggilan error', 'Error API (setelah retry dicatat)', 'Pemakaian kill switch'],
    [[op.candle_terjadwal, op.candle_tepat_waktu, pct(op.uptime, 1), op.panggilan, op.panggilan_error, op.error_api, op.kill_switch]]);
  if (op.candle_terlewat?.length) h += `<p class="m">Candle tidak terproses tepat waktu: ${op.candle_terlewat.map(esc).join(', ')}</p>`;
  if (gap) { h += '<h2>Gap backtest vs forward (jendela 10 hari yang sama)</h2>' + tbl(['Sinyal bot', 'Sinyal backtest', 'Identik', 'Kecocokan', 'Return backtest jendela', 'Return forward', 'Selisih'],
      [[gap.sinyal.bot, gap.sinyal.backtest, gap.sinyal.identik, pct(gap.sinyal.kecocokan, 1), pct(gap.bt_jendela.return_total), pct(fw.ekuitas.return_total), pct(fw.ekuitas.return_total - gap.bt_jendela.return_total)]]);
    if (gap.sinyal.hanya_bot.length || gap.sinyal.hanya_backtest.length) h += `<p class="m">Hanya di bot: ${gap.sinyal.hanya_bot.map(esc).join('; ') || '–'} · hanya di backtest: ${gap.sinyal.hanya_backtest.map(esc).join('; ') || '–'}</p>`;
    h += tbl(['Candle', 'Pasangan', 'Sisi', 'Harga fill bot', 'Harga fill backtest', 'Selisih', 'Terlambat dari tutup candle'], gap.fill.map(f => [esc(f.candle), esc(f.pair), esc(f.sisi), num(f.bot, 4), num(f.backtest, 4), pct(f.selisih, 3), f.telat_menit + ' menit'])); }
  h += '<h2>Trade forward</h2>' + tbl(['Pasangan', 'Masuk', 'Keluar', 'Hasil', 'Return', 'Biaya', 'Alasan'], fw.trades.map(t => [esc(t.pair), esc(t.masuk), esc(t.keluar), rp(t.pnl), pct(t.ret), rp(t.biaya), esc(t.alasan)]));
  h += '<h2>Sinyal forward (log bot)</h2>' + tbl(['Candle', 'Pasangan', 'Sisi', 'Alasan', 'Harga sinyal', 'Data valid'], fw.sinyal.map(s => [esc(s.candle), esc(s.pair), esc(s.sisi), esc(s.alasan), num(s.harga_sinyal, 4), s.valid === false ? 'tidak: ' + esc((s.alasan_tidak_valid || []).join(', ')) : 'ya']));
  el.innerHTML = h;
}
export const CSS = `:root{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e1db}@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ecebe6;--mut:#9a998f;--line:#2e2d29}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:0 auto;padding:16px}h1{font-size:24px}h2{font-size:18px;margin-top:28px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}th{font-weight:600}.m{color:var(--mut);font-size:13px}.w{overflow-x:auto}`;
