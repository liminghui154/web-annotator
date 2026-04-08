// content.js - 内容脚本，注入到页面中

(function () {
  'use strict';

  const ANNOTATION_CLASS = 'web-annotator-highlight';
  const POPUP_CLASS = 'web-annotator-popup';
  const TOOLBAR_CLASS = 'web-annotator-toolbar';

  let annotations = [];
  let activePopup = null;
  let activeToolbar = null;
  let pendingSelection = null;
  let currentUrl = '';
  let mutationObserver = null;
  let rerenderTimer = null;
  let rerenderRetryTimers = [];
  let navigationHooked = false;

  // ==================== 初始化 ====================

  async function init() {
    currentUrl = getPageUrl();
    await loadAnnotationsForCurrentPage();
    setupSelectionHandler();
    setupMessageListener();
    setupNavigationListener();
    setupDomObserver();
  }

  function getPageUrl() {
    return location.href.split('#')[0];
  }

  // ==================== 消息通信 ====================

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function isContextInvalidatedError(error) {
    return Boolean(error && /Extension context invalidated/i.test(String(error.message || error)));
  }

  function notifyContextInvalidated() {
    removeToolbar();
    removePopup();
    window.alert('扩展已更新或重载，当前页面中的旧脚本已失效。请刷新页面后再试。');
  }

  async function loadAnnotationsForCurrentPage() {
    currentUrl = getPageUrl();
    clearHighlights();
    clearRerenderRetries();

    try {
      annotations = await sendMessage({ action: 'getForUrl', url: currentUrl }) || [];
    } catch (e) {
      annotations = [];
      if (isContextInvalidatedError(e)) {
        notifyContextInvalidated();
        return;
      }
      console.error('Failed to load annotations:', e);
    }

    renderAllAnnotations();
    scheduleRerender();
    scheduleRerenderRetries();
  }

  function scheduleRerender(delay = 300) {
    if (rerenderTimer) {
      clearTimeout(rerenderTimer);
    }

    rerenderTimer = setTimeout(() => {
      rerenderTimer = null;
      renderAllAnnotations();
    }, delay);
  }

  function clearRerenderRetries() {
    rerenderRetryTimers.forEach(timerId => clearTimeout(timerId));
    rerenderRetryTimers = [];
  }

  function scheduleRerenderRetries() {
    [800, 1800, 3500, 6000].forEach((delay) => {
      const timerId = setTimeout(() => {
        renderAllAnnotations();
      }, delay);
      rerenderRetryTimers.push(timerId);
    });
  }

  function clearHighlights() {
    removeToolbar();
    removePopup();

    document.querySelectorAll(`mark.${ANNOTATION_CLASS}`).forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) return;

      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }

      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function handlePossibleNavigation() {
    const nextUrl = getPageUrl();
    if (nextUrl === currentUrl) return;
    loadAnnotationsForCurrentPage();
  }

  function setupNavigationListener() {
    if (navigationHooked) return;
    navigationHooked = true;

    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      if (typeof original !== 'function') return;

      history[methodName] = function () {
        const result = original.apply(this, arguments);
        setTimeout(handlePossibleNavigation, 0);
        return result;
      };
    };

    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');
    window.addEventListener('popstate', handlePossibleNavigation);
  }

  function setupDomObserver() {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver(() => {
      if (!annotations.length) return;
      scheduleRerender(200);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'scrollToAnnotation') {
        scrollToAnnotation(message.annotationId);
        sendResponse(true);
      }
      return true;
    });
  }

  function scrollToAnnotation(annotationId) {
    const mark = document.querySelector(`mark[data-annotation-id="${annotationId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mark.style.animation = 'none';
      mark.offsetHeight;
      mark.style.animation = 'highlight-pulse 1s ease-in-out 3';
    }
  }

  // ==================== 选中文字处理 ====================

  function setupSelectionHandler() {
    document.addEventListener('mouseup', scheduleToolbarForSelection);
    document.addEventListener('keyup', handleKeyup);
    document.addEventListener('mousedown', handleDocumentMouseDown);
  }

  function handleKeyup(e) {
    if (e.key === 'Escape') {
      removeToolbar();
      removePopup();
      window.getSelection().removeAllRanges();
      return;
    }

    if (e.target instanceof Element && e.target.closest(`.${POPUP_CLASS}, .${TOOLBAR_CLASS}`)) {
      return;
    }

    scheduleToolbarForSelection();
  }

  function handleDocumentMouseDown(e) {
    if (e.target instanceof Element && e.target.closest(`.${POPUP_CLASS}, .${TOOLBAR_CLASS}`)) return;
    removeToolbar();
  }

  function scheduleToolbarForSelection() {
    setTimeout(() => {
      const selection = getValidSelection();
      if (!selection) {
        removeToolbar();
        pendingSelection = null;
        return;
      }

      pendingSelection = captureSelection(selection);
      showSelectionToolbar(pendingSelection);
    }, 10);
  }

  function getValidSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) return null;

    if (selection.anchorNode && selection.anchorNode.parentElement &&
        selection.anchorNode.parentElement.closest &&
        selection.anchorNode.parentElement.closest(`.${ANNOTATION_CLASS}`)) {
      return null;
    }

    return selection;
  }

  function captureSelection(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset,
      selectedText: selection.toString(),
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    };
  }

  function showSelectionToolbar(savedSelection) {
    removeToolbar();
    if (!savedSelection || !savedSelection.rect) return;

    const toolbar = document.createElement('div');
    toolbar.className = TOOLBAR_CLASS;
    toolbar.innerHTML = `
      <button type="button" class="btn-annotate" aria-label="标注">
        <span class="label">标注</span>
        <span class="paw" aria-hidden="true"></span>
      </button>
    `;

    positionFloatingElement(toolbar, savedSelection.rect, {
      width: 40,
      topOffset: 12
    });

    ['mousedown', 'mouseup', 'click'].forEach(evt => {
      toolbar.addEventListener(evt, (e) => e.stopPropagation());
    });

    toolbar.querySelector('.btn-annotate').addEventListener('click', () => {
      if (!pendingSelection) return;
      removeToolbar();
      showCreatePopup(pendingSelection);
    });

    document.body.appendChild(toolbar);
    activeToolbar = toolbar;
  }

  // ==================== 创建弹窗 ====================

  function showCreatePopup(savedRange) {
    if (!savedRange || !savedRange.rect) return;
    const popup = document.createElement('div');
    popup.className = POPUP_CLASS;
    popup.innerHTML = `
      <div class="popup-content">
        <div class="selected-text">"${truncateText(savedRange.selectedText, 50)}"</div>
        <textarea placeholder="写下你的笔记..." rows="3"></textarea>
        <div class="popup-actions">
          <span class="color-picker">
            <span class="color-option active" data-color="#ffeb3b" style="background:#ffeb3b"></span>
            <span class="color-option" data-color="#a5d6a7" style="background:#a5d6a7"></span>
            <span class="color-option" data-color="#90caf9" style="background:#90caf9"></span>
            <span class="color-option" data-color="#f48fb1" style="background:#f48fb1"></span>
          </span>
          <button class="btn-save">保存</button>
        </div>
      </div>
    `;

    positionFloatingElement(popup, savedRange.rect, {
      width: 320,
      topOffset: 10
    });

    document.body.appendChild(popup);
    activePopup = popup;

    ['mousedown', 'mouseup', 'click'].forEach(evt => {
      popup.addEventListener(evt, (e) => e.stopPropagation());
    });

    popup.querySelectorAll('.color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        popup.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    popup.querySelector('.btn-save').addEventListener('click', async () => {
      const noteText = popup.querySelector('textarea').value.trim();
      const color = popup.querySelector('.color-option.active').dataset.color;
      await createAnnotation(savedRange, noteText, color);
      removePopup();
    });

    setTimeout(() => {
      const handler = (e) => {
        if (!popup.contains(e.target)) {
          removePopup();
          document.removeEventListener('mousedown', handler);
        }
      };
      document.addEventListener('mousedown', handler);
    }, 50);

    popup.querySelector('textarea').focus();
  }

  // ==================== 创建标注 ====================

  async function createAnnotation(savedRange, noteText, color) {
    try {
      const { startContainer, startOffset, endContainer, endOffset, selectedText } = savedRange;

      if (!selectedText || !startContainer) {
        console.warn('No selection data');
        return;
      }

      const url = getPageUrl();
      const annotation = await sendMessage({
        action: 'save',
        url,
        annotation: {
          selectedText,
          text: noteText,
          color
        }
      });

      if (annotation) {
        annotations.push(annotation);
        try {
          const range = document.createRange();
          range.setStart(startContainer, startOffset);
          range.setEnd(endContainer, endOffset);
          wrapRangeWithHighlight(range, annotation);
        } catch (e) {
          highlightByTextSearch(selectedText, annotation);
        }
      }
    } catch (e) {
      if (isContextInvalidatedError(e)) {
        notifyContextInvalidated();
        return;
      }
      console.error('Failed to create annotation:', e);
    }
  }

  // ==================== 高亮渲染 ====================

  function renderAllAnnotations() {
    annotations.forEach(ann => renderAnnotation(ann));
  }

  function renderAnnotation(annotation) {
    const { selectedText } = annotation;
    if (!selectedText) return;
    if (document.querySelector(`mark[data-annotation-id="${annotation.id}"]`)) return;
    highlightByTextSearch(selectedText, annotation);
  }

  function highlightByTextSearch(targetText, annotation) {
    if (!targetText) return false;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement.closest(`.${ANNOTATION_CLASS}`)) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest('script, style, noscript')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let fullText = '';
    let node;

    while (node = walker.nextNode()) {
      textNodes.push({ node, start: fullText.length });
      fullText += node.textContent;
    }

    const matchIndex = fullText.indexOf(targetText);
    if (matchIndex === -1) return false;

    const matchEnd = matchIndex + targetText.length;
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;

    for (let i = 0; i < textNodes.length; i++) {
      const tn = textNodes[i];
      const nodeEnd = tn.start + tn.node.textContent.length;
      if (!startNode && nodeEnd > matchIndex) {
        startNode = tn.node;
        startOffset = matchIndex - tn.start;
      }
      if (nodeEnd >= matchEnd) {
        endNode = tn.node;
        endOffset = matchEnd - tn.start;
        break;
      }
    }

    if (!startNode || !endNode) return false;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      wrapRangeWithHighlight(range, annotation);
      return true;
    } catch (e) {
      return false;
    }
  }

  function wrapRangeWithHighlight(range, annotation) {
    const mark = document.createElement('mark');
    mark.className = ANNOTATION_CLASS;
    mark.dataset.annotationId = annotation.id;
    mark.style.backgroundColor = annotation.color || '#ffeb3b';

    try {
      mark.appendChild(range.extractContents());
    } catch (e) {
      try {
        range.surroundContents(mark);
      } catch (e2) {
        return;
      }
    }

    range.insertNode(mark);

    mark.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showAnnotationPopup(mark, annotation);
    });
  }

  // ==================== 查看/编辑/删除标注 ====================

  function showAnnotationPopup(mark, annotation) {
    removePopup();

    const rect = mark.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = POPUP_CLASS;
    popup.innerHTML = `
      <div class="popup-content annotation-view">
        <div class="selected-text">"${truncateText(annotation.selectedText, 60)}"</div>
        <div class="note-text">${escapeHtml(annotation.text) || '<em>（无笔记）</em>'}</div>
        <div class="popup-actions">
          <button class="btn-edit">编辑</button>
          <button class="btn-delete">删除</button>
        </div>
      </div>
    `;

    popup.style.position = 'fixed';
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
    popup.style.top = `${rect.bottom + 10}px`;

    document.body.appendChild(popup);
    activePopup = popup;

    ['mousedown', 'mouseup', 'click'].forEach(evt => {
      popup.addEventListener(evt, (e) => e.stopPropagation());
    });

    const handler = (e) => {
      if (!popup.contains(e.target) && !mark.contains(e.target)) {
        removePopup();
        document.removeEventListener('mousedown', handler);
      }
    };
    document.addEventListener('mousedown', handler);

    popup.querySelector('.btn-edit').addEventListener('click', () => {
      const newText = prompt('修改笔记:', annotation.text);
      if (newText !== null) {
        updateAnnotation(annotation.id, newText);
      }
    });

    popup.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm('确定删除这条标注？')) {
        deleteAnnotation(annotation.id, mark);
      }
    });
  }

  async function updateAnnotation(annotationId, newText) {
    const url = getPageUrl();
    try {
      await sendMessage({
        action: 'update',
        url,
        annotationId,
        annotation: { text: newText }
      });
      const ann = annotations.find(a => a.id === annotationId);
      if (ann) ann.text = newText;
    } catch (e) {
      if (isContextInvalidatedError(e)) {
        notifyContextInvalidated();
        return;
      }
      console.error('Failed to update:', e);
    }
    removePopup();
  }

  async function deleteAnnotation(annotationId, markElement) {
    const url = getPageUrl();
    try {
      await sendMessage({ action: 'delete', url, annotationId });
    } catch (e) {
      if (isContextInvalidatedError(e)) {
        notifyContextInvalidated();
        return;
      }
      console.error('Failed to delete:', e);
      return;
    }
    annotations = annotations.filter(a => a.id !== annotationId);
    if (markElement) {
      const parent = markElement.parentNode;
      while (markElement.firstChild) {
        parent.insertBefore(markElement.firstChild, markElement);
      }
      parent.removeChild(markElement);
      parent.normalize();
    }
    removePopup();
  }

  // ==================== 工具函数 ====================

  function positionFloatingElement(element, rect, options = {}) {
    const width = options.width || 300;
    const topOffset = options.topOffset || 8;
    const left = Math.min(
      Math.max(rect.left + (rect.width / 2) - (width / 2), 8),
      Math.max(window.innerWidth - width - 8, 8)
    );
    const top = Math.min(rect.bottom + topOffset, window.innerHeight - 48);

    element.style.position = 'fixed';
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  function removeToolbar() {
    if (activeToolbar) {
      activeToolbar.remove();
      activeToolbar = null;
    }
  }

  function removePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
      return;
    }

    const popup = document.querySelector(`.${POPUP_CLASS}`);
    if (popup) popup.remove();
    activePopup = null;
  }

  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== 启动 ====================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
