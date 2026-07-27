# Tab Out

> 掌控你的标签页。新标签页扩展，按域名分组管理打开的标签页，让标签页整理变得优雅高效。

**此项目拓展自 [zara-zhang](https://github.com/zarazhangrui) 的 [tab-out](https://github.com/zarazhangrui/tab-out) 项目。**

## 功能特点

### 📑 标签页管理

- **按域名分组**：自动将打开的标签页按域名分组展示，清晰明了
- **一键关闭**：支持一键关闭整个域名下的所有标签页
- **重复标签检测**：智能识别并高亮显示重复的标签页
- **单独关闭**：点击标签页旁边的关闭按钮单独关闭单个标签
- **首页聚合**：自动识别并聚合各网站的首页（如 Gmail 收件箱、Twitter 首页等）

### 🔍 搜索功能

- **快捷搜索**：按 `Ctrl+K` 快速搜索打开的标签页
- **实时匹配**：输入即搜索，标题和 URL 双重匹配
- **键盘导航**：支持上/下箭头键导航，Enter 键切换到目标标签

### ✅ 任务清单

- **内置待办**：在标签页管理界面直接添加和管理任务
- **截止日期**：为任务设置截止日期，清晰显示剩余时间
- **已完成归档**：完成的待办自动归档，方便回顾
- **编辑删除**：支持编辑和删除任务

### 🔖 书签侧边栏

- **快速访问**：侧边栏展示所有书签
- **文件夹分组**：按书签文件夹自动分组整理
- **一键打开**：点击书签即可在新标签页打开

### ✨ 交互体验

- **彩色纸屑动画**：关闭标签时播放彩色纸屑动画
- **音效反馈**：关闭标签时播放流畅的音效
- **Toast 提示**：操作成功时显示友好提示
- **颜色徽章**：工具栏徽章颜色随标签页数量变化（绿色 1-10，橙色 11-20，红色 21+）

### 🎨 设计风格

- **简约清新**：温暖的纸张质感配色，护眼舒适
- **优雅字体**：Newsreader + DM Sans 字体组合
- **流畅动画**：精心设计的入场动画和交互反馈
- **响应式布局**：适配不同屏幕尺寸

## 安装方法

### 开发者模式安装

1. 下载或克隆本项目到本地
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择项目文件夹即可

### 注意事项

- 需要 Chrome 89 或更高版本
- 扩展使用 Manifest V3
- 部分功能需要浏览器刷新后生效

## 使用指南

### 基础操作

| 操作 | 方法 |
|------|------|
| 查看标签页 | 打开新标签页即可看到分组后的标签页 |
| 关闭单个标签 | 点击标签行右侧的 X 按钮 |
| 关闭整个域名 | 点击域名卡片底部的 "Close all tabs" |
| 搜索标签页 | 按 `Ctrl+K` 或点击搜索图标 |
| 切换到标签页 | 点击标签行直接切换 |

### 使用任务清单

1. 点击右侧**任务图标**打开任务抽屉
2. 输入任务内容，按 Enter 添加
3. 可选设置截止日期
4. 点击任务前的复选框标记完成

## 技术架构

- **前端**：纯 HTML + CSS + JavaScript，无框架依赖
- **存储**：Chrome Extension Storage API
- **后端**：Service Worker（徽章更新）
- **字体**：Google Fonts (Newsreader, DM Sans)
- **图标**：内联 SVG，无外部依赖

## 文件结构

```
tab-out/
├── manifest.json     # 扩展配置
├── index.html       # 新标签页主页面
├── app.js           # 主应用逻辑
├── background.js    # Service Worker
├── style.css        # 样式表
└── icons/           # 扩展图标
```

## 自定义配置

可在 `config.local.js` 中添加自定义配置：

```javascript
// 自定义首页识别规则
const LOCAL_LANDING_PAGE_PATTERNS = [
  { hostname: 'github.com', pathExact: ['/'] }
];

// 自定义域名分组规则
const LOCAL_CUSTOM_GROUPS = [
  { hostname: 'github.com', groupKey: 'github', groupLabel: 'GitHub Projects' }
];
```

## 相关链接

- 原项目：[tab-out by zara-zhang](https://github.com/zarazhangrui/tab-out)
- 作者 Twitter：[@zarazhangrui](https://x.com/zarazhangrui)

## License

MIT License

---

**Made with ❤️ by [zara-zhang](https://github.com/zarazhangrui)**
