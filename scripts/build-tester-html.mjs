// Builds the tester pages from TESTER_SCRIPT.md.
// Run: node scripts/build-tester-html.mjs
//   docs/testers/tester-{1,2,3}-*.html          three people (unchanged split)
//   docs/testers/one-tester.html                one person does every step
//   docs/testers/two-tester-1-hotel.html        two people: the hotel floor
//   docs/testers/two-tester-2-office.html       two people: the office
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const source = fs.readFileSync(path.join(root, 'TESTER_SCRIPT.md'), 'utf8').replace(/\r\n/g, '\n');
const outDir = path.join(root, 'docs', 'testers');
fs.mkdirSync(outDir, { recursive: true });

const TESTERS = [
  { letter: 'A', n: 1, role: 'Front desk, housekeeping, events, security', file: 'tester-1-front-desk.html' },
  { letter: 'B', n: 2, role: 'Stores, restaurant & bar, kitchen', file: 'tester-2-stores-restaurant.html' },
  { letter: 'C', n: 3, role: 'Settings, HR & payroll, accounting, tax', file: 'tester-3-back-office.html' },
];
const numOf = (l) => TESTERS.find((t) => t.letter === l).n;

// ---------- split the script into the parts each tester needs ----------

function chunks(text, level) {
  const marker = '#'.repeat(level) + ' ';
  const out = [];
  let cur = { heading: null, lines: [] };
  for (const line of text.split('\n')) {
    if (line.startsWith(marker)) {
      out.push(cur);
      cur = { heading: line.slice(marker.length).trim(), lines: [line] };
    } else cur.lines.push(line);
  }
  out.push(cur);
  return out.filter((c) => c.heading || c.lines.join('').trim());
}

function sectionOwner(heading) {
  const m = /Tester ([ABC])\b/.exec(heading) || /\(([ABC])[\s)]/.exec(heading);
  return m ? m[1] : null;
}

function textFor(letter) {
  return textForLetters([letter]);
}

function textForLetters(letters) {
  const set = new Set(letters);
  const parts = [];
  for (const h1 of chunks(source, 1)) {
    const h = h1.heading || '';
    if (/^Hotel system test/.test(h)) {
      // Intro: keep "How to use this script" (with its sub-sections); the owner's part stays out.
      for (const h2 of chunks(h1.lines.join('\n'), 2)) {
        if (h2.heading && /How to use/.test(h2.heading)) parts.push(h2.lines.join('\n'));
      }
    } else if (/^Day \d/.test(h)) {
      const subs = chunks(h1.lines.join('\n'), 2);
      const mine = subs.filter((s) => s.heading && set.has(sectionOwner(s.heading)));
      if (mine.length) parts.push(`# ${h}\n\n` + mine.map((s) => s.lines.join('\n')).join('\n'));
    } else {
      parts.push(h1.lines.join('\n'));
    }
  }
  return parts.join('\n\n');
}

function otherTester(mine, letter) {
  if (mine.has(letter)) return null;
  return mine.has('C') ? 'Tester 1' : 'Tester 2';
}

