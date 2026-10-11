const $ = (selector) => document.querySelector(selector);

const elements = {
  input: $('#jsonInput'),
  file: $('#fileInput'),
  dropzone: $('#dropzone'),
  process: $('#processButton'),
  sample: $('#sampleButton'),
  chars: $('#charCount'),
  pill: $('#statusPill'),
  empty: $('#statusEmpty'),
  result: $('#statusResult'),
  title: $('#resultTitle'),
  message: $('#resultMessage'),
  repairs: $('#repairsList'),
  results: $('#results'),
  table: $('#previewTable'),
  tableView: $('#tableView'),
  treeView: $('#treeView'),
  previewTabs: document.querySelectorAll('.preview-tab'),
  jsonTree: $('#jsonTree'),
  treeSummary: $('#treeSummary'),
  expandTree: $('#expandTreeButton'),
  collapseTree: $('#collapseTreeButton'),
  rowCount: $('#rowCount'),
  columnCount: $('#columnCount'),
  note: $('#tableNote'),
  download: $('#downloadButton'),
  downloadJson: $('#downloadJsonButton'),
  toast: $('#toast')
};

let prepared = null;
let toastTimer;

const sampleJson = `[
  { name: 'Asha Rao', role: 'Designer', active: true, score: 94, },
  { name: 'Noah Kim', role: 'Engineer', active: true, score: 89, },
  { name: 'Mei Tan', role: 'Analyst', active: false, score: 92, },
]`;

function updateCharacterCount() {
  const length = elements.input.value.length;
  elements.chars.textContent = `${length.toLocaleString()} character${length === 1 ? '' : 's'}`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2800);
}

function setStatus(type, title, message, repairs = []) {
  elements.empty.classList.add('hidden');
  elements.result.classList.remove('hidden');
  elements.pill.className = `status-pill ${type}`;
  elements.pill.textContent = type === 'success' ? 'Ready to export' : 'Needs attention';
  elements.title.textContent = title;
  elements.message.textContent = message;
  elements.repairs.innerHTML = '';
  repairs.forEach((repair) => {
    const item = document.createElement('li');
    item.textContent = repair;
    elements.repairs.appendChild(item);
  });
}

function resetStatus() {
  elements.pill.className = 'status-pill neutral';
  elements.pill.textContent = 'Waiting';
  elements.empty.classList.remove('hidden');
  elements.result.classList.add('hidden');
}

function stripCodeFence(text) {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

function removeComments(text) {
  let output = '';
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") { inString = true; quote = char; output += char; }
    else if (char === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i += 1; output += '\n'; }
    else if (char === '/' && next === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1; i += 1; }
    else output += char;
  }
  return output;
}

function removeTrailingCommas(text) {
  let output = '';
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") { inString = true; quote = char; output += char; continue; }
    if (char === ',') {
      let cursor = i + 1;
      while (/\s/.test(text[cursor] || '')) cursor += 1;
      if (text[cursor] === '}' || text[cursor] === ']') continue;
    }
    output += char;
  }
  return output;
}

function convertSingleQuotedStrings(text) {
  let output = '';
  let inDouble = false;
  let inSingle = false;
  let buffer = '';
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inSingle) {
      if (escaped) { buffer += char === '"' ? '\\"' : char; escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === "'") { output += `"${buffer.replace(/"/g, '\\"')}"`; buffer = ''; inSingle = false; continue; }
      buffer += char;
      continue;
    }
    if (inDouble) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inDouble = false;
      continue;
    }
    if (char === '"') { inDouble = true; output += char; }
    else if (char === "'") { inSingle = true; buffer = ''; }
    else output += char;
  }
  return inSingle ? text : output;
}

function quoteBareKeys(text) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; output += char; continue; }
    if (char === '{' || char === ',') {
      const remainder = text.slice(i + 1);
      const match = remainder.match(/^(\s*)([A-Za-z_$][\w$.-]*)(\s*:)/);
      if (match) {
        output += char + match[1] + `"${match[2]}"` + match[3];
        i += match[0].length;
        continue;
      }
    }
    output += char;
  }
  return output;
}

function repairJson(raw) {
  const repairs = [];
  let cleaned = raw.replace(/^\uFEFF/, '');
  const fenced = stripCodeFence(cleaned);
  if (fenced !== cleaned) { cleaned = fenced; repairs.push('Removed a markdown code fence'); }
  const normalizedQuotes = cleaned.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u00a0/g, ' ');
  if (normalizedQuotes !== cleaned) { cleaned = normalizedQuotes; repairs.push('Normalized smart quotes'); }
  const noComments = removeComments(cleaned);
  if (noComments !== cleaned) { cleaned = noComments; repairs.push('Removed comments'); }
  const convertedSingleQuotes = convertSingleQuotedStrings(cleaned);
  if (convertedSingleQuotes !== cleaned) { cleaned = convertedSingleQuotes; repairs.push('Converted single-quoted strings'); }
  const quotedKeys = quoteBareKeys(cleaned);
  if (quotedKeys !== cleaned) { cleaned = quotedKeys; repairs.push('Added quotes around field names'); }
  const noTrailing = removeTrailingCommas(cleaned);
  if (noTrailing !== cleaned) { cleaned = noTrailing; repairs.push('Removed trailing commas'); }
  return { cleaned: cleaned.trim(), repairs };
}

