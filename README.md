# 百日闯

**初二全科学习打卡系统**

## 简介

百日闯是一款面向初二学生的全科学习打卡 PWA 应用，帮助学生养成每日学习习惯。通过打卡、练习和进度追踪三大核心功能，全面提升学习效率。所有数据均存储在本地，无需后端支持，即开即用。

## 核心功能

- **每日打卡**：记录每日学习情况，养成良好习惯
- **学科练习**：支持数学、英语、语文三科练习
- **进度追踪**：可视化查看学习历史与连续打卡天数

## 技术栈

- 纯前端 PWA（Progressive Web App）
- 无需后端，数据存储于本地 IndexedDB
- 使用 idb-keyval 作为本地存储方案

## 快速开始

### 方式一：直接打开
直接用浏览器打开 `index.html` 即可使用

### 方式二：本地服务（推荐 PWA 功能）
```bash
npm install
npx serve .
```

## 部署说明

### GitHub Pages
1. 将项目推送到 GitHub 仓库
2. 在仓库 Settings > Pages 中启用
3. 选择 `main` 分支作为来源

### Docker（可选）
```bash
docker build -t bairichuang .
docker run -d -p 8080:80 bairichuang
```

## 版权声明

Powered by Hermes Agent
