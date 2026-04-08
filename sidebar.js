// sidebar.js - 侧边栏逻辑

// 跨浏览器兼容
const extAPI = typeof browser !== 'undefined' ? browser : chrome;

let allAnnotations = [];
let currentFilter = { sort: 'time', color: null, search: '' };

document.addEventListener('DOMContentLoaded', () => {
  loadAnnotations();
  setupEventListeners();
});

async function loadAnnotations() {
  const data = await sendMessage({ action: 'getAll' });
  allAnnotations = [];
  for (const [url, items] of Object.entries(data || {})) {
    for (const item of items) {
      allAnnotations.push({ ...item, url });
    }
  }
  renderAnnotations();
}

function sendMessage(message) {
  return new Promise(resolve => {
    extAPI.runtime.sendMessage(message, resolve);
  });
}

function renderAnnotations() {
  const list = document.getElementById('annotationsList');
  const stats = document.getElementById('stats');
  const { sort, color, search } = currentFilter;

  let filtered = allAnnotations;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.selectedText.toLowerCase().includes(q) ||
      (a.text && a.text.toLowerCase().includes(q)) ||
      a.url.toLowerCase().includes(q)
    );
  }
  if (color) {
    filtered = filtered.filter(a => a.color === color);
  }

  if (sort === 'time') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const totalCount = allAnnotations.length;
  const shownCount = filtered.length;
  stats.textContent = search || color
    ? `共 ${totalCount} 条，显示 ${shownCount} 条`
    : `共 ${totalCount} 条标注`;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <p>${search || color ? '没有匹配的标注' : '还没有标注'}</p>
      </div>`;
    return;
  }

  if (sort === 'page') {
    renderGroupedByPage(filtered, list);
  } else {
    renderFlat(filtered, list);
  }
}

function renderFlat(items, container) {
  container.innerHTML = items.map(ann => `
    <div class="annotation-item" data-id="${ann.id}" data-url="${escapeAttr(ann.url)}">
      <div class="url">${formatUrl(ann.url)}</div>
      <div class="text" style="border-left-color:${ann.color || '#ffeb3b'}">"${escapeHtml(ann.selectedText)}"</div>
      ${ann.text ? `<div class="note">${escapeHtml(ann.text)}</div>` : ''}
      <div class="meta">
        <span class="date">${formatDate(ann.createdAt)}</span>
        <div class="actions">
          <button class="go-to">跳转</button>
          <button class="delete">删除</button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.go-to').forEach((btn, i) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      goToAnnotation(items[i].url, items[i].id);
    });
  });
  container.querySelectorAll('.delete').forEach((btn, i) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAnnotation(items[i].url, items[i].id);
    });
  });
}

function renderGroupedByPage(items, container) {
  const groups = {};
  items.forEach(ann => {
    if (!groups[ann.url]) groups[ann.url] = [];
    groups[ann.url].push(ann);
  });

  let html = '';
  for (const [url, anns] of Object.entries(groups)) {
    html += `<div style="padding:8px 16px;background:#f0f0f0;font-size:12px;color:#888;border-bottom:1px solid #e0e0e0;">
      ${formatUrl(url)} (${anns.length})
    </div>`;
    html += anns.map(ann => `
      <div class="annotation-item" data-id="${ann.id}" data-url="${escapeAttr(ann.url)}">
        <div class="text" style="border-left-color:${ann.color || '#ffeb3b'}">"${escapeHtml(ann.selectedText)}"</div>
        ${ann.text ? `<div class="note">${escapeHtml(ann.text)}</div>` : ''}
        <div class="meta">
          <span class="date">${formatDate(ann.createdAt)}</span>
          <div class="actions">
            <button class="go-to">跳转</button>
            <button class="delete">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }
  container.innerHTML = html;

  container.querySelectorAll('.go-to').forEach((btn, i) => {
    const ann = items[i];
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      goToAnnotation(ann.url, ann.id);
    });
  });
  container.querySelectorAll('.delete').forEach((btn, i) => {
    const ann = items[i];
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAnnotation(ann.url, ann.id);
    });
  });
}

async function goToAnnotation(url, annotationId) {
  const [tab] = await extAPI.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    extAPI.tabs.update(tab.id, { url }, () => {
      setTimeout(() => {
        extAPI.tabs.sendMessage(tab.id, { action: 'scrollToAnnotation', annotationId });
      }, 1500);
    });
  }
}

async function deleteAnnotation(url, annotationId) {
  if (!confirm('确定删除？')) return;
  await sendMessage({ action: 'delete', url, annotationId });
  loadAnnotations();
}

function exportAsMarkdown() {
  let md = '# Web Annotator 标注导出\n\n';
  md += `> ${new Date().toLocaleString()} | 共 ${allAnnotations.length} 条\n\n---\n\n`;

  const groups = {};
  allAnnotations.forEach(ann => {
    if (!groups[ann.url]) groups[ann.url] = [];
    groups[ann.url].push(ann);
  });

  for (const [url, anns] of Object.entries(groups)) {
    md += `## ${formatUrl(url)}\n\n`;
    anns.forEach(ann => {
      md += `- "${ann.selectedText}"\n`;
      if (ann.text) md += `  - ${ann.text}\n`;
      md += `  - ${new Date(ann.createdAt).toLocaleString()}\n\n`;
    });
  }

  downloadFile(md, 'annotations.md', 'text/markdown');
}

function exportAsJson() {
  const groups = {};
  allAnnotations.forEach(ann => {
    if (!groups[ann.url]) groups[ann.url] = [];
    const { url: _, ...rest } = ann;
    groups[ann.url].push(rest);
  });
  downloadFile(JSON.stringify(groups, null, 2), 'annotations.json', 'application/json');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function doImport() {
  const data = prompt('粘贴 JSON 数据:');
  if (!data) return;
  try {
    JSON.parse(data);
    const ok = await sendMessage({ action: 'import', data });
    if (ok) {
      alert('导入成功');
      loadAnnotations();
    } else {
      alert('导入失败');
    }
  } catch {
    alert('JSON 格式错误');
  }
}

function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    currentFilter.search = e.target.value.trim();
    renderAnnotations();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.sort = btn.dataset.sort;
      renderAnnotations();
    });
  });

  document.querySelectorAll('.color-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (currentFilter.color === color) {
        currentFilter.color = null;
        btn.classList.remove('active');
      } else {
        document.querySelectorAll('.color-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter.color = color;
      }
      renderAnnotations();
    });
  });

  document.getElementById('btnExportMd').addEventListener('click', exportAsMarkdown);
  document.getElementById('btnExportJson').addEventListener('click', exportAsJson);
  document.getElementById('btnImport').addEventListener('click', doImport);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 25 ? u.pathname.substring(0, 25) + '...' : u.pathname);
  } catch { return url.substring(0, 40); }
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
