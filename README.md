# Web Annotator

在任意网页添加笔记和高亮标注的浏览器插件。

## 功能

- 选中网页文字即可添加标注
- 支持 4 种高亮颜色
- 点击高亮区域查看/编辑/删除笔记
- 侧边栏管理所有标注
- 按时间/页面排序、颜色过滤、跨页面搜索
- 导出为 Markdown 或 JSON
- 导入/备份数据
- 数据存储在浏览器本地，清理缓存不会丢失

## 支持的浏览器

- Chrome
- Edge

## 安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

## 项目结构

```
web-annotator/
├── manifest.json          # 插件配置
├── background.js         # 后台脚本（存储操作）
├── content.js            # 内容脚本（标注逻辑）
├── sidebar.html/js       # 侧边栏 UI
├── popup.html/js         # 弹窗 UI（备用）
└── styles/
    └── annotation.css    # 高亮样式
```

## 图标

项目中的图标是占位符，请替换 `icons/` 目录下的 PNG 文件：
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)
