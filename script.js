// Helpers and formatters
const $ = (s) => document.querySelector(s);
const chart = $('#chart');
const gbNum = new Intl.NumberFormat('en-GB');
const gbMoney = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbMoney2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });

const state = { price: 10, vc: 4, fc: 1200, maxu: 400, showRegions: false, rounding: 'int', invalid: false, reason: '' };

function formatUnits(u) { 
  if (u == null || !isFinite(u)) return '—'; 
  return state.rounding === 'int' ? Math.round(u).toString() : Number(u).toFixed(2); 
}

function formatMoney(m) { 
  return gbMoney.format(m); 
}

function formatMoney2(m) { 
  return gbMoney2.format(m); 
}

// Inputs + validation
function readInputs() {
  state.price = parseFloat($('#price').value) || 0;
  state.vc = parseFloat($('#vc').value) || 0;
  state.fc = parseFloat($('#fc').value) || 0;
  state.maxu = Math.max(10, parseFloat($('#maxu').value) || 100);
  state.rounding = $('#roundingMode').value;
  $('#priceS').value = state.price; 
  $('#vcS').value = state.vc; 
  $('#fcS').value = state.fc;
  validate();
}

function validate() {
  const errs = [];
  if (state.price <= 0) errs.push('Price should be greater than 0.');
  if (state.vc < 0) errs.push('Variable cost cannot be negative.');
  if (state.fc < 0) errs.push('Fixed cost cannot be negative.');
  if (state.price <= state.vc) errs.push('Price must be greater than variable cost, otherwise BEP is not defined.');
  state.invalid = errs.length > 0; 
  state.reason = errs.join(' ');
  $('#validation').textContent = state.invalid ? `Check inputs: ${state.reason}` : '';
}

// Maths
function bepUnits(p, v, f) { 
  const margin = p - v; 
  if (margin <= 0) return null; 
  return f / margin; 
}

function moneyAtTotalCost(u) { 
  return state.fc + state.vc * u; 
}

function moneyAtRevenue(u) { 
  return state.price * u; 
}

// Draw chart
function drawChart() {
  readInputs();
  const W = chart.clientWidth || 800; 
  const H = 460;
  const padL = 60, padB = 50, padT = 24, padR = 16;
  const innerW = W - padL - padR; 
  const innerH = H - padT - padB;
  chart.setAttribute('viewBox', `0 0 ${W} ${H}`); 
  chart.innerHTML = '';

  // axes
  const axes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const x = line(padL, H - padB, W - padR, H - padB, 'axis');
  const y = line(padL, padT, padL, H - padB, 'axis');
  axes.appendChild(x); 
  axes.appendChild(y);

  // ticks + labels
  const ticks = 5; 
  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const maxUnits = state.maxu;
  const maxMoneyRaw = Math.max(moneyAtTotalCost(maxUnits), moneyAtRevenue(maxUnits));
  const maxMoney = maxMoneyRaw * 1.1;
  const sx = (u) => padL + (u / maxUnits) * innerW;
  const sy = (m) => H - padB - (m / maxMoney) * innerH;

  for (let i = 0; i <= ticks; i++) {
    const u = (maxUnits / ticks) * i; 
    const m = (maxMoney / ticks) * i;
    const gx = sx(u); 
    const gy = H - padB - (innerH / ticks) * i;
    if (i > 0) grid.appendChild(line(gx, padT, gx, H - padB, 'gridline'));
    if (i > 0) grid.appendChild(line(padL, gy, W - padR, gy, 'gridline'));
    // labels
    const tx = text(gx, H - padB + 18, gbNum.format(u)); 
    tx.setAttribute('class', 'tick'); 
    tx.setAttribute('text-anchor', 'middle'); 
    grid.appendChild(tx);
    const ty = text(padL - 10, gy + 4, formatMoney(m)); 
    ty.setAttribute('class', 'tick'); 
    ty.setAttribute('text-anchor', 'end'); 
    grid.appendChild(ty);
  }

  // axis titles
  const xl = text(padL + innerW / 2, H - 10, 'Units (quantity)'); 
  xl.setAttribute('class', 'axis-label'); 
  xl.setAttribute('text-anchor', 'middle');
  const yl = text(16, padT + innerH / 2, 'Money (£)'); 
  yl.setAttribute('class', 'axis-label'); 
  yl.setAttribute('transform', `rotate(-90 16 ${padT + innerH / 2})`);
  chart.appendChild(grid); 
  chart.appendChild(axes); 
  chart.appendChild(xl); 
  chart.appendChild(yl);

  // fixed cost line
  const yFix = sy(state.fc);
  chart.appendChild(line(padL, yFix, W - padR, yFix, 'line-fixed', 'Fixed cost'));

  // total cost and revenue
  chart.appendChild(poly([[0, state.fc], [maxUnits, state.fc + state.vc * maxUnits]].map(([u,m])=> [sx(u), sy(m)]), 'line-total', 'Total cost'));
  chart.appendChild(poly([[0, 0], [maxUnits, state.price * maxUnits]].map(([u,m])=> [sx(u), sy(m)]), 'line-revenue', 'Total revenue'));

  // BEP
  const bu = bepUnits(state.price, state.vc, state.fc);
  let bepText = 'BEP: not defined';
  if (bu && isFinite(bu) && bu >= 0 && bu <= maxUnits) {
    const bm = moneyAtRevenue(bu);
    const cx = sx(bu), cy = sy(bm);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); 
    circle.setAttribute('cy', cy); 
    circle.setAttribute('r', 7);
    circle.setAttribute('class', 'bep'); 
    circle.setAttribute('role', 'img');
    circle.setAttribute('aria-label', `Break-even at ${Number(bu).toFixed(2)} units and ${formatMoney2(bm)}`);
    chart.appendChild(circle);
    bepText = `BEP: ${formatUnits(bu)} units | ${formatMoney2(bm)}`;
  }
  $('#bepTag').textContent = bepText;

  // Regions
  if (state.showRegions && !state.invalid) drawRegions({ padL, padR, padT, padB, innerW, maxUnits, sx, sy });

  // hit areas for questions
  addHitAreas({ sx, sy, padL, padR, padT, padB, innerW });

  // MOS visual if requested
  if ($('#showMosBtn').dataset.on === 'true') drawMos({ sx, sy, padL, padB, H });
}

