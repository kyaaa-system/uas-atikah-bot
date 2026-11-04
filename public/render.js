// TAMPILAN DASHBOARD — satu kode untuk halaman Vercel (public/index.html) dan HTML offline (tools/hitung_ulang.mjs menyematkan file ini).
// Input: { bt: ringkasan backtest (public/backtest_ringkasan.json), fw: forwardFromLogs(...), gap: hasil pencocokan (opsional, dari hitung_ulang), sumber }
export function renderDashboard(el, { bt, fw, gap = null, sumber = '', status = null, latihan = null }) {
  const pct = (x, d = 2) => x == null || !isFinite(x) ? '–' : (x * 100).toFixed(d).replace('.', ',') + '%';
  const num = (x, d = 2) => x == null ? '–' : x === Infinity ? '∞' : x.toFixed(d).replace('.', ',');
  const rp = x => x == null ? '–' : 'Rp' + Math.round(x).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tone = x => x == null || !isFinite(x) ? '' : x > 0 ? 'pos' : x < 0 ? 'neg' : '';
  const mdd = x => x == null || !isFinite(x) ? '–' : (x > 0 ? '−' : '') + pct(x);
  const wib = t => {
    if (!t) return '–';
    const iso = String(t).length === 16 ? t + ':00Z' : String(t);
    const ms = Date.parse(iso);
    if (!isFinite(ms)) return esc(t);
    return new Date(ms + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + '\u00A0WIB';
  };
  const tbl = (head, rows) => '<div class="table-wrap"><table><thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' + (rows.length ? rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') : `<tr><td colspan="${head.length}" class="m">belum ada</td></tr>`) + '</tbody></table></div>';
  const card = (title, sub, body) => `<section class="card"><div class="card-head"><h2>${title}</h2>${sub ? `<p class="card-sub">${sub}</p>` : ''}</div><div class="card-body">${body}</div></section>`;
  const kpi = (label, value, sub, cls = '') => `<div class="kpi ${cls}"><p class="kpi-label">${label}</p><p class="kpi-value">${value}</p><p class="kpi-sub">${sub}</p></div>`;

  const T = fw.trade, B = bt.trade, op = fw.operasional;
  const fase = status ? ({ sebelum_freeze: 'Persiapan', forward: 'Forward test', selesai: 'Selesai' }[status.fase] || status.fase) : 'Offline';
  const freezeLabel = wib(status?.freeze || fw.jendela.mulai);
  const windowLabel = `${wib(fw.jendela.mulai)} → ${wib(fw.jendela.akhir)}`;

  let h = `<p class="source">Sumber data: ${esc(sumber)} · jendela forward ${esc(fw.jendela.mulai)} → ${esc(fw.jendela.akhir)} UTC · semua angka dihitung dari log mentah (public/metrics.js), sama dengan skrip hitung_ulang.</p>`;
  h += `<div class="topbar">
    <span class="pill ${status?.fase === 'forward' ? 'live' : ''}">${status?.fase === 'forward' ? '<span class="dot"></span>' : ''}${esc(fase)}</span>
    <span class="pill">Freeze ${esc(freezeLabel)}</span>
    <span class="pill">Jendela ${esc(windowLabel)}</span>
    <span class="pill">${op.panggilan} panggilan · ${op.panggilan_error} error</span>
  </div>`;

  h += `<div class="kpis">
    ${kpi('Backtest return', `<span class="${tone(bt.ekuitas.return_total)}">${pct(bt.ekuitas.return_total)}</span>`, `${esc(bt.mulai.slice(0, 10))} → ${esc(bt.akhir.slice(0, 10))}`)}
    ${kpi('CAGR', pct(bt.ekuitas.cagr), `${num(bt.ekuitas.tahun, 2)} tahun`)}
    ${kpi('Max drawdown', `<span class="neg">${mdd(bt.ekuitas.mdd)}</span>`, 'puncak → palung')}
    ${kpi('Profit factor', num(B.profit_factor), `${B.jumlah} trade · WR ${pct(B.win_rate, 1)}`)}
    ${kpi('Forward return', `<span class="${tone(fw.ekuitas.return_total)}">${pct(fw.ekuitas.return_total)}</span>`, `${op.candle_tepat_waktu}/${op.candle_terjadwal} candle`)}
    ${kpi('Uptime', pct(op.uptime, 1), `${op.candle_tepat_waktu}/${op.candle_terjadwal} candle`, op.uptime == null ? '' : op.uptime >= 0.99 ? 'pos' : op.uptime < 0.9 ? 'neg' : 'warn')}
    ${kpi('Panggilan', op.panggilan, `${op.panggilan_error} error · dalam jendela`, op.panggilan_error ? 'neg' : 'pos')}
    ${kpi('Ekuitas', rp(status?.ekuitas ?? fw.ekuitas.akhir), status ? `${status.posisi.length} posisi terbuka` : 'nilai akhir jendela')}
  </div>`;

  if (status) {
    const L = status.terakhir;
    const faseText = { sebelum_freeze: `Persiapan: forward test mulai ${wib(status.freeze)}. Trade sebelum itu hanya latihan dan direset saat freeze.`, forward: `Forward test berjalan sampai ${wib(status.akhir)}.`, selesai: 'Forward test selesai.' }[status.fase];
    const hasil = esc(L?.hasil) + (L?.error ? ` (${L.error} error)` : '');
    const hasilHtml = L?.hasil === 'ERROR' ? `<span class="neg">${hasil}</span>` : L?.hasil === 'DIPROSES' ? `<span class="pos">${hasil}</span>` : hasil;
    const errHtml = status.panggilan_error ? `<span class="neg">${status.panggilan_error}</span>` : '<span class="pos">0</span>';
    h += card('Status bot', esc(faseText), tbl(
      ['Panggilan terakhir', 'Pemanggil', 'Hasil', 'Candle terakhir diproses (waktu buka)', 'Total panggilan sejak deploy', 'Panggilan error', 'Ekuitas', 'Posisi terbuka'],
      [[wib(L?.t), esc(L?.sumber), hasilHtml, wib(status.candle_terakhir_diproses), status.panggilan_total, errHtml, rp(status.ekuitas), esc(status.posisi.join(', ') || '–')]]
    ));
  }

  if (latihan && status?.fase === 'sebelum_freeze') {
    const o = latihan.operasional;
    let body = tbl(
      ['Candle terjadwal', 'Terproses tepat waktu', 'Uptime', 'Panggilan', 'Panggilan error', 'Error API', 'Kill switch', 'Trade latihan', 'Return latihan'],
      [[o.candle_terjadwal, o.candle_tepat_waktu, pct(o.uptime, 1), o.panggilan, o.panggilan_error, o.error_api, o.kill_switch, latihan.trade.jumlah, pct(latihan.ekuitas.return_total)]]
    );
    if (o.candle_terlewat.length) body += `<p class="m">Candle terlewat: ${o.candle_terlewat.map(esc).join(', ')}</p>`;
    body += latihan.error_terakhir.length ? tbl(['Waktu', 'Tahap / URL', 'Error'], latihan.error_terakhir.map(e => [esc(e.t), esc(e.tahap || e.url || e.pair || ''), esc(String(e.error).slice(0, 160))])) : '<p class="m">Belum ada error yang tercatat.</p>';
    h += card('Uji coba sebelum freeze', 'Jendela ' + esc(latihan.jendela.mulai.slice(0, 16)) + ' UTC (panggilan terjadwal pertama) → sekarang. Rumus sama dengan forward test; angka ini TIDAK masuk hasil UAS.', body);
  }

  h += card('Ringkasan', `Backtest ${esc(bt.mulai.slice(0, 10))} → ${esc(bt.akhir.slice(0, 10))} · forward test 10 hari`, tbl(
    ['Metrik', `Backtest ${esc(bt.mulai.slice(0, 10))} → ${esc(bt.akhir.slice(0, 10))}`, 'Forward test (10 hari)'],
    [
      ['Return total', `<span class="${tone(bt.ekuitas.return_total)}">${pct(bt.ekuitas.return_total)}</span>`, `<span class="${tone(fw.ekuitas.return_total)}">${pct(fw.ekuitas.return_total)}</span>`],
      ['CAGR', pct(bt.ekuitas.cagr), '— (tidak bermakna untuk 10 hari)'],
      ['Maximum drawdown', `<span class="neg">${mdd(bt.ekuitas.mdd)}</span>`, fw.ekuitas.mdd == null ? '–' : `<span class="neg">${mdd(fw.ekuitas.mdd)}</span>`],
      ['Jumlah trade', B.jumlah, T.jumlah],
      ['Win rate', pct(B.win_rate, 1), pct(T.win_rate, 1)],
      ['Profit factor', num(B.profit_factor), num(T.profit_factor)],
      ['Rata-rata untung / rugi per trade', pct(B.rata_untung, 1) + ' / ' + pct(B.rata_rugi, 1), pct(T.rata_untung, 1) + ' / ' + pct(T.rata_rugi, 1)],
      ['Porsi biaya (fee + spread + slippage) ÷ laba kotor', pct(B.porsi_biaya, 1), pct(T.porsi_biaya, 1)],
      ['Beli & tahan BTC/IDR (periode sama)', `<span class="${tone(bt.beli_tahan_btc.return_total)}">${pct(bt.beli_tahan_btc.return_total)}</span>`, `<span class="${tone(fw.beli_tahan_btc)}">${pct(fw.beli_tahan_btc)}</span>`],
    ]
  ));

  let opBody = tbl(
    ['Candle terjadwal', 'Terproses tepat waktu', 'Uptime', 'Panggilan', 'Panggilan error', 'Error API (setelah retry dicatat)', 'Pemakaian kill switch'],
    [[op.candle_terjadwal, op.candle_tepat_waktu, pct(op.uptime, 1), op.panggilan, op.panggilan_error ? `<span class="neg">${op.panggilan_error}</span>` : '<span class="pos">0</span>', op.error_api ? `<span class="neg">${op.error_api}</span>` : '<span class="pos">0</span>', op.kill_switch ? `<span class="warn">${op.kill_switch}</span>` : '<span class="pos">0</span>']]
  );
  if (op.candle_terlewat?.length) opBody += `<p class="m">Candle tidak terproses tepat waktu: ${op.candle_terlewat.map(esc).join(', ')}</p>`;
  const up = op.uptime == null ? 0 : Math.max(0, Math.min(1, op.uptime));
  opBody += `<div class="bar" title="Uptime ${pct(op.uptime, 1)}"><span style="width:${(up * 100).toFixed(1)}%"></span></div>`;
  h += card('Operasional', 'Kesehatan penjadwal, retry, dan kill switch', opBody);

  if (gap) {
    let body = tbl(
      ['Sinyal bot', 'Sinyal backtest', 'Identik', 'Kecocokan', 'Return backtest jendela', 'Return forward', 'Selisih'],
      [[gap.sinyal.bot, gap.sinyal.backtest, gap.sinyal.identik, pct(gap.sinyal.kecocokan, 1), pct(gap.bt_jendela.return_total), pct(fw.ekuitas.return_total), pct(fw.ekuitas.return_total - gap.bt_jendela.return_total)]]
    );
    if (gap.sinyal.hanya_bot.length || gap.sinyal.hanya_backtest.length) body += `<p class="m">Hanya di bot: ${gap.sinyal.hanya_bot.map(esc).join('; ') || '–'} · hanya di backtest: ${gap.sinyal.hanya_backtest.map(esc).join('; ') || '–'}</p>`;
    body += tbl(['Candle', 'Pasangan', 'Sisi', 'Harga fill bot', 'Harga fill backtest', 'Selisih', 'Terlambat dari tutup candle'], gap.fill.map(f => [esc(f.candle), esc(f.pair), esc(f.sisi), num(f.bot, 4), num(f.backtest, 4), pct(f.selisih, 3), f.telat_menit + ' menit']));
    h += card('Gap backtest vs forward (jendela 10 hari yang sama)', 'Pencocokan sinyal dan fill', body);
  }

  h += card('Trade forward', `${fw.trades.length} trade tercatat`, tbl(
    ['Pasangan', 'Masuk', 'Keluar', 'Hasil', 'Return', 'Biaya', 'Alasan'],
    fw.trades.map(t => [esc(t.pair), esc(t.masuk), esc(t.keluar), `<span class="${tone(t.pnl)}">${rp(t.pnl)}</span>`, `<span class="${tone(t.ret)}">${pct(t.ret)}</span>`, rp(t.biaya), esc(t.alasan)])
  ));

  h += card('Sinyal forward (log bot)', `${fw.sinyal.length} sinyal`, tbl(
    ['Candle', 'Pasangan', 'Sisi', 'Alasan', 'Harga sinyal', 'Data valid'],
    fw.sinyal.map(s => [esc(s.candle), esc(s.pair), esc(s.sisi), esc(s.alasan), num(s.harga_sinyal, 4), s.valid === false ? 'tidak: ' + esc((s.alasan_tidak_valid || []).join(', ')) : 'ya'])
  ));

  h += `<footer class="foot"><span>Bot dry run Indodax · MA 50/100/200 4 jam</span><span>Data publik · bukan saran investasi</span></footer>`;
  el.innerHTML = h;
}

export const CSS = `:root{color-scheme:dark;--bg:#070b14;--bg2:#0b1220;--card:#0f1728;--card2:#121c31;--line:#1e2a44;--line2:#273553;--fg:#e8eefc;--mut:#8fa3c0;--accent:#5eead4;--accent2:#60a5fa;--pos:#34d399;--neg:#fb7185;--warn:#fbbf24;--radius:16px;--shadow:0 18px 50px rgba(0,0,0,.35)}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;background:radial-gradient(1200px 600px at 15% -10%,rgba(96,165,250,.18),transparent 60%),radial-gradient(900px 500px at 90% 0%,rgba(94,234,212,.12),transparent 55%),linear-gradient(180deg,var(--bg) 0%,var(--bg2) 100%);color:var(--fg);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1180px;margin:0 auto;padding:28px 18px 56px}
main>h1{margin:0 0 6px;font-size:clamp(26px,4vw,40px);line-height:1.1;letter-spacing:-.03em;color:var(--fg)}
@supports(-webkit-background-clip:text){main>h1{background:linear-gradient(90deg,#fff 0%,#bfdbfe 45%,#5eead4 100%);-webkit-background-clip:text;background-clip:text;color:transparent}}
main>p.m{margin:0 0 18px;color:var(--mut);font-size:14px;max-width:820px}
main>p.m a{color:var(--accent2);text-decoration:none;border-bottom:1px solid rgba(96,165,250,.35)}
.source{margin:0 0 14px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(15,23,40,.55);color:var(--mut);font-size:12px;line-height:1.5}
.topbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.pill{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:rgba(15,23,40,.75);color:var(--mut);font-size:12px;font-weight:600;letter-spacing:.01em}
.pill.live{color:var(--pos);border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.08)}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px rgba(52,211,153,.12);animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 20px}
.kpi{position:relative;overflow:hidden;padding:16px 16px 14px;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(180deg,var(--card2),var(--card));box-shadow:var(--shadow)}
.kpi::before{content:"";position:absolute;inset:0 0 auto 0;height:2px;background:linear-gradient(90deg,var(--accent2),var(--accent));opacity:.75}
.kpi-label{margin:0 0 8px;color:var(--mut);font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.kpi-value{margin:0;font-size:clamp(22px,2.6vw,30px);font-weight:750;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.kpi-sub{margin:6px 0 0;color:var(--mut);font-size:12px}
.kpi.pos .kpi-value{color:var(--pos)}
.kpi.neg .kpi-value{color:var(--neg)}
.kpi.warn .kpi-value{color:var(--warn)}
.card{margin:0 0 18px;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(180deg,rgba(18,28,49,.92),rgba(15,23,40,.92));box-shadow:var(--shadow);overflow:hidden}
.card-head{padding:16px 18px 12px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px}
.card-head h2{margin:0;font-size:16px;letter-spacing:-.01em}
.card-sub{margin:0;color:var(--mut);font-size:12px}
.card-body{padding:14px 18px 18px}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:rgba(7,11,20,.35)}
.table-wrap::-webkit-scrollbar{height:9px}
.table-wrap::-webkit-scrollbar-track{background:#0a1120}
.table-wrap::-webkit-scrollbar-thumb{background:#243250;border-radius:999px}
.table-wrap+.table-wrap{margin-top:12px}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:520px}
thead th{background:#0d1626;color:var(--mut);font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);white-space:normal;line-height:1.35}
tbody td{padding:10px 12px;border-bottom:1px solid rgba(30,42,68,.7);vertical-align:top;font-variant-numeric:tabular-nums}
tbody tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:rgba(255,255,255,.015)}
tbody tr:hover td{background:rgba(96,165,250,.06)}
td:first-child,th:first-child{padding-left:14px}
td:last-child,th:last-child{padding-right:14px}
.pos{color:var(--pos);font-weight:650}
.neg{color:var(--neg);font-weight:650}
.warn{color:var(--warn);font-weight:650}
.m{color:var(--mut);font-size:13px}
.bar{height:8px;max-width:340px;border-radius:999px;background:#0a1120;border:1px solid var(--line);overflow:hidden;margin-top:12px}
.bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--accent2),var(--accent));border-radius:999px}
.foot{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:12px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){main{padding:20px 12px 40px}.kpis{grid-template-columns:1fr}.card-head{padding:14px}.card-body{padding:12px}.pill{font-size:11px}}`;
