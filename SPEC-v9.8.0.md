# 百日闯 PWA — v9.8 迭代清单

## 当前状态
- 最新版本：9.7.2
- 线上地址：https://yjs.meetolove.com

## ✅ 已完成（可确认）
- 打赏弹窗 + 二维码（images/ 已存在）
- PWA 安装底部 sheet
- 三学段架构（小学/初中/高中）
- 深夜模式适配
- 版本检测修复

## 🔧 本次待修

### 1. 首页缺少"打赏"按钮（openDonateModal 未实现）
- 位置：首页右上角或底部
- 行为：点击弹出 donate-modal
- 当前：support modal 有触发，但没有明确入口

### 2. 补弱科目 section 从未渲染
- `renderWeakSubjects()` 已定义但从未在 `renderHome()` 中被调用
- 需要在 renderHome() 里加入弱科目区

### 3. practice view 的 9 科网格缺失
- `#subject-grid-container` 在 HTML 里存在但从未被填充
- 缺少 `renderSubjectGrid()` 函数

### 4. 首页 today-status-container 内容可能缺失
- 需要确认 renderHome() 是否正确填充了今日状态

## 🔜 后续迭代（不做本次）
- Readhub 风格信息流（global-news-24h 重构）
- 打卡数据与正确率联动 bug
- AI/排行榜分类

## 版本号
- 本次：9.8.0
