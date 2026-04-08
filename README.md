# 猫爪标注

像猫爪一样轻巧地为任意网页添加笔记和高亮标注的浏览器插件。

## 功能

- 选中文字后点击悬浮“标注”按钮添加标注
- 支持 4 种高亮颜色
- 点击高亮区域查看/编辑/删除笔记
- 侧边栏管理所有标注
- 按时间/页面排序、颜色过滤、跨页面搜索
- 导出为 Markdown 或 JSON
- 导入/备份数据
- 数据存储在浏览器本地，清理缓存不会丢失

## 支持的浏览器

当前实现基于 Chromium 扩展能力，已适配：

- Chrome
- Edge

## 安装

### 方式一：从 GitHub Releases 安装

1. 打开仓库的 Releases 页面并下载最新的 `cat-paw-annotator-vx.y.z.zip`
2. 解压 ZIP 文件到本地目录
3. 打开 `chrome://extensions/` 或 `edge://extensions/`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择解压后的插件目录

### 方式二：从源码目录安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

## 发布 Release

1. 确认 `manifest.json` 中的版本号已经更新
2. 本地执行 `bash scripts/package-release.sh`，确认能生成 `dist/cat-paw-annotator-vx.y.z.zip`
3. 提交代码并推送到远端
4. 创建并推送版本标签，例如：

```bash
git tag v1.1.0
git push origin v1.1.0
```

5. GitHub Actions 会自动创建对应的 Release，并上传 ZIP 安装包

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