function drawRegions(ctx) {
  const { padL, padR, padT, padB, innerW, maxUnits, sx, sy } = ctx;
  const bu = bepUnits(state.price, state.vc, state.fc); 
  if (!bu || !isFinite(bu)) return;
  const polyProfit = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  const polyLoss = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  const ptsProfit = [ [bu, state.fc + state.vc * bu], [maxUnits, state.fc + state.vc * maxUnits], [maxUnits, state.price * maxUnits], [bu, state.price * bu] ].map(([u,m]) => `${sx(u)},${sy(m)}`).join(' ');
  const ptsLoss = [ [0, 0], [0, state.fc], [bu, state.fc + state.vc * bu], [bu, state.price * bu] ].map(([u,m]) => `${sx(u)},${sy(m)}`).join(' ');
  polyProfit.setAttribute('points', ptsProfit); 
  polyLoss.setAttribute('points', ptsLoss);
  polyProfit.setAttribute('class', 'region-profit'); 
  polyLoss.setAttribute('class', 'region-loss');
  chart.insertBefore(polyLoss, chart.firstChild); 
  chart.insertBefore(polyProfit, chart.firstChild);
}

function drawMos(ctx) {
  const plan = parseFloat($('#plan').value) || 0; 
  const bu = bepUnits(state.price, state.vc, state.fc);
  const mos = bu == null ? null : plan - bu;
  const { sx, sy, padL, padB, H } = ctx;
  // clear old MOS elements
  chart.querySelectorAll('.mos-line, .mos-brace, .mos-label').forEach(n => n.remove());
  if (bu == null) { 
    $('#mosTag').textContent = 'MOS: —'; 
    return; 
  }
  const xPlan = sx(plan); 
  const xBep = sx(bu);
  // vertical at planned sales
  const v = line(xPlan, H - padB, xPlan, sy(0), 'mos-line'); 
  chart.appendChild(v);
  // brace between BEP and plan
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const y = H - padB + 4; 
  const x1 = Math.min(xBep, xPlan), x2 = Math.max(xBep, xPlan);
  path.setAttribute('d', `M ${x1} ${y} q 10 10 20 0 L ${x2 - 20} ${y} q 10 -10 20 0`);
  path.setAttribute('class', 'mos-brace'); 
  chart.appendChild(path);
  const lbl = text((x1 + x2) / 2, y + 18, `MOS ${formatUnits(mos)} units`); 
  lbl.setAttribute('class', 'mos-label'); 
  lbl.setAttribute('text-anchor', 'middle'); 
  chart.appendChild(lbl);
  $('#mosTag').textContent = `MOS: ${formatUnits(mos)} units`;
}

