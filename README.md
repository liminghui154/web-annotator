# Web Annotator

在任意网页添加笔记和高亮标注的浏览器插件。

## 功能

- 选中网页文字即可添加标注
- 支持 4 种高亮颜色
- 点击高亮区域查看/编辑/删除笔记
- 侧边栏管理所有标注（Chrome/Edge）
- 按时间/页面排序、颜色过滤、跨页面搜索
- 导出为 Markdown 或 JSON
- 导入/备份数据
- 数据存储在浏览器本地，清理缓存不会丢失

## 支持的浏览器

| 浏览器 | 推荐程度 | 安装方式 | 说明 |
|--------|----------|----------|------|
| Chrome / Edge | ⭐⭐⭐⭐⭐ | manifest.json | 侧边栏体验最佳 |
| Firefox | ⭐⭐⭐⭐ | manifest.firefox.json | 使用弹窗管理标注 |

## 安装

### Chrome / Edge

1. 复制 `manifest.chrome.json` 为 `manifest.json`
2. 打开 `chrome://extensions/` 或 `edge://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本项目文件夹

### Firefox

1. 复制 `manifest.firefox.json` 为 `manifest.json`
2. 打开 `about:debugging#/runtime/this-firefox`
3. 点击「临时加载附加组件」
4. 选择本项目文件夹中的任意文件

## 项目结构

```
web-annotator/
├── manifest.json              # Chrome/Edge 配置文件
├── manifest.firefox.json     # Firefox 配置文件
├── background.js             # 后台脚本（存储操作）
├── content.js                # 内容脚本（标注逻辑）
├── utils.js                  # 跨浏览器兼容工具
├── sidebar.html/js           # 侧边栏 UI（Chrome/Edge）
├── popup.html/js             # 弹窗 UI（Firefox）
└── styles/
    └── annotation.css        # 高亮样式
```

## 多浏览器适配

核心代码使用 `browser` API（Firefox 标准）配合 `chrome` fallback（Chrome/Edge），无需修改即可在所有浏览器运行。

差异仅在于 UI 入口：
- Chrome/Edge：侧边栏（`side_panel`）
- Firefox：弹窗（`action.default_popup`）

## 开发

```bash
# Chrome/Edge
cp manifest.chrome.json manifest.json

# Firefox
cp manifest.firefox.json manifest.json
```

## 图标

项目中的图标是占位符，请替换 `icons/` 目录下的 PNG 文件：
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)
