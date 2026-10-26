const tasks = window.WORKSHOP_TASKS;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const list = (items) => `<ul>${items.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
const grid = document.getElementById('task-grid');
grid.innerHTML = tasks.map((task) => `<button class="task-card" data-task="${task.id}"><span class="task-meta"><span class="task-num">${task.id}</span><span>${task.level}</span></span><h3>${task.title}</h3><p>${task.mission}</p><b>לכרטיס המשימה ←</b></button>`).join('');
grid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-task]');
  if (card) location.hash = `task-${card.dataset.task}`;
});
function promptFor(task) {
  return `אני אחראית רק למשימה ${task.id}: ${task.title}. קראי את docs/tasks/${task.slug}.md, docs/CONTRACTS.md, docs/DESIGN.md ואת src/shared/types.ts. ממשי UI, לוגיקה ו־API בתחום שלי בלבד. אל תכתבי משימות אחרות ואל תשני קבצים משותפים. השתמשי ב־mock רק בבדיקות כשחסרה תלות. הוסיפי בדיקות והריצי npm test ו־npm run build. הציגי תקלות במפורש ואל תדווחי הצלחה מדומה.`;
}
function showTask() {
  const task = tasks.find((item) => `#task-${item.id}` === location.hash);
  if (!task) return;
  document.getElementById('guide').hidden = true;
  const detail = document.getElementById('task-detail');
  detail.hidden = false;
  document.querySelectorAll('[data-task]').forEach((card) => card.setAttribute('aria-current', String(card.dataset.task === task.id)));
  detail.innerHTML = `<div class="detail-header"><div><span class="eyebrow">משימה ${task.id} · ${task.level}</span><h2>${task.title}</h2><p>${task.mission}</p></div><div class="detail-actions"><a href="mockups.html#${task.id}" target="_blank" rel="noreferrer">הדמיה ↗</a><a href="cards/${task.slug}.md" download>Markdown ל־AI ↓</a><button id="print-card">הדפסה / PDF</button></div></div>
    <h3>גבול האחריות שלך</h3><p class="notice">${task.boundary}</p>
    <div class="code">git switch -c feature/${task.slug}<br>src/features/${task.slug}/Page.tsx${task.id === '05' ? '' : `<br>server/features/${task.slug}.ts`}</div>
    <div class="detail-grid"><section><h3>מה תבני ב־UI?</h3>${list(task.ui)}<h3>כללי המימוש</h3>${list(task.logic)}</section><section><h3>בדיקות קבלה</h3>${list(task.tests)}<h3>תלויות וחיבור</h3><p>${task.depends.length ? `נדרשות משימות ${task.depends.join(', ')}. בזמן המתנה: UI ובדיקות עם mocks בלבד, לא קוד של מישהי אחרת.` : 'אפשר להתחיל מול מסד הדוגמה בלי לחכות.'}</p><p>${task.provides}</p></section></div>
    <h3>חוזה HTTP</h3><p>ב־Router ללא /api; בלקוח עם /api. תשובות שגיאה לפי מסמך החוזים.</p><div class="table-wrap"><table class="api-table"><thead><tr><th>Method</th><th>Path</th><th>Request</th><th>Response</th></tr></thead><tbody>${task.api.map((row) => `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>התחלה עם AI</h3><pre class="prompt">${escapeHTML(promptFor(task))}</pre><button class="copy-prompt">העתקת ההנחיה</button><span id="copy-status" role="status"></span>
    <h3>הגשה</h3><div class="code">npm test<br>npm run build<br>npm run check:scope -- ${task.slug}</div><p>פתחי PR עם צילום מסך והוראות בדיקה. לא משנים קבצים משותפים. לא מעלים נתונים אמיתיים.</p><h3>הדגמה של חצי דקה</h3><p>${task.demo}</p>`;
  detail.querySelector('#print-card').onclick = () => print();
  detail.querySelector('.copy-prompt').onclick = async () => {
    const status = detail.querySelector('#copy-status');
    try { await navigator.clipboard.writeText(promptFor(task)); status.textContent = ' ההנחיה הועתקה'; }
    catch { status.textContent = ' לא ניתן להעתיק אוטומטית. סמני והעתיקי את הטקסט שלמעלה.'; }
  };
  detail.scrollIntoView({ block: 'start' });
}
function renderMarkdown(markdown) {
  let inCode = false;
  return markdown.split('\n').map((line) => {
    if (line.startsWith('```')) { inCode = !inCode; return inCode ? '<pre>' : '</pre>'; }
    const safe = escapeHTML(line);
    if (inCode) return safe + '\n';
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    if (heading) return `<h${heading[1].length}>${escapeHTML(heading[2])}</h${heading[1].length}>`;
    const content = safe.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (line.startsWith('- ')) return `<p>• ${content.slice(2)}</p>`;
    return line ? `<p>${content}</p>` : '';
  }).join('');
}
document.querySelectorAll('[data-guide]').forEach((button) => button.onclick = () => {
  document.getElementById('task-detail').hidden = true;
  const guide = document.getElementById('guide');
  guide.hidden = false;
  guide.innerHTML = renderMarkdown(window.WORKSHOP_GUIDES[button.dataset.guide]);
  guide.scrollIntoView();
});
addEventListener('hashchange', showTask);
showTask();