function line(x1, y1, x2, y2, cls, label) { 
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line'); 
  el.setAttribute('x1', x1); 
  el.setAttribute('y1', y1); 
  el.setAttribute('x2', x2); 
  el.setAttribute('y2', y2); 
  el.setAttribute('class', cls); 
  if (label) el.setAttribute('aria-label', label); 
  el.setAttribute('tabindex', -1); 
  return el; 
}

function poly(points, cls, label) { 
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); 
  el.setAttribute('points', points.map(p => p.join(',')).join(' ')); 
  el.setAttribute('fill', 'none'); 
  el.setAttribute('class', cls); 
  if (label) el.setAttribute('aria-label', label); 
  el.setAttribute('tabindex', -1); 
  return el; 
}

function text(x, y, str) { 
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text'); 
  el.setAttribute('x', x); 
  el.setAttribute('y', y); 
  el.textContent = str; 
  return el; 
}

// Questions
let currentQuestion = null; // 'fixed' | 'profit' | 'loss'

function addHitAreas(ctx) {
  const { padL, innerW } = ctx; 
  const yFix = ctx.sy(state.fc);
  const hitFix = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  hitFix.setAttribute('x', padL); 
  hitFix.setAttribute('y', yFix - 8); 
  hitFix.setAttribute('width', innerW); 
  hitFix.setAttribute('height', 16);
  hitFix.setAttribute('fill', 'transparent');
  hitFix.addEventListener('click', () => { 
    if (currentQuestion === 'fixed') correct('Fixed cost line selected.'); 
  });
  chart.appendChild(hitFix);
}

function ask(question) { 
  currentQuestion = question; 
  $('#checkMsg').textContent = 'Question active. Use the chart or toggle regions.'; 
}

function correct(msg) { 
  $('#checkMsg').textContent = `Correct. ${msg}`; 
  currentQuestion = null; 
}

// Buttons
$('#drawBtn').addEventListener('click', drawChart);
$('#markBepBtn').addEventListener('click', () => { 
  state.showRegions = true; 
  drawChart(); 
  $('#checkMsg').textContent = 'BEP shown on the chart.'; 
});
$('#toggleRegionsBtn').addEventListener('click', (e) => { 
  state.showRegions = !state.showRegions; 
  drawChart(); 
  e.currentTarget.setAttribute('aria-pressed', state.showRegions); 
  if (currentQuestion === 'profit' && state.showRegions) correct('Profit region is the green area to the right of BEP.'); 
  if (currentQuestion === 'loss' && state.showRegions) correct('Loss region is the red area to the left of BEP.'); 
});
$('#qFixedBtn').addEventListener('click', () => ask('fixed'));
$('#qProfitBtn').addEventListener('click', () => ask('profit'));
$('#qLossBtn').addEventListener('click', () => ask('loss'));

$('#calcBepBtn').addEventListener('click', () => { 
  readInputs(); 
  const bu = bepUnits(state.price, state.vc, state.fc); 
  if (!bu) { 
    $('#calcOut').textContent = 'No break-even if price is not greater than variable cost.'; 
    return; 
  } 
  const bm = state.price * bu; 
  $('#calcOut').textContent = `BEP = fixed costs / (price − variable cost) = ${state.fc} / (${state.price} − ${state.vc}) = ${formatUnits(bu)} units (${formatMoney2(bm)}).`; 
});

$('#calcMosBtn').addEventListener('click', () => { 
  readInputs(); 
  const plan = parseFloat($('#plan').value) || 0; 
  const bu = bepUnits(state.price, state.vc, state.fc); 
  if (!bu) { 
    $('#calcOut').textContent = 'Margin of safety not defined without a BEP.'; 
    $('#mosTag').textContent = 'MOS: —'; 
    return; 
  } 
  const mos = plan - bu; 
  $('#calcOut').textContent = `Margin of safety = planned sales − BEP = ${formatUnits(plan)} − ${formatUnits(bu)} = ${formatUnits(mos)} units.`; 
  $('#mosTag').textContent = `MOS: ${formatUnits(mos)} units`; 
});