function retitle(text) {
  return text
    .replace(/## Day 1 morning: setting up \(C first\)/g, '## Day 1 morning')
    .replace(/## Day 1: Tester A \(front desk\)/g, '## Day 1 front desk')
    .replace(/## Day 1: Tester B \(stores and restaurant\)/g, '## Day 1 stores and restaurant')
    .replace(/## Day 1: Tester C \(back office\)/g, '## Day 1 back office')
    .replace(/## Day 1: end of day \(A\)/g, '## Day 1 end of day')
    .replace(/## Day (\d): Tester A\b/g, '## Day $1 front desk')
    .replace(/## Day (\d): Tester B\b/g, '## Day $1 stores and restaurant')
    .replace(/## Day (\d): Tester C\b/g, '## Day $1 back office');
}

function rewriteHandoffs(text, mine) {
  const lines = text.split('\n').flatMap((line) => {
    const waitOnly = /^\*Wait for ([ABC])/.exec(line.trim());
    if (waitOnly) {
      const who = otherTester(mine, waitOnly[1]);
      if (!who) return [];
      const step = /([ABC]\d+)/.exec(line);
      return [step ? `*Wait for ${who} to finish step ${step[1]}.*` : `*Wait for ${who}.*`];
    }
    let next = line;
    if (/Wait for B's Day 2/.test(next)) {
      const who = otherTester(mine, 'B');
      next = who
        ? next.replace(/\*Wait for B's Day 2 till close \(B21\)\.\*/, `*Wait for ${who} to finish step B21.*`)
        : next.replace(/\s*\*Wait for B's Day 2 till close \(B21\)\.\*/, '');
    }
    next = next.replace(/\*Wait for ([ABC])(\d+)\.\*/g, (_, letter, num) => {
      const who = otherTester(mine, letter);
      return who ? `*Wait for ${who} to finish step ${letter}${num}.*` : '';
    });
    if (/Tell A and B/.test(next)) {
      const who = otherTester(mine, 'A');
      next = who
        ? `**C5. 📣 Tell ${who}:** "Rooms and stock places are ready."`
        : '**C5. Setup is done.** Rooms and stock places are ready. Carry on with the next part.';
    }
    next = next.replace(/^(\d+\. )?📣 \*\*Tell ([ABC])\*\*([^\n]*)$/g, (_, num, letter, rest) => {
      const who = otherTester(mine, letter);
      return who ? `${num || ''}📣 **Tell ${who}**${rest}` : '';
    });
    next = next.replace(/when B says the delivery is in/g, () => {
      const who = otherTester(mine, 'B');
      return who
        ? `when ${who} says the delivery is in`
        : 'after you receive the goods in step B4. Come back to Visitors and log him out';
    });
    next = next.replace(/until C records the payment/g, () => {
      const who = otherTester(mine, 'C');
      return who ? `until ${who} records the payment` : 'until you record the payment in the accounting steps';
    });
    return [next];
  });
  return lines.join('\n');
}

function prepare(letters, mode) {
  let text = textForLetters(letters);
  text = text.replace(
    '- **Do only your own letter.** Each step starts with **A**, **B** or **C**.\n- **Wait** when a step says *wait for*. Another tester has to finish something first. Message them on WhatsApp (or call) when you finish a step that someone is waiting for. Those steps are marked **📣 Tell A / B / C**.',
    mode === 'solo'
      ? '- **Do every step from the top.** You are the only tester. One login is enough.\n- **Do not wait for anyone.** The steps are already in the order you should do them.'
      : '- **Do only the steps on this page.** The other person has the other page.\n- **Wait** only when a step says to wait for the other tester. Message them when you finish a step marked 📣.'
  );
  text = text.replace('# Answer sheet (C checks, everyone can use)', '# Answer sheet');
  text = text.replace(
    '1. Each tester sends the owner this script with ✅ / ❌ ticks and their notes.',
    mode === 'solo'
      ? '1. Press **Copy my results** and keep that note. The ticks stay in this browser too.'
      : '1. Each of you presses **Copy my results** and sends that note to the owner.'
  );
  text = rewriteHandoffs(retitle(text), new Set(letters));
  // Each part of the day is its own section, so the top links are not all called "Day 1".
  text = text.replace(/^# Day \d[^\n]*\n+/gm, '');
  text = text.replace(/^## Day /gm, '# Day ');
  return text;
}

function personalise(text, letter) {
  const n = numOf(letter);
  return text
    .replace(/- \*\*Do only your own letter\.\*\*[^\n]*/, `- **Do only your own steps.** You are **Tester ${n}**; your steps are numbered **${letter}1, ${letter}2, …**`)
    .replace(/📣 Tell A \/ B \/ C/g, '📣 Tell Tester …')
    .replace(/Tell ([ABC]) and ([ABC])/g, (_, x, y) => `Tell Tester ${numOf(x)} and Tester ${numOf(y)}`)
    .replace(/Tell ([ABC])\b/g, (_, x) => `Tell Tester ${numOf(x)}`)
    .replace(/Wait for ([ABC])(\d+)/g, (_, x, d) => `Wait for Tester ${numOf(x)} (step ${x}${d})`)
    .replace(/\b([ABC])'s\b/g, (_, x) => `Tester ${numOf(x)}'s`)
    .replace(/until C records/g, 'until Tester 3 records')
    .replace(/\(C checks, everyone can use\)/, '(Tester 3 checks; everyone can use it)')
    .replace(/when B says/g, 'when Tester 2 says')
    .replace(/\(([ABC])(\d+)\)/g, (_, x, d) => `(Tester ${numOf(x)}, step ${x}${d})`);
}

// ---------- a small Markdown renderer for what the script uses ----------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

function renderTable(rows) {
  const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  return `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

function renderList(lines) {
  // lines: [{indent, ordered, text, extra[]}]
  let html = '';
  const stack = [];
  const open = (item) => {
    const tag = item.ordered ? 'ol' : 'ul';
    stack.push({ indent: item.indent, tag });
    html += `<${tag}>`;
  };
  for (const item of lines) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) html += `</li></${stack.pop().tag}>`;
    if (!stack.length || item.indent > stack[stack.length - 1].indent) open(item);
    else html += '</li>';
    html += `<li>${inline(item.text)}${item.extra.map((e) => `<p>${inline(e)}</p>`).join('')}`;
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}

function render(md) {
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim() === '---') { i++; continue; }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue; }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      blocks.push({ type: 'html', html: renderTable(rows) });
      continue;
    }
    if (/^\s*(\d+\.|-) /.test(line)) {
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = /^(\s*)(\d+\.|-) (.*)$/.exec(l);
        if (m) { items.push({ indent: m[1].length, ordered: m[2] !== '-', text: m[3], extra: [] }); i++; continue; }
        if (l.trim() && /^\s+/.test(l) && !l.trim().startsWith('|')) { items[items.length - 1].extra.push(l.trim()); i++; continue; }
        if (!l.trim() && i + 1 < lines.length && /^\s+(\d+\.|-) |^\s{2,}\S/.test(lines[i + 1])) { i++; continue; }
        break;
      }
      blocks.push({ type: 'html', html: renderList(items) });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\s*(\d+\.|-) |\s*\|)/.test(lines[i]) && lines[i].trim() !== '---') para.push(lines[i++].trim());
    blocks.push({ type: 'p', text: para.join(' ') });
  }

  // Group blocks into step cards: a paragraph starting "**A12. Title.**" opens a card until the next step or heading.
  let html = '';
  let inStep = false;
  let daySlug = '';
  const days = [];
  const closeStep = () => { if (inStep) { html += '</div><div class="step-check"><button type="button" class="pass" aria-pressed="false">✅ Pass</button><button type="button" class="fail" aria-pressed="false">❌ Fail</button><textarea rows="2" placeholder="Notes: what you typed, what you saw, any message"></textarea></div></section>'; inStep = false; } };
  for (const b of blocks) {
    if (b.type === 'h') {
      closeStep();
      if (b.level === 1) {
        daySlug = b.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        days.push({ id: daySlug, title: b.text.replace(/[:(].*$/, '').replace(/["“”]/g, '').trim() });
        html += `<h2 id="${daySlug}" class="part">${inline(b.text)}</h2>`;
      } else html += `<h${b.level + 1}>${inline(b.text)}</h${b.level + 1}>`;
      continue;
    }
    if (b.type === 'p') {
      const step = /^\*\*([ABC]\d+)\. ([^*]+)\*\*\s*(.*)$/.exec(b.text);
      if (step) {
        closeStep();
        inStep = true;
        html += `<section class="step" data-step="${step[1]}"><div class="step-body"><h4><span class="sid">${step[1]}</span> ${inline(step[2].replace(/\.$/, ''))}</h4>${step[3] ? `<p>${inline(step[3])}</p>` : ''}`;
        continue;
      }
      const cls = /^📣/.test(b.text) ? ' class="shout"' : /^\*Wait for/.test(b.text) ? ' class="wait"' : '';
      html += `<p${cls}>${inline(b.text)}</p>`;
      continue;
    }
    html += b.html;
  }
  closeStep();
  return { html, days };
}

// ---------- page ----------

function page(t) {
  const { html, days } = render(t.markdown || personalise(textFor(t.letter), t.letter));
  const nav = days.map((d) => `<a href="#${d.id}">${esc(d.title)}</a>`).join('');
  const who = t.who || `Tester ${t.n}`;
  const storage = t.storage || `hotelTest.tester${t.n}.v1`;
  const copyLabel = t.copyLabel || `Hotel test: Tester ${t.n}`;
  const intro = t.intro || `<p><strong>You are Tester ${t.n}</strong> (${esc(t.role)}). Your steps are numbered <strong>${t.letter}1, ${t.letter}2, …</strong>. This page shows only your steps.</p>
<p>Under each step, press <strong>✅ Pass</strong> or <strong>❌ Fail</strong>. If it fails, write what happened in the box. This browser remembers your ticks.</p>
<p>At the end of each day, press <strong>Copy my results</strong> and paste the result into WhatsApp for the owner.</p>
<p>Your name: <input id="tname" style="font:inherit;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text)" placeholder="Type your name"></p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title || `Tester ${t.n} Script`)}</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1d2330;--muted:#5b6475;--line:#e3e6ec;--accent:#1f6feb;--accent-soft:#e8f0fe;--pass:#1a7f37;--pass-soft:#e6f4ea;--fail:#c62828;--fail-soft:#fdecea;--shout:#fff6db;--wait:#eef2f7;--th:#f0f2f6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1216;--card:#171b21;--text:#e6e9ef;--muted:#9aa3b2;--line:#2a313b;--accent:#58a6ff;--accent-soft:#132339;--pass:#3fb950;--pass-soft:#12261a;--fail:#f47067;--fail-soft:#2d1615;--shout:#2b2412;--wait:#1b2129;--th:#1d232b}}
:root[data-theme="dark"]{--bg:#0f1216;--card:#171b21;--text:#e6e9ef;--muted:#9aa3b2;--line:#2a313b;--accent:#58a6ff;--accent-soft:#132339;--pass:#3fb950;--pass-soft:#12261a;--fail:#f47067;--fail-soft:#2d1615;--shout:#2b2412;--wait:#1b2129;--th:#1d232b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px}
.bar{max-width:880px;margin:0 auto;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.who{font-weight:700}.who small{display:block;font-weight:400;color:var(--muted)}
.progress{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--muted)}
.meter{flex-basis:100%;height:6px;background:var(--line);border-radius:3px;overflow:hidden}.meter i{display:block;height:100%;width:0;background:var(--pass);transition:width .2s}
nav{flex-basis:100%;display:flex;gap:6px;overflow-x:auto}nav a{white-space:nowrap;padding:4px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);text-decoration:none;font-size:14px}
.actions{display:flex;gap:8px}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:8px;padding:6px 12px}
button:hover{border-color:var(--accent)}
main{max-width:880px;margin:0 auto;padding:16px}
h1{font-size:26px;margin:8px 0 4px}h2.part{margin:36px 0 10px;padding-top:8px;border-top:3px solid var(--accent);font-size:24px}
h2{font-size:20px}h3{font-size:18px;margin:26px 0 8px}h4{margin:0 0 6px;font-size:17px}
.intro{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.step{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:12px;margin:12px 0;overflow:hidden}
.step[data-result="pass"]{border-left-color:var(--pass)}.step[data-result="fail"]{border-left-color:var(--fail)}
.step-body{padding:12px 16px 4px}.sid{display:inline-block;min-width:2.6em;padding:1px 8px;margin-right:6px;border-radius:6px;background:var(--accent-soft);color:var(--accent);font-size:14px;text-align:center}
.step-check{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px 14px;border-top:1px dashed var(--line)}
.step-check textarea{flex-basis:100%;font:inherit;font-size:14px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);resize:vertical}
.pass[aria-pressed="true"]{background:var(--pass-soft);border-color:var(--pass);color:var(--pass);font-weight:600}
.fail[aria-pressed="true"]{background:var(--fail-soft);border-color:var(--fail);color:var(--fail);font-weight:600}
p.shout{background:var(--shout);padding:8px 12px;border-radius:8px}p.wait{background:var(--wait);padding:8px 12px;border-radius:8px;font-style:normal}
.table-wrap{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:14px;background:var(--card)}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--th)}
td:last-child,th:last-child{white-space:nowrap}
ol,ul{padding-left:22px}li{margin:3px 0}li p{margin:4px 0}
code{background:var(--th);padding:0 4px;border-radius:4px}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:8px 14px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.show{opacity:1}
@media print{header,.step-check button,.actions{display:none}.step-check textarea{border:none}body{background:#fff;color:#000}.step{break-inside:avoid}}
@media (max-width:600px){main{padding:12px 16px}h1{font-size:22px}.progress{margin-left:0}}
</style>
</head>
<body>
<header><div class="bar">
  <div class="who">${esc(who)} <small>${esc(t.role)}</small></div>
  <div class="progress"><span id="done">0</span> / <span id="total">0</span> steps checked · <span id="fails">0</span> failed</div>
  <div class="actions"><button type="button" id="copy">Copy my results</button><button type="button" onclick="window.print()">Print</button></div>
  <div class="meter"><i id="meter"></i></div>
  <nav><a href="#top">Start</a>${nav}</nav>
</div></header>
<main id="top">
<h1>${esc(t.heading || `Hotel system test: Tester ${t.n}`)}</h1>
<div class="intro">${intro}</div>
${html}
</main>
<div class="toast" id="toast"></div>
<script>
(function(){
  var KEY='${storage}', state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){state={};}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
  var steps=[].slice.call(document.querySelectorAll('.step'));
  var name=document.getElementById('tname'); name.value=state.__name||''; name.addEventListener('input',function(){state.__name=name.value;save();});
  function paint(){var done=0,fails=0;steps.forEach(function(s){var r=(state[s.dataset.step]||{}).result;s.dataset.result=r||'';s.querySelector('.pass').setAttribute('aria-pressed',r==='pass');s.querySelector('.fail').setAttribute('aria-pressed',r==='fail');if(r)done++;if(r==='fail')fails++;});
    document.getElementById('done').textContent=done;document.getElementById('total').textContent=steps.length;document.getElementById('fails').textContent=fails;document.getElementById('meter').style.width=(steps.length?done/steps.length*100:0)+'%';}
  steps.forEach(function(s){var id=s.dataset.step,rec=state[id]||(state[id]={}),ta=s.querySelector('textarea');ta.value=rec.note||'';
    ta.addEventListener('input',function(){rec.note=ta.value;save();});
    s.querySelector('.pass').addEventListener('click',function(){rec.result=rec.result==='pass'?'':'pass';save();paint();});
    s.querySelector('.fail').addEventListener('click',function(){rec.result=rec.result==='fail'?'':'fail';save();paint();if(rec.result==='fail')ta.focus();});});
  paint();
  function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2200);}
  document.getElementById('copy').addEventListener('click',function(){
    var lines=['${copyLabel.replace(/'/g, "\\'")}'+(state.__name?' ('+state.__name+')':''),new Date().toLocaleString(),''];
    steps.forEach(function(s){var rec=state[s.dataset.step]||{};var title=s.querySelector('h4').textContent.trim();
      lines.push((rec.result==='pass'?'✅':rec.result==='fail'?'❌':'⬜')+' '+title+(rec.note?' | '+rec.note.trim():''));});
    var text=lines.join('\\n');
    (navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(function(){toast('Copied. Paste it into WhatsApp.');},function(){window.prompt('Copy this:',text);});
  });
})();
</script>
</body>
</html>
`;
}

const nameField = `<p>Your name: <input id="tname" style="font:inherit;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text)" placeholder="Type your name"></p>`;
const tickHelp = `<p>Under each step, press <strong>✅ Pass</strong> or <strong>❌ Fail</strong>. If it fails, write what happened in the box. This browser remembers your ticks.</p>
<p>At the end of a day, press <strong>Copy my results</strong>.</p>
${nameField}`;

const EXTRA = [
  {
    file: 'one-tester.html',
    title: 'One tester',
    heading: 'Hotel system test: just you',
    who: 'Just you',
    role: 'Front desk, restaurant, stores and accounts',
    storage: 'hotelTest.one.v1',
    copyLabel: 'Hotel test: one tester',
    markdown: prepare(['A', 'B', 'C'], 'solo'),
    intro: `<p><strong>This test is for one person: you.</strong> You do the front desk, the restaurant and the stores, then the accounts. Work from the top of the page to the bottom, over three days. One login is enough.</p>
<p>Before Day 1, open <strong>System Settings → Sample Data</strong>. It must say <strong>No sample data loaded</strong>. If old test records are there, press <strong>Clear test data</strong> first.</p>
${tickHelp}`,
  },
  {
    file: 'two-tester-1-hotel.html',
    title: 'Tester 1 of 2',
    heading: 'Hotel system test: Tester 1 of 2',
    who: 'Tester 1 of 2',
    role: 'Front desk, housekeeping, events, stores, restaurant and kitchen',
    storage: 'hotelTest.two1.v1',
    copyLabel: 'Hotel test: Tester 1 of 2',
    markdown: prepare(['A', 'B'], 'pair'),
    intro: `<p><strong>You are Tester 1 of 2.</strong> You run the hotel: front desk, housekeeping, events, security, stores, restaurant and kitchen. Your steps are numbered <strong>A</strong> and <strong>B</strong>.</p>
<p>Tester 2 sets up the rooms and the tax first, then checks the accounts. Wait only when a step says to wait for Tester 2. When a step says 📣, message Tester 2.</p>
${tickHelp}`,
  },
  {
    file: 'two-tester-2-office.html',
    title: 'Tester 2 of 2',
    heading: 'Hotel system test: Tester 2 of 2',
    who: 'Tester 2 of 2',
    role: 'Settings, HR and payroll, accounting, tax',
    storage: 'hotelTest.two2.v1',
    copyLabel: 'Hotel test: Tester 2 of 2',
    markdown: prepare(['C'], 'pair'),
    intro: `<p><strong>You are Tester 2 of 2.</strong> You run the office: settings, staff, accounts and tax. Your steps are numbered <strong>C</strong>.</p>
<p>Do the Day 1 morning setup first, then tell Tester 1 the rooms are ready. After that, wait when a step says Tester 1 has to finish something.</p>
${tickHelp}`,
  },
];

for (const t of [...TESTERS, ...EXTRA]) {
  const file = path.join(outDir, t.file);
  fs.writeFileSync(file, page(t));
  const steps = (fs.readFileSync(file, 'utf8').match(/class="step" data-step=/g) || []).length;
  console.log(`${t.file}: ${steps} steps`);
}
