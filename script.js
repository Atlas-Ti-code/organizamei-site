/* =========================================================
   OrganizaMEI — lógica do app
   Fluxo: EU LANÇO OS DADOS → O SISTEMA CALCULA → O DASHBOARD ATUALIZA
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Atalhos ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const finePointer = () => !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);

  /* ---------- Datas ---------- */
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const monthOf = (iso) => iso.slice(0, 7);
  const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); return monthKeyOf(new Date(y, m - 1 + n, 1)); };
  const daysIn = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const monthLabel = (key) => `${MESES[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;
  const monthShort = (key) => MESES_ABREV[Number(key.slice(5, 7)) - 1];
  const fmtDate = (iso) => iso.split('-').reverse().join('/');
  const CUR = monthKeyOf(new Date());

  /* ---------- Dados iniciais (demonstração) ---------- */
  const STORE_KEY = 'organizamei:v2';
  const PALETTE = ['#57e39b', '#4fd0ee', '#f6c453', '#b39dfa', '#ff9f6b'];
  const COR_OUTROS = '#7f9a8c';

  const DEFAULT_SETTINGS = {
    negocio: 'Ateliê da Maria',
    usuario: 'Maria',
    email: 'maria@ateliedamaria.com.br',
    moeda: 'BRL',
    tema: 'escuro',
    insights: true,
  };

  function defaultCategorias() {
    return [
      { id: 'cat-receitas', nome: 'Receitas', tipo: 'entrada', subs: [
        { id: 'sub-vendas', nome: 'Vendas' },
        { id: 'sub-servicos', nome: 'Serviços' },
        { id: 'sub-outras-rec', nome: 'Outras receitas' },
      ] },
      { id: 'cat-despesas', nome: 'Despesas', tipo: 'saida', subs: [
        { id: 'sub-fornecedores', nome: 'Fornecedores' },
        { id: 'sub-aluguel', nome: 'Aluguel' },
        { id: 'sub-marketing', nome: 'Marketing' },
        { id: 'sub-transporte', nome: 'Transporte' },
        { id: 'sub-funcionarios', nome: 'Funcionários/Freelancers' },
        { id: 'sub-impostos', nome: 'Impostos' },
        { id: 'sub-outras-desp', nome: 'Outras despesas' },
      ] },
    ];
  }

  // Valores dentro do padrão MEI: teto de R$ 81.000/ano (média de R$ 6.750/mês).
  // Os 6 meses somam R$ 37.200 de entradas, ritmo de cerca de R$ 74 mil no ano.
  // Mês atual fecha em prejuízo para a demonstração: Entradas R$ 6.200 x Saídas R$ 7.000.
  const SEED_MES_ATUAL = [
    [2, 'Venda de produtos na loja online', 'sub-vendas', 1850],
    [3, 'Compra de matéria-prima (tecidos e linhas)', 'sub-fornecedores', 2350],
    [5, 'Aluguel do ateliê', 'sub-aluguel', 1200],
    [6, 'Encomenda de cliente', 'sub-vendas', 1400],
    [8, 'Anúncios no Instagram', 'sub-marketing', 650],
    [9, 'Serviço de personalização', 'sub-servicos', 1150],
    [10, 'Fornecedor de embalagens', 'sub-fornecedores', 480],
    [12, 'Pagamento de freelancer (costura)', 'sub-funcionarios', 1100],
    [14, 'Venda na feira de artesanato', 'sub-vendas', 980],
    [15, 'Frete e entregas', 'sub-transporte', 390],
    [18, 'Workshop de bordado', 'sub-servicos', 820],
    [20, 'DAS MEI (comércio e serviços)', 'sub-impostos', 87.05],
    [22, 'Conserto da máquina de costura', 'sub-outras-desp', 450],
    [26, 'Taxas da maquininha de cartão', 'sub-outras-desp', 292.95],
  ];
  // [meses atrás, total de entradas, total de saídas] em reais
  const SEED_HISTORICO = [[5, 5600, 4300], [4, 6300, 4900], [3, 5900, 4700], [2, 6700, 5100], [1, 6500, 6100]];
  const MODELO_ENTRADAS = [
    [4, 'Vendas na loja online', 'sub-vendas', 0.40],
    [11, 'Encomendas de clientes', 'sub-vendas', 0.22],
    [16, 'Serviços de personalização', 'sub-servicos', 0.24],
    [23, 'Venda em feira e eventos', 'sub-vendas', 0.10],
    [27, 'Outras receitas', 'sub-outras-rec', null],
  ];
  const ALUGUEL = 1200;
  const DAS = 87.05; // 5% do salário mínimo de 2026 (INSS) + R$ 1 de ICMS + R$ 5 de ISS
  const MODELO_SAIDAS = [
    [3, 'Compra de matéria-prima', 'sub-fornecedores', 0.45],
    [9, 'Anúncios nas redes sociais', 'sub-marketing', 0.15],
    [12, 'Pagamento de freelancer', 'sub-funcionarios', 0.20],
    [17, 'Frete e entregas', 'sub-transporte', 0.12],
    [25, 'Manutenção e taxas da maquininha', 'sub-outras-desp', null],
  ];

  function seedLancamentos() {
    const subInfo = {};
    defaultCategorias().forEach((c) => c.subs.forEach((s) => { subInfo[s.id] = { tipo: c.tipo, cat: c.id }; }));
    const list = [];
    let t = Date.now() - 1e9;
    const add = (key, day, descricao, sub, reais) => {
      const d = Math.min(day, daysIn(key));
      list.push({
        id: uid(), data: `${key}-${pad(d)}`, descricao,
        tipo: subInfo[sub].tipo, categoriaId: subInfo[sub].cat, subcategoriaId: sub,
        valor: Math.round(reais * 100), obs: '', criadoEm: t++,
      });
    };
    const split = (total, modelo) => {
      let acc = 0;
      return modelo.map(([d, desc, sub, p]) => {
        const v = p == null ? Math.round((total - acc) * 100) / 100 : Math.round((total * p) / 10) * 10;
        acc += v;
        return [d, desc, sub, v];
      });
    };
    for (const [back, E, S] of SEED_HISTORICO) {
      const key = addMonths(CUR, -back);
      split(E, MODELO_ENTRADAS).forEach((r) => add(key, ...r));
      add(key, 5, 'Aluguel do ateliê', 'sub-aluguel', ALUGUEL);
      add(key, 20, 'DAS MEI (comércio e serviços)', 'sub-impostos', DAS);
      split(Math.round((S - ALUGUEL - DAS) * 100) / 100, MODELO_SAIDAS).forEach((r) => add(key, ...r));
    }
    SEED_MES_ATUAL.forEach((r) => add(CUR, ...r));
    return list;
  }

  /* ---------- Estado e armazenamento ---------- */
  function freshState(settings) {
    return { settings: { ...DEFAULT_SETTINGS, ...(settings || {}) }, categorias: defaultCategorias(), lancamentos: seedLancamentos() };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.lancamentos) || !Array.isArray(s.categorias)) return null;
      s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
      return s;
    } catch (e) {
      return null;
    }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento: segue em memória */ }
  }

  let state = load() || freshState();
  const ui = {
    route: 'inicio',
    dashMonth: CUR,
    lancMonth: CUR,
    lancTipo: 'todos',
    lancBusca: '',
    rep: { periodo: 'ult-6', de: '', ate: '', cat: 'todas', tipo: 'todos' },
    ncTipo: 'saida',
    editingId: null,
    lastId: null,
  };

  /* ---------- Formatação ---------- */
  let fmtMoney, fmtCompact;
  const fmtPct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
  function setFormatters() {
    try {
      fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: state.settings.moeda || 'BRL' });
    } catch (e) {
      fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    fmtCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  }
  const money = (cents) => fmtMoney.format(cents / 100);
  const compact = (cents) => fmtCompact.format(cents / 100);
  const pct = (v) => fmtPct.format(v);

  /* ---------- Consultas (o "PROCV" do sistema) ---------- */
  const getCat = (id) => state.categorias.find((c) => c.id === id);
  const getSub = (cat, id) => (cat ? cat.subs.find((s) => s.id === id) : undefined);
  function classif(l) {
    const c = getCat(l.categoriaId);
    const s = getSub(c, l.subcategoriaId);
    return { cat: c ? c.nome : 'Sem categoria', sub: s ? s.nome : (c ? c.nome : 'Sem categoria') };
  }
  const ofMonth = (key) => state.lancamentos.filter((l) => monthOf(l.data) === key);
  function totals(list) {
    let e = 0, s = 0;
    for (const l of list) { if (l.tipo === 'entrada') e += l.valor; else s += l.valor; }
    return { e, s, r: e - s, margem: e > 0 ? (e - s) / e : null };
  }
  const situacao = (r) => (r > 0 ? 'LUCRO' : r < 0 ? 'PREJUÍZO' : 'EMPATE');
  function bySub(list, tipo) {
    const map = new Map();
    list.filter((l) => l.tipo === tipo).forEach((l) => {
      const k = l.subcategoriaId || l.categoriaId;
      const c = classif(l);
      const cur = map.get(k) || { nome: c.sub, cat: c.cat, tipo, valor: 0, qtd: 0 };
      cur.valor += l.valor;
      cur.qtd += 1;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }
  function monthOptions(extra = []) {
    const set = new Set(state.lancamentos.map((l) => monthOf(l.data)));
    set.add(CUR);
    extra.forEach((k) => k && /^\d{4}-\d{2}$/.test(k) && set.add(k));
    return [...set].sort().reverse();
  }
  const sortLanc = (a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0);

  /* ---------- Ícones ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7.5 16v-3M12 16V9M16.5 16V6"/>',
    bulb: '<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4.2 11.4c.8.7 1.2 1.6 1.2 2.6V17h6v-.5c0-1 .4-1.9 1.2-2.6A6.5 6.5 0 0 0 12 2.5z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M7 17 17 7M8 7h9v9"/>',
    down: '<path d="M7 7l10 10M17 8v9H8"/>',
    wallet: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5V15"/><path d="M21 9h-5a3 3 0 0 0 0 6h5z"/><path d="M16 12h.01" stroke-width="3"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    edit: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/>',
  };
  const icon = (name, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  function hydrateIcons(root = document) {
    $$('i[data-icon]', root).forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.className); });
  }

  /* ---------- Gráfico de barras (SVG próprio, sem bibliotecas) ---------- */
  function niceStep(raw) {
    if (!(raw > 0)) return 100000;
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / exp;
    const n = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => f <= x) || 10;
    return n * exp;
  }

  function renderBars(host, buckets, opts = {}) {
    const W = Math.max(280, Math.round(host.clientWidth || 560));
    const H = opts.height || 250;
    const padL = 46, padR = 6, padT = 14, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const ticks = 4;
    const maxV = Math.max(0, ...buckets.flatMap((b) => [b.e, b.s]));
    const step = niceStep(maxV / ticks);
    const top = step * ticks;
    const gw = plotW / buckets.length;
    const bw = Math.max(5, Math.min(26, gw * 0.3));
    const gap = Math.max(2, Math.min(6, gw * 0.06));
    let g = '';

    for (let i = 0; i <= ticks; i++) {
      const v = step * i;
      const yy = padT + plotH - (v / top) * plotH;
      g += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>`;
      g += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end">${i === 0 ? '0' : esc(compact(v))}</text>`;
    }

    const tips = [];
    buckets.forEach((b, i) => {
      const gx = padL + gw * i;
      const cx = gx + gw / 2;
      const he = (b.e / top) * plotH;
      const hs = (b.s / top) * plotH;
      const rx = Math.min(5, bw / 2);
      if (b.sel) g += `<rect class="sel-bg" x="${gx + 2}" y="${padT - 8}" width="${gw - 4}" height="${H - 6 - (padT - 8)}" rx="10"/>`;
      g += `<rect class="bar in" x="${cx - gap / 2 - bw}" y="${padT + plotH - he}" width="${bw}" height="${he}" rx="${rx}" style="animation-delay:${i * 45}ms"/>`;
      g += `<rect class="bar out" x="${cx + gap / 2}" y="${padT + plotH - hs}" width="${bw}" height="${hs}" rx="${rx}" style="animation-delay:${i * 45 + 25}ms"/>`;
      g += `<text class="xlab${b.sel ? ' on' : ''}" x="${cx}" y="${H - 9}" text-anchor="middle">${esc(b.label)}</text>`;
      g += `<rect class="hit" data-tip-idx="${i}" x="${gx}" y="${padT}" width="${gw}" height="${plotH}"/>`;
      tips.push(
        `<strong>${esc(b.title || b.label)}</strong>` +
        `<span class="t-in">Entradas: ${money(b.e)}</span>` +
        `<span class="t-out">Saídas: ${money(b.s)}</span>` +
        `<span>Resultado: ${money(b.e - b.s)}</span>`
      );
    });

    host._tips = tips;
    host._keys = buckets.map((b) => b.key);
    host.innerHTML =
      `<svg class="svg-chart${opts.animate === false ? ' noanim' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.label || 'Gráfico de entradas e saídas')}">${g}</svg>`;
  }

  /* ---------- Gráfico de rosca ---------- */
  function renderDonut(host, items, total, opts = {}) {
    if (!total) {
      host._tips = [];
      host.innerHTML = `<div class="empty-mini">${icon('chart')}<p>Nenhuma saída registrada neste mês.</p></div>`;
      return;
    }
    const size = 180, sw = 24, r = (size - sw) / 2, C = 2 * Math.PI * r;
    const gapLen = items.length > 1 ? 2.5 : 0;
    let off = 0, segs = '';
    items.forEach((it, i) => {
      const len = (it.valor / total) * C;
      const vis = Math.max(0.01, len - gapLen);
      segs += `<circle class="seg-arc${opts.animate === false ? ' noanim' : ''}" data-tip-idx="${i}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${it.cor}" stroke-width="${sw}" stroke-dasharray="${vis.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" style="animation-delay:${i * 80}ms"/>`;
      off += len;
    });
    const first = items[0];
    host._tips = items.map((it) => `<strong>${esc(it.nome)}</strong><span>${money(it.valor)} · ${pct(it.valor / total)} das saídas</span>`);
    host.innerHTML = `
      <div class="donut">
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Distribuição das despesas">
          <circle class="donut-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/>
          <g transform="rotate(-90 ${size / 2} ${size / 2})">${segs}</g>
        </svg>
        <div class="donut-center"><strong>${pct(first.valor / total)}</strong><small>${esc(first.nome)}</small></div>
      </div>
      <ul class="donut-legend">
        ${items.map((it) => `<li><span class="sw" style="background:${it.cor}"></span><span class="nm"><span>${esc(it.nome)}</span><small>${money(it.valor)}</small></span><span class="pc">${pct(it.valor / total)}</span></li>`).join('')}
      </ul>`;
  }

  function donutItems(list) {
    const rows = bySub(list, 'saida');
    const top = rows.slice(0, 4).map((r, i) => ({ nome: r.nome, valor: r.valor, cor: PALETTE[i] }));
    const resto = rows.slice(4).reduce((a, r) => a + r.valor, 0);
    if (resto > 0) top.push({ nome: 'Outros', valor: resto, cor: COR_OUTROS });
    return top;
  }

  /* ---------- Ranking em barras horizontais ---------- */
  function renderRank(host, rows, total, tipo, animate) {
    if (!rows.length) {
      host.innerHTML = `<div class="empty-mini">${icon('chart')}<p>Nada registrado com esses filtros.</p></div>`;
      return;
    }
    const max = rows[0].valor || 1;
    host.classList.toggle('noanim', animate === false);
    host.innerHTML = rows.map((r, i) => `
      <div class="rank-row">
        <div class="rank-top"><span>${esc(r.nome)}<small>${esc(r.cat)}</small></span><span class="v">${money(r.valor)}<em>${pct(r.valor / total)}</em></span></div>
        <div class="rank-track"><div class="rank-fill ${tipo}" style="width:${((r.valor / max) * 100).toFixed(1)}%;animation-delay:${i * 60}ms"></div></div>
      </div>`).join('');
  }

  /* ---------- Contador animado nos cards ---------- */
  function setMoney(el, cents, animate = true) {
    const prev = el.dataset.v === undefined ? null : Number(el.dataset.v);
    el.dataset.v = String(cents);
    const card = el.closest('.kpi');
    if (prev !== null && prev !== cents && card && animate) {
      card.classList.remove('pulse');
      void card.offsetWidth;
      card.classList.add('pulse');
    }
    const from = prev === null ? 0 : prev;
    if (!animate || from === cents || reduceMotion()) { el.textContent = money(cents); return; }
    cancelAnimationFrame(el._raf);
    const t0 = performance.now(), dur = 750;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      el.textContent = money(Math.round(from + (cents - from) * ease));
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  /* ---------- Insights automáticos ---------- */
  function buildInsights(key) {
    const list = ofMonth(key);
    const t = totals(list);
    const p = totals(ofMonth(addMonths(key, -1)));
    const quando = key === CUR ? 'este mês' : `em ${monthLabel(key)}`;
    if (!list.length) {
      return [{ tone: 'info', text: `Ainda não há lançamentos ${key === CUR ? 'neste mês' : 'em ' + monthLabel(key)}. Registre o primeiro para ver o resumo do seu negócio.` }];
    }
    const out = [];
    if (t.e > 0) {
      const r = t.s / t.e;
      out.push({ tone: r > 1 ? 'bad' : r > 0.8 ? 'warn' : 'good', text: `Suas despesas representam <b>${pct(r)}</b> das suas entradas ${quando}.` });
    } else {
      out.push({ tone: 'bad', text: `Nenhuma entrada registrada ${quando}, apenas saídas.` });
    }
    if (t.e > t.s) out.push({ tone: 'good', text: `Suas entradas foram maiores que suas saídas ${quando}: sobraram <b>${money(t.r)}</b>.` });
    else if (t.s > t.e) out.push({ tone: 'bad', text: `Suas saídas superaram as entradas em <b>${money(-t.r)}</b> ${quando}.` });
    else out.push({ tone: 'warn', text: `Entradas e saídas empataram ${quando}: o negócio não teve lucro nem prejuízo.` });
    if (p.s > 0 && t.s !== p.s) {
      const d = (t.s - p.s) / p.s;
      out.push({ tone: d > 0 ? 'warn' : 'good', text: `Suas despesas ${d > 0 ? 'aumentaram' : 'diminuíram'} <b>${pct(Math.abs(d))}</b> em relação ao mês anterior.` });
    }
    if (p.e > 0 && t.e !== p.e) {
      const d = (t.e - p.e) / p.e;
      out.push({ tone: d > 0 ? 'good' : 'warn', text: `Suas entradas ${d > 0 ? 'cresceram' : 'caíram'} <b>${pct(Math.abs(d))}</b> em relação ao mês anterior.` });
    }
    const topGasto = bySub(list, 'saida')[0];
    if (topGasto && t.s > 0) out.push({ tone: 'info', text: `<b>${esc(topGasto.nome)}</b> é o seu maior gasto: ${pct(topGasto.valor / t.s)} das saídas.` });
    return out;
  }
  const insightItems = (arr) => arr.map((i) => `<li><span class="dot ${i.tone}"></span><span>${i.text}</span></li>`).join('');

  /* =========================================================
     TELAS
     ========================================================= */
  function fillMonthSelect(sel, keys, selected, allLabel) {
    sel.innerHTML = (allLabel ? `<option value="todos">${allLabel}</option>` : '') +
      keys.map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join('');
    sel.value = selected;
  }
  const segOn = (sel, v) => $$(`${sel} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v));

  function renderShell() {
    const s = state.settings;
    const ini = (s.usuario || s.negocio || 'M').trim().charAt(0).toUpperCase() || 'M';
    $$('[data-avatar]').forEach((el) => { el.textContent = ini; });
    $$('[data-user]').forEach((el) => { el.textContent = s.usuario || 'Usuário'; });
    $$('[data-biz]').forEach((el) => { el.textContent = s.negocio || 'Meu negócio'; });
    document.title = `OrganizaMEI · ${s.negocio || 'Seu negócio organizado'}`;
  }

  function deltaPct(cur, prev, goodWhenUp) {
    if (!prev) return '<span>Sem dados do mês anterior</span>';
    const d = (cur - prev) / prev;
    if (Math.abs(d) < 0.005) return '<span>Igual ao mês anterior</span>';
    const up = d > 0;
    return `<span class="${up === goodWhenUp ? 'good' : 'bad'}">${up ? '↑' : '↓'} ${pct(Math.abs(d))}</span> vs. mês anterior`;
  }

  /* ---------- Início ---------- */
  function renderDashboard(animate = true) {
    const key = ui.dashMonth;
    const list = ofMonth(key);
    const t = totals(list);
    const prevList = ofMonth(addMonths(key, -1));
    const p = totals(prevList);

    $('#helloName').textContent = state.settings.usuario || 'empreendedor(a)';
    $('#helloSub').textContent = key === CUR
      ? 'Este é o resumo do seu negócio neste mês.'
      : `Este é o resumo do seu negócio em ${monthLabel(key)}.`;
    fillMonthSelect($('#dashMonth'), monthOptions([key]), key);

    setMoney($('#kIn'), t.e, animate);
    setMoney($('#kOut'), t.s, animate);
    setMoney($('#kRes'), t.r, animate);
    $('#kInDelta').innerHTML = deltaPct(t.e, p.e, true);
    $('#kOutDelta').innerHTML = deltaPct(t.s, p.s, false);

    const res = $('#kpiRes');
    res.classList.toggle('neg', t.r < 0);
    res.classList.toggle('zero', t.r === 0);
    $('#kStatus').textContent = list.length ? situacao(t.r) : 'SEM DADOS';
    if (prevList.length) {
      const diff = t.r - p.r;
      $('#kResDelta').innerHTML = diff === 0
        ? '<span>Igual ao mês anterior</span>'
        : `<span class="${diff > 0 ? 'good' : 'bad'}">${diff > 0 ? '↑' : '↓'} ${money(Math.abs(diff))}</span> vs. mês anterior`;
    } else {
      $('#kResDelta').innerHTML = '<span>Sem dados do mês anterior</span>';
    }

    renderDashCharts(animate);

    const box = $('#dashInsight');
    box.hidden = !state.settings.insights;
    if (state.settings.insights) $('#insightList').innerHTML = insightItems(buildInsights(key).slice(0, 3));

    const recent = [...list].sort(sortLanc).slice(0, 5);
    $('#recentList').innerHTML = recent.length
      ? recent.map(miniRow).join('')
      : `<li class="empty-mini">${icon('list')}<p>Nenhum lançamento neste mês. Use “Novo lançamento” para começar.</p></li>`;
  }

  function renderDashCharts(animate = true) {
    const key = ui.dashMonth;
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const k = addMonths(key, -i);
      const t = totals(ofMonth(k));
      buckets.push({ key: k, label: monthShort(k), title: monthLabel(k), e: t.e, s: t.s, sel: k === key });
    }
    renderBars($('#dashBars'), buckets, { animate, label: 'Entradas e saídas dos últimos 6 meses' });
    const list = ofMonth(key);
    renderDonut($('#dashDonut'), donutItems(list), totals(list).s, { animate });
  }

  function miniRow(l) {
    const c = classif(l);
    const isIn = l.tipo === 'entrada';
    return `<li class="mini${l.id === ui.lastId ? ' flash' : ''}">
      <span class="mini-ic ${isIn ? 'in' : 'out'}">${icon(isIn ? 'up' : 'down')}</span>
      <div class="mini-txt"><strong>${esc(l.descricao)}</strong><small>${esc(c.sub)} · ${fmtDate(l.data)}</small></div>
      <span class="mini-val ${isIn ? 'val-in' : 'val-out'}">${isIn ? '+' : '−'} ${money(l.valor)}</span>
    </li>`;
  }

  /* ---------- Lançamentos ---------- */
  function renderLancamentos() {
    fillMonthSelect($('#fMonth'), monthOptions([ui.lancMonth]), ui.lancMonth, 'Todos os meses');
    segOn('#fType', ui.lancTipo);
    if ($('#fSearch').value !== ui.lancBusca) $('#fSearch').value = ui.lancBusca;

    const q = norm(ui.lancBusca.trim());
    const rows = state.lancamentos.filter((l) => {
      if (ui.lancMonth !== 'todos' && monthOf(l.data) !== ui.lancMonth) return false;
      if (ui.lancTipo !== 'todos' && l.tipo !== ui.lancTipo) return false;
      if (!q) return true;
      const c = classif(l);
      return norm(`${l.descricao} ${l.obs} ${c.cat} ${c.sub}`).includes(q);
    }).sort(sortLanc);

    const t = totals(rows);
    $('#lancSummary').innerHTML =
      `<span><strong>${rows.length}</strong> lançamento${rows.length === 1 ? '' : 's'}</span>` +
      `<span>Entradas <strong class="val-in">${money(t.e)}</strong></span>` +
      `<span>Saídas <strong class="val-out">${money(t.s)}</strong></span>` +
      `<span>Saldo <strong class="${t.r < 0 ? 'val-out' : 'val-in'}">${money(t.r)}</strong></span>`;

    $('#lancBody').innerHTML = rows.map(rowHTML).join('');
    $('#lancEmpty').hidden = rows.length > 0;
    $('#lancTableWrap').hidden = rows.length === 0;
  }

  function rowHTML(l) {
    const c = classif(l);
    const isIn = l.tipo === 'entrada';
    return `<tr class="${l.id === ui.lastId ? 'flash' : ''}">
      <td class="td-date">${fmtDate(l.data)}</td>
      <td class="td-desc"><strong>${esc(l.descricao)}</strong>${l.obs ? `<small class="obs">${esc(l.obs)}</small>` : ''}<small class="m-meta">${fmtDate(l.data)} · ${esc(c.cat)} › ${esc(c.sub)}</small></td>
      <td class="td-cat">${esc(c.cat)}<small>${esc(c.sub)}</small></td>
      <td class="td-type"><span class="badge ${isIn ? 'in' : 'out'}">${isIn ? 'Entrada' : 'Saída'}</span></td>
      <td class="td-val num ${isIn ? 'val-in' : 'val-out'}">${isIn ? '+' : '−'} ${money(l.valor)}</td>
      <td class="td-acts"><div class="row-actions">
        <button class="icon-btn sm" type="button" data-edit="${l.id}" aria-label="Editar ${esc(l.descricao)}">${icon('edit')}</button>
        <button class="icon-btn sm danger" type="button" data-del="${l.id}" aria-label="Excluir ${esc(l.descricao)}">${icon('trash')}</button>
      </div></td>
    </tr>`;
  }

  /* ---------- Categorias ---------- */
  function renderCategorias() {
    const usage = {};
    state.lancamentos.forEach((l) => {
      usage[l.categoriaId] = (usage[l.categoriaId] || 0) + 1;
      usage[`s:${l.subcategoriaId}`] = (usage[`s:${l.subcategoriaId}`] || 0) + 1;
    });
    [['entrada', '#catIn'], ['saida', '#catOut']].forEach(([tipo, sel]) => {
      const cats = state.categorias.filter((c) => c.tipo === tipo);
      $(sel).innerHTML = cats.length
        ? cats.map((c) => catCard(c, usage)).join('')
        : `<div class="card empty-mini">${icon('folder')}<p>Nenhuma categoria de ${tipo === 'entrada' ? 'entrada' : 'saída'} ainda.</p></div>`;
    });
  }

  function catCard(c, usage) {
    const n = usage[c.id] || 0;
    const chips = c.subs.map((s) => `
      <span class="chip">${esc(s.nome)}<span class="count" title="Lançamentos">${usage[`s:${s.id}`] || 0}</span>
        <button type="button" data-delsub="${c.id}|${s.id}" aria-label="Remover ${esc(s.nome)}">${icon('x')}</button>
      </span>`).join('');
    return `<article class="card cat-card">
      <header class="cat-head">
        <span class="dot ${c.tipo === 'entrada' ? 'in' : 'out'}"></span>
        <h3>${esc(c.nome)}</h3>
        <span class="cat-meta">${n} lançamento${n === 1 ? '' : 's'}</span>
        <button class="icon-btn sm danger" type="button" data-delcat="${c.id}" aria-label="Excluir categoria ${esc(c.nome)}">${icon('trash')}</button>
      </header>
      <div class="chips">${chips || '<span class="muted sm">Sem subcategorias</span>'}</div>
      <div class="add-sub">
        <input class="input" placeholder="Nova subcategoria" maxlength="40" data-subinput="${c.id}" aria-label="Nova subcategoria em ${esc(c.nome)}">
        <button class="btn btn-ghost sm" type="button" data-addsub="${c.id}">${icon('plus')}Adicionar</button>
      </div>
    </article>`;
  }

  /* ---------- Relatórios ---------- */
  const PRESETS = [
    ['mes-atual', 'Este mês'],
    ['mes-anterior', 'Mês anterior'],
    ['ult-3', 'Últimos 3 meses'],
    ['ult-6', 'Últimos 6 meses'],
    ['ano', 'Este ano'],
    ['tudo', 'Todo o período'],
    ['custom', 'Personalizado…'],
  ];

  function repRange() {
    const p = ui.rep.periodo;
    const mStart = (k) => `${k}-01`;
    const mEnd = (k) => `${k}-${pad(daysIn(k))}`;
    if (p.startsWith('m:')) { const k = p.slice(2); return { start: mStart(k), end: mEnd(k), label: monthLabel(k) }; }
    switch (p) {
      case 'mes-atual': return { start: mStart(CUR), end: mEnd(CUR), label: monthLabel(CUR) };
      case 'mes-anterior': { const k = addMonths(CUR, -1); return { start: mStart(k), end: mEnd(k), label: monthLabel(k) }; }
      case 'ult-3': return { start: mStart(addMonths(CUR, -2)), end: mEnd(CUR), label: 'Últimos 3 meses' };
      case 'ult-6': return { start: mStart(addMonths(CUR, -5)), end: mEnd(CUR), label: 'Últimos 6 meses' };
      case 'ano': return { start: `${CUR.slice(0, 4)}-01-01`, end: `${CUR.slice(0, 4)}-12-31`, label: `Ano de ${CUR.slice(0, 4)}` };
      case 'custom': {
        let a = ui.rep.de || mStart(CUR);
        let b = ui.rep.ate || mEnd(CUR);
        if (a > b) [a, b] = [b, a];
        return { start: a, end: b, label: `De ${fmtDate(a)} a ${fmtDate(b)}` };
      }
      default: {
        const ds = state.lancamentos.map((l) => l.data).sort();
        return { start: ds[0] || mStart(CUR), end: ds[ds.length - 1] || mEnd(CUR), label: 'Todo o período' };
      }
    }
  }

  function repBuckets(range) {
    const ks = monthOf(range.start), ke = monthOf(range.end);
    const out = [];
    if (ks === ke) {
      const dim = daysIn(ks);
      for (let w = 0; w * 7 < dim; w++) {
        const d1 = w * 7 + 1, d2 = Math.min(dim, d1 + 6);
        out.push({ label: `Sem ${w + 1}`, title: `${pad(d1)} a ${pad(d2)}/${ks.slice(5)}`, start: `${ks}-${pad(d1)}`, end: `${ks}-${pad(d2)}` });
      }
      return { buckets: out, title: `Semana a semana em ${monthLabel(ks)}` };
    }
    const multiYear = ks.slice(0, 4) !== ke.slice(0, 4);
    let k = ks, guard = 0;
    while (k <= ke && guard++ < 60) {
      out.push({ label: monthShort(k) + (multiYear ? `/${k.slice(2, 4)}` : ''), title: monthLabel(k), start: `${k}-01`, end: `${k}-${pad(daysIn(k))}` });
      k = addMonths(k, 1);
    }
    return { buckets: out, title: 'Evolução mês a mês' };
  }

  function renderRelatorios(animate = true) {
    // Filtros
    const selP = $('#rPeriodo');
    selP.innerHTML =
      `<optgroup label="Períodos">${PRESETS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</optgroup>` +
      `<optgroup label="Meses">${monthOptions().map((k) => `<option value="m:${k}">${monthLabel(k)}</option>`).join('')}</optgroup>`;
    selP.value = ui.rep.periodo;
    if (selP.value !== ui.rep.periodo) { ui.rep.periodo = 'ult-6'; selP.value = 'ult-6'; }
    $$('[data-custom]').forEach((el) => { el.hidden = ui.rep.periodo !== 'custom'; });

    if (ui.rep.cat !== 'todas' && !getCat(ui.rep.cat)) ui.rep.cat = 'todas';
    $('#rCat').innerHTML = '<option value="todas">Todas as categorias</option>' +
      ['entrada', 'saida'].map((t) => {
        const cs = state.categorias.filter((c) => c.tipo === t);
        return cs.length ? `<optgroup label="${t === 'entrada' ? 'Entradas' : 'Saídas'}">${cs.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</optgroup>` : '';
      }).join('');
    $('#rCat').value = ui.rep.cat;
    segOn('#rTipo', ui.rep.tipo);

    // Dados filtrados
    const range = repRange();
    if (ui.rep.periodo === 'custom') { $('#rDe').value = range.start; $('#rAte').value = range.end; }
    const list = state.lancamentos.filter((l) =>
      l.data >= range.start && l.data <= range.end &&
      (ui.rep.cat === 'todas' || l.categoriaId === ui.rep.cat) &&
      (ui.rep.tipo === 'todos' || l.tipo === ui.rep.tipo));
    const t = totals(list);
    $('#rRangeLabel').textContent = `${range.label}: ${list.length} lançamento${list.length === 1 ? '' : 's'}`;

    setMoney($('#rIn'), t.e, animate);
    setMoney($('#rOut'), t.s, animate);
    setMoney($('#rRes'), t.r, animate);
    $('#rResCard').classList.toggle('neg', t.r < 0);
    $('#rResCard').classList.toggle('zero', t.r === 0);
    $('#rStatus').textContent = list.length ? situacao(t.r) : 'SEM DADOS';
    $('#rMargem').textContent = t.margem === null ? '—' : pct(t.margem);

    // Evolução
    const { buckets, title } = repBuckets(range);
    const filled = buckets.map((b) => {
      const tt = totals(list.filter((l) => l.data >= b.start && l.data <= b.end));
      return { ...b, e: tt.e, s: tt.s };
    });
    $('#rBarsTitle').textContent = title;
    renderBars($('#rBars'), filled, { animate, height: 260, label: title });

    // Rankings
    const outRows = bySub(list, 'saida');
    const inRows = bySub(list, 'entrada');
    $('#rRankOutCard').hidden = ui.rep.tipo === 'entrada';
    $('#rRankInCard').hidden = ui.rep.tipo === 'saida';
    renderRank($('#rRankOut'), outRows, t.s || 1, 'saida', animate);
    renderRank($('#rRankIn'), inRows, t.e || 1, 'entrada', animate);

    // Tabela-resumo
    const all = [...inRows, ...outRows].sort((a, b) => b.valor - a.valor);
    $('#rTable').innerHTML = all.length
      ? all.map((r) => {
          const isIn = r.tipo === 'entrada';
          return `<tr><td>${esc(r.nome)}</td><td>${esc(r.cat)}</td>
            <td><span class="badge ${isIn ? 'in' : 'out'}">${isIn ? 'Entrada' : 'Saída'}</span></td>
            <td class="num">${r.qtd}</td>
            <td class="num ${isIn ? 'val-in' : 'val-out'}">${money(r.valor)}</td>
            <td class="num">${pct(r.valor / ((isIn ? t.e : t.s) || 1))}</td></tr>`;
        }).join('')
      : '<tr><td colspan="6" class="muted">Nenhum lançamento com esses filtros.</td></tr>';
  }

  /* ---------- Dicas ---------- */
  const DICAS = [
    ['🏦', 'Separe o pessoal do profissional', 'Tenha uma conta só para o negócio. Misturar o dinheiro de casa com o da empresa esconde o seu lucro real.'],
    ['📅', 'Acompanhe as despesas todo mês', 'Reserve um horário fixo na semana para lançar tudo. Gastos pequenos somados viram um buraco grande.'],
    ['📈', 'Conheça seu lucro antes de gastar mais', 'Antes de contratar, investir ou aumentar o estoque, confira se o resultado dos últimos meses sustenta esse passo.'],
    ['💸', 'Defina sua retirada mensal', 'Combine um valor fixo para você tirar do negócio todo mês, em vez de usar o caixa sempre que precisar.'],
    ['🧾', 'Pague o DAS em dia', 'A guia mensal do MEI vence no dia 20. Pagar em dia evita multa e mantém seus direitos no INSS.'],
    ['🛟', 'Monte uma reserva para o negócio', 'Guardar uma parte das entradas todo mês ajuda a passar pelos meses fracos sem se endividar.'],
    ['🎯', 'Fique de olho no limite do MEI', 'O teto do MEI é de R$ 81 mil por ano, cerca de R$ 6.750 por mês. Acompanhe suas entradas acumuladas para não ter surpresa.'],
    ['🤝', 'Negocie com fornecedores', 'Fornecedores costumam ser o maior gasto. Comparar preços e negociar prazos melhora sua margem.'],
    ['🗂️', 'Registre tudo, até o cafezinho', 'Quanto mais completos os lançamentos, mais confiáveis ficam os relatórios e os insights.'],
  ];

  function renderDicas() {
    $('#dInsTitle').textContent = `Insights de ${monthLabel(ui.dashMonth)}`;
    $('#dInsList').innerHTML = insightItems(buildInsights(ui.dashMonth));
    $('#tipsGrid').innerHTML = DICAS.map(([e, t, p]) =>
      `<article class="card tip"><span class="tip-icon" aria-hidden="true">${e}</span><h3>${t}</h3><p>${p}</p></article>`).join('');
  }

  /* ---------- Configurações ---------- */
  function renderConfig() {
    const s = state.settings;
    $('#sNegocio').value = s.negocio || '';
    $('#sUsuario').value = s.usuario || '';
    $('#sEmail').value = s.email || '';
    $('#sMoeda').value = s.moeda || 'BRL';
    segOn('#sTema', s.tema);
    $('#sInsights').checked = !!s.insights;
  }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.tema === 'claro' ? 'light' : 'dark');
  }

  /* =========================================================
     NAVEGAÇÃO
     ========================================================= */
  const ROUTES = ['inicio', 'lancamentos', 'categorias', 'relatorios', 'dicas', 'configuracoes'];
  const RENDER = {
    inicio: renderDashboard,
    lancamentos: renderLancamentos,
    categorias: renderCategorias,
    relatorios: renderRelatorios,
    dicas: renderDicas,
    configuracoes: renderConfig,
  };

  function showRoute(name) {
    if (!ROUTES.includes(name)) name = 'inicio';
    ui.route = name;
    closeAllModals();
    hideTip();
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
    $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    $('#bnMore').classList.toggle('active', ['categorias', 'dicas', 'configuracoes'].includes(name));
    renderShell();
    RENDER[name](true);
    window.scrollTo(0, 0);
  }
  function go(name) {
    try { if (location.hash !== `#${name}`) location.hash = name; } catch (e) { /* ambiente sem hash */ }
    showRoute(name);
  }
  function rerender(animate = true) {
    renderShell();
    RENDER[ui.route](animate);
  }

  /* =========================================================
     MODAIS, AVISOS E TOOLTIP
     ========================================================= */
  let lastFocus = null;
  let confirmResolve = null;

  function openModal(id) {
    const m = $(`#${id}`);
    lastFocus = document.activeElement;
    m.hidden = false;
    document.body.classList.add('no-scroll');
    if (finePointer()) {
      setTimeout(() => {
        const f = m.querySelector('[data-autofocus]') || m.querySelector('input, select, textarea, .modal-foot .btn-primary, .modal-foot .btn-danger');
        if (f) f.focus();
      }, 60);
    }
  }
  function closeModal(id) {
    const m = $(`#${id}`);
    if (!m || m.hidden) return;
    m.hidden = true;
    if (id === 'modalConfirm' && confirmResolve) { confirmResolve(false); confirmResolve = null; }
    if (!$$('.modal').some((x) => !x.hidden)) document.body.classList.remove('no-scroll');
    if (lastFocus && document.contains(lastFocus) && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function closeAllModals() { $$('.modal').forEach((m) => { if (!m.hidden) closeModal(m.id); }); }

  function confirmar({ titulo, texto, ok = 'Confirmar', perigo = true }) {
    $('#cTitle').textContent = titulo;
    $('#cText').textContent = texto;
    const b = $('#cOk');
    b.textContent = ok;
    b.className = `btn ${perigo ? 'btn-danger' : 'btn-primary'}`;
    openModal('modalConfirm');
    return new Promise((res) => { confirmResolve = res; });
  }

  function toast(msg, tone = 'good') {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.innerHTML = `${icon(tone === 'good' ? 'check' : 'alert')}<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3400);
  }

  const tip = () => $('#tooltip');
  let tipTimer = null;
  let lastPointer = 'mouse';
  function showTip(target, x, y) {
    const host = target.closest('.chart-host');
    const html = host && host._tips ? host._tips[Number(target.dataset.tipIdx)] : null;
    if (!html) { hideTip(); return; }
    const t = tip();
    t.innerHTML = html;
    t.classList.add('show');
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.min(window.innerWidth - 10 - w / 2, Math.max(10 + w / 2, x))}px`;
    t.style.top = `${y}px`;
    t.classList.toggle('below', y < h + 30);
  }
  function hideTip() { tip().classList.remove('show'); }

  /* =========================================================
     FORMULÁRIO DE LANÇAMENTO
     ========================================================= */
  function fillCatSelect() {
    $('#lCat').innerHTML = ['entrada', 'saida'].map((t) => {
      const cs = state.categorias.filter((c) => c.tipo === t);
      return cs.length ? `<optgroup label="${t === 'entrada' ? 'Entradas' : 'Saídas'}">${cs.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  }
  function setValor(cents) {
    const el = $('#lValor');
    el.dataset.cents = String(cents);
    el.value = cents ? money(cents) : '';
  }
  function classifyText() {
    const cat = getCat($('#lCat').value);
    const sub = getSub(cat, $('#lSub').value);
    $('#lClassify').innerHTML = cat
      ? `${icon('check')}<span>Classificado automaticamente como <strong class="${cat.tipo === 'entrada' ? 'val-in' : 'val-out'}">${cat.tipo === 'entrada' ? 'Entrada' : 'Saída'}</strong> › ${esc(cat.nome)}${sub ? ` › ${esc(sub.nome)}` : ''}</span>`
      : '';
  }
  // Ao escolher a categoria, o sistema descobre sozinho se é entrada ou saída
  function syncFromCat(subId) {
    const cat = getCat($('#lCat').value);
    const sub = $('#lSub');
    if (!cat) {
      sub.innerHTML = '<option value="">—</option>';
      classifyText();
      return;
    }
    segOn('#lType', cat.tipo);
    sub.innerHTML = cat.subs.length
      ? cat.subs.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')
      : '<option value="">Sem subcategoria</option>';
    if (subId && cat.subs.some((s) => s.id === subId)) sub.value = subId;
    classifyText();
  }
  function pickTipo(tipo) {
    const cur = getCat($('#lCat').value);
    if (cur && cur.tipo === tipo) return;
    const c = state.categorias.find((x) => x.tipo === tipo);
    if (!c) { toast(`Crie uma categoria de ${tipo === 'entrada' ? 'entrada' : 'saída'} primeiro.`, 'warn'); return; }
    $('#lCat').value = c.id;
    syncFromCat();
  }

  function openLanc(id) {
    if (!state.categorias.length) { toast('Crie uma categoria antes de lançar.', 'warn'); go('categorias'); return; }
    const l = id ? state.lancamentos.find((x) => x.id === id) : null;
    ui.editingId = l ? l.id : null;
    $('#lancTitle').textContent = l ? 'Editar lançamento' : 'Novo lançamento';
    $('#lSave').textContent = l ? 'Salvar alterações' : 'Salvar lançamento';
    $('#lData').value = l ? l.data : toISO(new Date());
    $('#lDesc').value = l ? l.descricao : '';
    $('#lObs').value = l ? (l.obs || '') : '';
    setValor(l ? l.valor : 0);
    fillCatSelect();
    const tipo = l ? l.tipo : 'entrada';
    const catId = l && getCat(l.categoriaId) ? l.categoriaId : (state.categorias.find((c) => c.tipo === tipo) || state.categorias[0]).id;
    $('#lCat').value = catId;
    syncFromCat(l ? l.subcategoriaId : null);
    $('#lError').textContent = '';
    openModal('modalLanc');
  }

  function saveLanc() {
    const data = $('#lData').value;
    const descricao = $('#lDesc').value.trim();
    const cat = getCat($('#lCat').value);
    const sub = getSub(cat, $('#lSub').value);
    const valor = Number($('#lValor').dataset.cents || 0);
    const obs = $('#lObs').value.trim();
    const err = !data ? 'Informe a data do lançamento.'
      : !descricao ? 'Escreva uma descrição, por exemplo “Venda de produto”.'
      : !cat ? 'Escolha uma categoria.'
      : valor <= 0 ? 'Informe um valor maior que zero.'
      : '';
    if (err) { $('#lError').textContent = err; return; }

    const dados = { data, descricao, tipo: cat.tipo, categoriaId: cat.id, subcategoriaId: sub ? sub.id : '', valor, obs };
    if (ui.editingId) {
      const i = state.lancamentos.findIndex((x) => x.id === ui.editingId);
      if (i >= 0) state.lancamentos[i] = { ...state.lancamentos[i], ...dados };
      ui.lastId = ui.editingId;
      toast('Lançamento atualizado. Os totais foram recalculados.');
    } else {
      const novo = { id: uid(), ...dados, criadoEm: Date.now() };
      state.lancamentos.push(novo);
      ui.lastId = novo.id;
      toast(`${cat.tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${money(valor)} registrada. O dashboard já foi atualizado.`);
    }
    // Mostra o mês do lançamento para a mudança ficar visível
    ui.dashMonth = monthOf(data);
    if (ui.lancMonth !== 'todos') ui.lancMonth = monthOf(data);
    persist();
    closeModal('modalLanc');
    rerender(true);
    const flashed = ui.lastId;
    setTimeout(() => { if (ui.lastId === flashed) ui.lastId = null; }, 2500);
  }

  /* =========================================================
     CATEGORIAS: criar / remover
     ========================================================= */
  function openNewCat() {
    $('#ncNome').value = '';
    $('#ncSubs').value = '';
    $('#ncError').textContent = '';
    ui.ncTipo = 'saida';
    segOn('#ncTipo', ui.ncTipo);
    openModal('modalCat');
  }
  function saveNewCat() {
    const nome = $('#ncNome').value.trim();
    if (!nome) { $('#ncError').textContent = 'Dê um nome para a categoria.'; return; }
    if (state.categorias.some((c) => c.tipo === ui.ncTipo && norm(c.nome) === norm(nome))) {
      $('#ncError').textContent = 'Já existe uma categoria com esse nome.';
      return;
    }
    const nomes = [];
    $('#ncSubs').value.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
      if (!nomes.some((n) => norm(n) === norm(s))) nomes.push(s.slice(0, 40));
    });
    state.categorias.push({ id: `cat-${uid()}`, nome, tipo: ui.ncTipo, subs: nomes.map((n) => ({ id: `sub-${uid()}`, nome: n })) });
    persist();
    closeModal('modalCat');
    rerender();
    toast(`Categoria “${nome}” criada.`);
  }
  function addSub(cid) {
    const c = getCat(cid);
    const inp = $(`[data-subinput="${cid}"]`);
    if (!c || !inp) return;
    const nome = inp.value.trim();
    if (!nome) { inp.focus(); return; }
    if (c.subs.some((s) => norm(s.nome) === norm(nome))) { toast('Essa subcategoria já existe.', 'warn'); return; }
    c.subs.push({ id: `sub-${uid()}`, nome });
    persist();
    renderCategorias();
    toast(`Subcategoria “${nome}” adicionada em ${c.nome}.`);
    const again = $(`[data-subinput="${cid}"]`);
    if (again && finePointer()) again.focus();
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  function bindEvents() {
    window.addEventListener('hashchange', () => {
      const name = location.hash.slice(1);
      if (name && name !== ui.route) showRoute(name);
    });

    document.addEventListener('click', async (e) => {
      const t = e.target.closest('a, button, [data-close], [data-tip-idx]');
      if (!t) return;

      if (t.dataset.route) { e.preventDefault(); go(t.dataset.route); return; }
      if (t.hasAttribute('data-close')) { const m = t.closest('.modal'); if (m) closeModal(m.id); return; }

      // Clique numa barra do dashboard muda o mês
      if (t.dataset.tipIdx !== undefined && lastPointer === 'mouse') {
        const host = t.closest('#dashBars');
        const key = host && host._keys ? host._keys[Number(t.dataset.tipIdx)] : null;
        if (key && key !== ui.dashMonth) { ui.dashMonth = key; renderDashboard(true); }
        return;
      }

      const action = t.dataset.action;
      if (action === 'new') { openLanc(); return; }
      if (action === 'new-cat') { openNewCat(); return; }
      if (action === 'more') { openModal('modalMore'); return; }

      if (t.dataset.edit) { openLanc(t.dataset.edit); return; }

      if (t.dataset.del) {
        const l = state.lancamentos.find((x) => x.id === t.dataset.del);
        if (!l) return;
        const ok = await confirmar({ titulo: 'Excluir lançamento?', texto: `“${l.descricao}” (${money(l.valor)}) será removido e os totais serão recalculados.`, ok: 'Excluir lançamento' });
        if (!ok) return;
        state.lancamentos = state.lancamentos.filter((x) => x.id !== l.id);
        persist();
        rerender(true);
        toast('Lançamento excluído.', 'warn');
        return;
      }

      if (t.dataset.delcat) {
        const c = getCat(t.dataset.delcat);
        if (!c) return;
        const n = state.lancamentos.filter((l) => l.categoriaId === c.id).length;
        if (n) { toast(`“${c.nome}” tem ${n} lançamento${n === 1 ? '' : 's'}. Edite ou exclua esses lançamentos antes.`, 'warn'); return; }
        const ok = await confirmar({ titulo: 'Excluir categoria?', texto: `A categoria “${c.nome}” e as subcategorias dela serão removidas.`, ok: 'Excluir categoria' });
        if (!ok) return;
        state.categorias = state.categorias.filter((x) => x.id !== c.id);
        persist();
        rerender();
        toast('Categoria excluída.', 'warn');
        return;
      }

      if (t.dataset.delsub) {
        const [cid, sid] = t.dataset.delsub.split('|');
        const c = getCat(cid);
        const s = getSub(c, sid);
        if (!s) return;
        const n = state.lancamentos.filter((l) => l.subcategoriaId === sid).length;
        if (n) { toast(`“${s.nome}” tem ${n} lançamento${n === 1 ? '' : 's'}. Edite ou exclua esses lançamentos antes.`, 'warn'); return; }
        c.subs = c.subs.filter((x) => x.id !== sid);
        persist();
        renderCategorias();
        toast(`Subcategoria “${s.nome}” removida.`, 'warn');
        return;
      }

      if (t.dataset.addsub) { addSub(t.dataset.addsub); return; }

      // Botões segmentados
      const seg = t.closest('.seg');
      if (seg && t.dataset.v) {
        const v = t.dataset.v;
        if (seg.id === 'lType') pickTipo(v);
        else if (seg.id === 'ncTipo') { ui.ncTipo = v; segOn('#ncTipo', v); }
        else if (seg.id === 'fType') { ui.lancTipo = v; renderLancamentos(); }
        else if (seg.id === 'rTipo') { ui.rep.tipo = v; renderRelatorios(true); }
        else if (seg.id === 'sTema') { state.settings.tema = v; segOn('#sTema', v); applyTheme(); persist(); }
      }
    });

    // Formulário de lançamento
    $('#lCat').addEventListener('change', () => syncFromCat());
    $('#lSub').addEventListener('change', classifyText);
    $('#lValor').addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
      setValor(Number(digits || 0));
    });
    $('#lSave').addEventListener('click', saveLanc);
    $('#ncSave').addEventListener('click', saveNewCat);
    $('#cOk').addEventListener('click', () => {
      const r = confirmResolve;
      confirmResolve = null;
      closeModal('modalConfirm');
      if (r) r(true);
    });

    // Filtros
    $('#dashMonth').addEventListener('change', (e) => { ui.dashMonth = e.target.value; renderDashboard(true); });
    $('#fMonth').addEventListener('change', (e) => { ui.lancMonth = e.target.value; renderLancamentos(); });
    $('#fSearch').addEventListener('input', (e) => { ui.lancBusca = e.target.value; renderLancamentos(); });
    $('#rPeriodo').addEventListener('change', (e) => { ui.rep.periodo = e.target.value; renderRelatorios(true); });
    $('#rDe').addEventListener('change', (e) => { ui.rep.de = e.target.value; renderRelatorios(true); });
    $('#rAte').addEventListener('change', (e) => { ui.rep.ate = e.target.value; renderRelatorios(true); });
    $('#rCat').addEventListener('change', (e) => { ui.rep.cat = e.target.value; renderRelatorios(true); });

    // Configurações
    $('#sSave').addEventListener('click', () => {
      const email = $('#sEmail').value.trim();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast('Confira o e-mail: parece incompleto.', 'bad'); return; }
      Object.assign(state.settings, {
        negocio: $('#sNegocio').value.trim() || DEFAULT_SETTINGS.negocio,
        usuario: $('#sUsuario').value.trim() || DEFAULT_SETTINGS.usuario,
        email,
        moeda: $('#sMoeda').value,
      });
      setFormatters();
      persist();
      renderShell();
      renderConfig();
      toast('Alterações salvas.');
    });
    $('#sInsights').addEventListener('change', (e) => { state.settings.insights = e.target.checked; persist(); });
    $('#sReset').addEventListener('click', async () => {
      const ok = await confirmar({ titulo: 'Restaurar dados de exemplo?', texto: 'Os lançamentos e categorias atuais serão substituídos pelos dados de demonstração. Suas configurações continuam iguais.', ok: 'Restaurar dados', perigo: false });
      if (!ok) return;
      state = freshState(state.settings);
      ui.dashMonth = CUR;
      ui.lancMonth = CUR;
      persist();
      toast('Dados de exemplo restaurados.');
      go('inicio');
    });
    $('#sClear').addEventListener('click', async () => {
      const ok = await confirmar({ titulo: 'Apagar todos os lançamentos?', texto: 'Todos os lançamentos serão removidos deste navegador. As categorias continuam.', ok: 'Apagar lançamentos' });
      if (!ok) return;
      state.lancamentos = [];
      persist();
      toast('Lançamentos apagados.', 'warn');
      go('inicio');
    });

    // Teclado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = $$('.modal').filter((m) => !m.hidden).pop();
        if (open) closeModal(open.id);
        hideTip();
        return;
      }
      if (e.key !== 'Enter' || e.isComposing) return;
      const target = e.target;
      if (target.matches && target.matches('[data-subinput]')) { e.preventDefault(); addSub(target.dataset.subinput); return; }
      const m = target.closest && target.closest('.modal');
      if (m && target.matches('input')) {
        e.preventDefault();
        if (m.id === 'modalLanc') saveLanc();
        if (m.id === 'modalCat') saveNewCat();
      }
    });

    // Tooltip dos gráficos
    document.addEventListener('pointerdown', (e) => {
      lastPointer = e.pointerType || 'mouse';
      if (lastPointer === 'mouse') return;
      const t = e.target.closest && e.target.closest('[data-tip-idx]');
      if (t) {
        showTip(t, e.clientX, e.clientY);
        clearTimeout(tipTimer);
        tipTimer = setTimeout(hideTip, 2600);
      } else {
        hideTip();
      }
    });
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target.closest && e.target.closest('[data-tip-idx]');
      if (t) showTip(t, e.clientX, e.clientY); else hideTip();
    });
    window.addEventListener('scroll', hideTip, { passive: true });

    // Redesenha os gráficos quando a largura muda
    let rz = null;
    let lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        if (Math.abs(window.innerWidth - lastW) < 8) return;
        lastW = window.innerWidth;
        if (ui.route === 'inicio') renderDashCharts(false);
        if (ui.route === 'relatorios') renderRelatorios(false);
      }, 160);
    });
  }

  /* =========================================================
     INÍCIO
     ========================================================= */
  function init() {
    hydrateIcons();
    applyTheme();
    setFormatters();
    bindEvents();
    showRoute(location.hash.slice(1) || 'inicio');
  }
  init();
})();