$('#showMosBtn').addEventListener('click', (e) => { 
  const on = e.currentTarget.dataset.on === 'true' ? 'false' : 'true'; 
  e.currentTarget.dataset.on = on; 
  e.currentTarget.textContent = on === 'true' ? 'Hide margin of safety on chart' : 'Show margin of safety on chart'; 
  drawChart(); 
});

// Rounding mode change should redraw
$('#roundingMode').addEventListener('change', drawChart);

// Sliders live update
$('#priceS').addEventListener('input', (e) => { 
  $('#price').value = e.target.value; 
  drawChart(); 
});
$('#vcS').addEventListener('input', (e) => { 
  $('#vc').value = e.target.value; 
  drawChart(); 
});
$('#fcS').addEventListener('input', (e) => { 
  $('#fc').value = e.target.value; 
  drawChart(); 
});

// Reset
$('#resetBtn').addEventListener('click', () => { 
  $('#price').value = 10; 
  $('#vc').value = 4; 
  $('#fc').value = 1200; 
  $('#maxu').value = 400; 
  $('#plan').value = 250; 
  $('#formulaBox').value = ''; 
  $('#roundingMode').value = 'int'; 
  $('#showMosBtn').dataset.on = 'false'; 
  state.showRegions = false; 
  currentQuestion = null; 
  $('#checkMsg').textContent = ''; 
  $('#calcOut').textContent = ''; 
  $('#formulaOut').textContent = ''; 
  $('#validation').textContent = ''; 
  $('#bepTag').textContent = 'BEP: —'; 
  $('#mosTag').textContent = 'MOS: —'; 
  drawChart(); 
});

// Highlight buttons
document.querySelectorAll('[data-highlight]').forEach(btn => { 
  btn.addEventListener('mouseenter', () => highlight(btn.dataset.highlight, true)); 
  btn.addEventListener('mouseleave', () => highlight(btn.dataset.highlight, false)); 
  btn.addEventListener('focus', () => highlight(btn.dataset.highlight, true)); 
  btn.addEventListener('blur', () => highlight(btn.dataset.highlight, false)); 
});

function highlight(type, on) { 
  const map = { rev: '.line-revenue', tot: '.line-total', fix: '.line-fixed' }; 
  const el = chart.querySelector(map[type]); 
  if (!el) return; 
  el.style.strokeWidth = on ? '6' : '3'; 
}

// Card sort data
const ADV = [ 
  'Simple to understand and explain to non-specialists', 
  'Helps set sales targets and prices that cover costs', 
  'Supports what-if planning when costs or prices change', 
  'Helps identify required output before profit begins', 
  'Quick to produce with basic numbers', 
  'Useful for comparing products with different cost structures' 
];

const DIS = [ 
  'Assumes selling price and variable cost stay constant', 
  'Assumes everything made is sold', 
  'Harder to use with multiple products sharing costs', 
  'Ignores external factors like competition', 
  'Only a guide, not a guarantee of profit', 
  'Less accurate if costs are semi-variable or step-based' 
];

function buildSortCards() {
  const all = ADV.map(t => ({ text: t, type: 'adv' })).concat(DIS.map(t => ({ text: t, type: 'dis' })));
  for (let i = all.length - 1; i > 0; i--) { 
    const j = Math.floor(Math.random() * (i + 1)); 
    [all[i], all[j]] = [all[j], all[i]]; 
  }
  [...document.querySelectorAll('.card')].forEach(el => el.remove());
  const holder = document.createElement('div'); 
  holder.id = 'card-holder'; 
  holder.className = 'panel'; 
  holder.style.marginTop = '8px'; 
  holder.innerHTML = '<strong>Cards</strong>';
  $('#sorter').insertAdjacentElement('beforebegin', holder);
  all.forEach((item, idx) => { 
    const card = document.createElement('div'); 
    card.className = 'card'; 
    card.textContent = item.text; 
    card.tabIndex = 0; 
    card.dataset.type = item.type; 
    card.dataset.idx = String(idx); 
    card.addEventListener('keydown', (e) => { 
      if (e.key.toLowerCase() === 'a') { 
        $('#bin-adv').appendChild(card); 
      } 
      if (e.key.toLowerCase() === 'd') { 
        $('#bin-dis').appendChild(card); 
      } 
    }); 
    card.addEventListener('dragstart', (e) => { 
      e.dataTransfer.setData('text/plain', card.dataset.idx); 
    }); 
    card.setAttribute('draggable', 'true'); 
    holder.appendChild(card); 
  });
  ['bin-adv','bin-dis'].forEach(id => { 
    const bin = document.getElementById(id); 
    bin.addEventListener('dragover', (e) => e.preventDefault()); 
    bin.addEventListener('drop', (e) => { 
      e.preventDefault(); 
      const idx = e.dataTransfer.getData('text/plain'); 
      const card = document.querySelector(`.card[data-idx="${idx}"]`); 
      if (card) bin.appendChild(card); 
    }); 
  });
}