function parseInput(raw) {
  try { return { data: JSON.parse(raw), repairs: [] }; } catch (originalError) {
    const attempt = repairJson(raw);
    try { return { data: JSON.parse(attempt.cleaned), repairs: attempt.repairs }; } catch (repairError) {
      const lines = raw.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        try {
          const parsedLines = lines.map((line) => JSON.parse(repairJson(line).cleaned));
          return { data: parsedLines, repairs: ['Detected newline-delimited JSON and converted each line'] };
        } catch (_) { /* use readable error below */ }
      }
      const location = /position (\d+)/.exec(repairError.message);
      const hint = location ? ` near character ${Number(location[1]).toLocaleString()}` : '';
      throw new Error(`We could not safely repair this JSON${hint}. Check for a missing quote, bracket, or comma and try again.`);
    }
  }
}

function valueForCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function flattenObject(value, prefix = '', result = {}) {
  if (value === null || value === undefined) { result[prefix || 'value'] = ''; return result; }
  if (Array.isArray(value)) { result[prefix || 'value'] = value.map(valueForCell).join(' | '); return result; }
  if (typeof value !== 'object') { result[prefix || 'value'] = value; return result; }
  const entries = Object.entries(value);
  if (!entries.length && prefix) result[prefix] = '';
  entries.forEach(([key, item]) => flattenObject(item, prefix ? `${prefix}.${key}` : key, result));
  return result;
}

function findBestArray(object) {
  const arrays = Object.entries(object).filter(([, value]) => Array.isArray(value));
  if (!arrays.length) return null;
  return arrays.sort(([, a], [, b]) => b.length - a.length)[0];
}

function makeRows(data) {
  let source = data;
  let sourceDescription = '';
  if (!Array.isArray(data) && data && typeof data === 'object') {
    const arrayEntry = findBestArray(data);
    if (arrayEntry) { source = arrayEntry[1]; sourceDescription = `Using the “${arrayEntry[0]}” list`; }
  }
  const list = Array.isArray(source) ? source : [source];
  const rows = list.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) return flattenObject(item);
    return { value: valueForCell(item) };
  });
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { rows, columns, sourceDescription };
}

function renderPreview(rows, columns) {
  elements.table.innerHTML = '';
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columns.forEach((column) => { const th = document.createElement('th'); th.textContent = column; headerRow.appendChild(th); });
  head.appendChild(headerRow);
  const body = document.createElement('tbody');
  rows.slice(0, 100).forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((column) => { const td = document.createElement('td'); const value = valueForCell(row[column]); td.textContent = value; td.title = value; tr.appendChild(td); });
    body.appendChild(tr);
  });
  elements.table.append(head, body);
  elements.rowCount.textContent = `${rows.length.toLocaleString()} row${rows.length === 1 ? '' : 's'}`;
  elements.columnCount.textContent = `${columns.length} column${columns.length === 1 ? '' : 's'}`;
  elements.note.textContent = rows.length > 100 ? 'Showing the first 100 rows. Your Excel export will include every row.' : 'This is exactly how your data will be organized in Excel.';
}

function truncateText(value, limit = 240) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function treeValue(value) {
  if (value === null) return { type: 'null', text: 'null' };
  if (typeof value === 'string') return { type: 'string', text: truncateText(JSON.stringify(value)) };
  return { type: typeof value, text: String(value) };
}

