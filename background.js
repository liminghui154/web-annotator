// background.js - 后台脚本，处理存储操作

// 跨浏览器兼容: 优先使用 browser API (Firefox)，fallback 到 chrome (Chrome/Edge)
const api = typeof browser !== 'undefined' ? browser : chrome;

// 点击扩展图标时打开侧边栏 (仅 Chrome/Edge 支持)
api.action.onClicked.addListener((tab) => {
  // 尝试打开侧边栏 (Chrome/Edge)
  try {
    if (api.sidePanel) {
      api.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (e) {
    // Firefox 不支持 sidePanel，侧边栏功能不可用
    console.log('Side panel not supported in this browser');
  }
});

// 生成唯一 ID
function generateId() {
  return 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 获取所有标注
function getAnnotations() {
  return api.storage.local.get(['annotations']).then(result => {
    return result.annotations || {};
  });
}

// 保存标注到指定 URL
function saveAnnotation(url, annotation) {
  return getAnnotations().then(annotations => {
    if (!annotations[url]) {
      annotations[url] = [];
    }
    annotation.id = generateId();
    annotation.createdAt = new Date().toISOString();
    annotations[url].push(annotation);
    return api.storage.local.set({ annotations }).then(() => annotation);
  });
}

// 更新标注
function updateAnnotation(url, annotationId, updates) {
  return getAnnotations().then(annotations => {
    if (!annotations[url]) return null;
    const index = annotations[url].findIndex(a => a.id === annotationId);
    if (index === -1) return null;
    annotations[url][index] = {
      ...annotations[url][index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return api.storage.local.set({ annotations }).then(() => annotations[url][index]);
  });
}

// 删除标注
function deleteAnnotation(url, annotationId) {
  return getAnnotations().then(annotations => {
    if (!annotations[url]) return false;
    annotations[url] = annotations[url].filter(a => a.id !== annotationId);
    if (annotations[url].length === 0) {
      delete annotations[url];
    }
    return api.storage.local.set({ annotations });
  });
}

// 获取指定 URL 的所有标注
function getAnnotationsForUrl(url) {
  return getAnnotations().then(annotations => annotations[url] || []);
}

// 导出所有数据
function exportData() {
  return getAnnotations().then(annotations => {
    return JSON.stringify(annotations, null, 2);
  });
}

// 导入数据
function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    return api.storage.local.set({ annotations: data }).then(() => true);
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}

// 监听来自 content script 的消息
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, url, annotationId, annotation, data } = message;

  switch (action) {
    case 'save':
      saveAnnotation(url, annotation).then(result => sendResponse(result));
      break;
    case 'update':
      updateAnnotation(url, annotationId, annotation).then(result => sendResponse(result));
      break;
    case 'delete':
      deleteAnnotation(url, annotationId).then(result => sendResponse(result));
      break;
    case 'getForUrl':
      getAnnotationsForUrl(url).then(result => sendResponse(result));
      break;
    case 'export':
      exportData().then(result => sendResponse(result));
      break;
    case 'import':
      importData(data).then(result => sendResponse(result));
      break;
    case 'getAll':
      getAnnotations().then(result => sendResponse(result));
      break;
    default:
      sendResponse(null);
  }

  return true;
});