$('#checkSortBtn').addEventListener('click', () => { 
  const advPlaced = [...$('#bin-adv').querySelectorAll('.card')]; 
  const disPlaced = [...$('#bin-dis').querySelectorAll('.card')]; 
  let correct = 0, total = advPlaced.length + disPlaced.length; 
  advPlaced.forEach(c => { 
    if (c.dataset.type === 'adv') correct++; 
  }); 
  disPlaced.forEach(c => { 
    if (c.dataset.type === 'dis') correct++; 
  }); 
  $('#sortMsg').textContent = total ? `You placed ${correct} of ${total} correctly.` : 'Place some cards first.'; 
});

$('#revealSortBtn').addEventListener('click', () => { 
  document.querySelectorAll('.card').forEach(c => { 
    if (c.dataset.type === 'adv') $('#bin-adv').appendChild(c); 
    else $('#bin-dis').appendChild(c); 
  }); 
  $('#sortMsg').textContent = 'Model answers revealed.'; 
});



// Developer tests
function runTests() {
  const out = [];
  // Test 1: BEP with price 10, vc 4, fc 1200 -> 200 units
  const t1 = bepUnits(10, 4, 1200);
  out.push(t1 && Math.abs(t1 - 200) < 1e-9 ? '✓ BEP formula passes (expected 200 units).' : `✗ BEP formula failed (got ${t1}).`);
  // Test 2: No BEP when price <= vc
  const t2 = bepUnits(5, 5, 1000);
  out.push(t2 === null ? '✓ No BEP when price equals variable cost.' : '✗ Expected null BEP when price equals variable cost.');
  // Test 3: CSV structure lines
  const rows = [ ['price', 10], ['variable_cost', 4], ['fixed_cost', 1200], ['max_units', 400], ['bep_units', '200'], ['mos_units', '50'] ];
  const csv = 'key,value\n' + rows.map(r => r.join(',')).join('\n');
  const lines = csv.split('\n');
  out.push(lines[0] === 'key,value' ? '✓ CSV header correct.' : '✗ CSV header incorrect.');
  out.push(lines.length === 7 ? '✓ CSV has 7 lines including header.' : `✗ CSV line count wrong (got ${lines.length}).`);
  // Test 4: rounding mode
  state.rounding = 'int'; 
  out.push(formatUnits(200.49) === '200' ? '✓ Rounding int ok.' : '✗ Rounding int failed.');
  state.rounding = 'dp2'; 
  out.push(formatUnits(200.49) === '200.49' ? '✓ Rounding dp2 ok.' : '✗ Rounding dp2 failed.'); 
  state.rounding = 'int';
  // Test 5: validation
  state.price = 4; 
  state.vc = 5; 
  state.fc = 100; 
  validate(); 
  out.push(state.invalid ? '✓ Validation catches price <= variable cost.' : '✗ Validation failed to catch invalid inputs.');
  // Test 6: MOS negative case
  const bu2 = bepUnits(10, 4, 1200); 
  const mos2 = 150 - bu2; 
  out.push(mos2 < 0 ? '✓ MOS becomes negative when plan < BEP.' : '✗ MOS negative case failed.');
  document.getElementById('testOut').textContent = out.join('\n');
  // restore defaults
  state.price = 10; 
  state.vc = 4; 
  state.fc = 1200; 
  state.maxu = 400; 
  state.rounding = 'int'; 
  validate();
}

function init() { 
  drawChart(); 
  buildSortCards(); 
  runTests(); 
}

init();