function treeNodeCount(value, cap = 1200) {
  let count = 0;
  const visit = (item) => {
    if (count >= cap) return;
    count += 1;
    if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return count;
}

function renderTreeItem(key, value, depth = 0) {
  const isContainer = value !== null && typeof value === 'object';
  if (!isContainer) {
    const item = document.createElement('div');
    item.className = 'tree-leaf';
    const keyLabel = document.createElement('span');
    keyLabel.className = 'tree-key';
    keyLabel.textContent = key;
    const display = treeValue(value);
    const content = document.createElement('span');
    content.className = `tree-value ${display.type}`;
    content.textContent = ` ${display.text}`;
    item.append(keyLabel, content);
    return item;
  }

  const details = document.createElement('details');
  details.className = 'tree-node';
  details.open = depth < 2;
  const summary = document.createElement('summary');
  const keyLabel = document.createElement('span');
  keyLabel.className = 'tree-key';
  keyLabel.textContent = key;
  const meta = document.createElement('span');
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;
  meta.className = 'tree-meta';
  meta.textContent = Array.isArray(value) ? `Array(${count})` : `Object {${count}}`;
  summary.append(keyLabel, meta);
  const children = document.createElement('div');
  children.className = 'tree-node-children';
  const entries = Array.isArray(value) ? value.map((item, index) => [`[${index}]`, item]) : Object.entries(value);
  const displayed = entries.slice(0, 100);
  displayed.forEach(([childKey, childValue]) => children.appendChild(renderTreeItem(childKey, childValue, depth + 1)));
  if (entries.length > displayed.length) {
    const more = document.createElement('div');
    more.className = 'tree-truncated';
    more.textContent = `… ${entries.length - displayed.length} more item${entries.length - displayed.length === 1 ? '' : 's'}`;
    children.appendChild(more);
  }
  details.append(summary, children);
  return details;
}

function renderJsonTree(data) {
  elements.jsonTree.innerHTML = '';
  const rootName = Array.isArray(data) ? 'root' : 'root';
  elements.jsonTree.appendChild(renderTreeItem(rootName, data));
  const nodes = treeNodeCount(data);
  elements.treeSummary.textContent = nodes >= 1200 ? '1,200+ nodes · large structures are shortened' : `${nodes.toLocaleString()} node${nodes === 1 ? '' : 's'} · expand any branch`;
}

function switchPreview(view) {
  const showTree = view === 'tree';
  elements.tableView.classList.toggle('hidden', showTree);
  elements.treeView.classList.toggle('hidden', !showTree);
  elements.previewTabs.forEach((tab) => {
    const active = tab.dataset.preview === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function processJson() {
  const raw = elements.input.value.trim();
  if (!raw) { showToast('Add a JSON file or paste data first.'); elements.input.focus(); return; }
  try {
    const parsed = parseInput(raw);
    const table = makeRows(parsed.data);
    if (!table.rows.length || !table.columns.length) throw new Error('This JSON does not contain any rows or fields we can export.');
    prepared = { ...parsed, ...table };
    renderPreview(prepared.rows, prepared.columns);
    renderJsonTree(prepared.data);
    switchPreview('table');
    const repairText = parsed.repairs.length ? `${parsed.repairs.length} safe repair${parsed.repairs.length === 1 ? '' : 's'} applied.` : 'The format is valid as-is.';
    setStatus('success', 'Your JSON is ready', `${table.rows.length.toLocaleString()} rows and ${table.columns.length} columns are ready for Excel. ${repairText}`, [ ...(table.sourceDescription ? [table.sourceDescription] : []), ...parsed.repairs, 'Flattened nested fields into spreadsheet columns' ]);
    elements.results.classList.remove('hidden');
    elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    prepared = null;
    elements.results.classList.add('hidden');
    setStatus('error', 'We found a formatting issue', error.message, ['Tip: JSON needs matching { } or [ ] brackets', 'Try removing extra commas or adding missing quotes']);
  }
}

function formatSheet(sheet, columns, rowLength) {
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(columns.length - 1)}${Math.max(rowLength + 1, 1)}` };
  sheet['!cols'] = columns.map((key) => ({ wch: Math.min(Math.max(key.length + 2, 13), 30) }));
  columns.forEach((_, index) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })];
    if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'D2674D' } }, alignment: { horizontal: 'left' } };
  });
}

function downloadExcel() {
  if (!prepared) return;
  if (typeof XLSX === 'undefined') { showToast('Excel export library is still loading. Please try again in a moment.'); return; }
  const sheet = XLSX.utils.json_to_sheet(prepared.rows, { header: prepared.columns });
  formatSheet(sheet, prepared.columns, prepared.rows.length);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'JSON data');
  XLSX.writeFile(workbook, 'jsonly-export.xlsx', { compression: true });
  showToast('Your Excel file is downloading.');
}

function downloadCleanJson() {
  if (!prepared) return;
  const content = JSON.stringify(prepared.data, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  link.download = 'jsonly-cleaned.json';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Your cleaned JSON is downloading.');
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast('Please choose a file smaller than 10 MB.'); return; }
  try {
    elements.input.value = await file.text();
    updateCharacterCount();
    showToast(`${file.name} is ready to validate.`);
    processJson();
  } catch (_) { showToast('We could not read that file. Please try another file.'); }
}

elements.input.addEventListener('input', () => {
  updateCharacterCount();
  if (prepared) {
    prepared = null;
    elements.results.classList.add('hidden');
    resetStatus();
  }
});
elements.process.addEventListener('click', processJson);
elements.sample.addEventListener('click', () => { elements.input.value = sampleJson; updateCharacterCount(); processJson(); });
elements.file.addEventListener('change', (event) => loadFile(event.target.files[0]));
elements.download.addEventListener('click', downloadExcel);
elements.downloadJson.addEventListener('click', downloadCleanJson);
elements.previewTabs.forEach((tab) => tab.addEventListener('click', () => switchPreview(tab.dataset.preview)));
elements.expandTree.addEventListener('click', () => elements.jsonTree.querySelectorAll('details').forEach((node) => { node.open = true; }));
elements.collapseTree.addEventListener('click', () => elements.jsonTree.querySelectorAll('details').forEach((node) => { node.open = false; }));
['dragenter', 'dragover'].forEach((eventName) => elements.dropzone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropzone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => elements.dropzone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropzone.classList.remove('is-dragging'); }));
elements.dropzone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));
elements.dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.file.click(); } });
updateCharacterCount();
