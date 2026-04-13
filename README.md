# 百日闯

初二全科学习打卡 PWA。项目以纯前端方式运行，学习记录保存在浏览器本地 IndexedDB，无需后端。

## 当前能力

- 每日学习打卡与连续天数统计
- 全新题目、易错题、已掌握题三种练习入口
- 多学科题库与近 30 天学习趋势
- PWA 安装、离线缓存、版本更新提示
- 软件壳更新与题目包更新分离，避免题库更新被 App 版本绑定

## 运行方式

不要直接用 `file://` 打开 `index.html`。

原因：
- 题库与版本文件依赖 `fetch`
- Service Worker 与安装能力需要 HTTP/HTTPS
- 直接双击文件会让离线缓存、更新检测、题库加载表现不稳定

推荐本地启动方式：

```bash
npm install
npm start
```

默认会启动在 [http://127.0.0.1:4173](http://127.0.0.1:4173)。

## 校验与测试

```bash
npm run validate
npm run smoke
npm run check
```

- `validate`：检查 HTML/manifest/SW 资源引用、题库文件和版本配置
- `smoke`：用 Playwright 跑首页、练习、设置、进度四个核心页面
- `check`：顺序执行以上两项

## 目录说明

- `index.html`：应用壳页面
- `app.js`：当前线上入口和主要业务逻辑
- `sw.js`：PWA 缓存与离线策略
- `questions/`：题库与分学科题目源
- `audio/`：听力音频资源
- `js/idb-keyval.mjs`：本地存储工具
- `scripts/`：本地启动、结构校验、冒烟测试脚本

说明：
- 当前实际入口只有根目录 `app.js`
- `js/app.js`、`js/checkin.js`、`js/question_bank.js` 是早期重构遗留文件，不是当前页面加载入口，后续维护请以根目录入口为准
- 运行时更新策略：`version.json` 负责软件壳/题库版本探测，`questions/question_bank_v1.json` 负责题目包内容同步，两条路径互不锁死

## 维护建议

- 发布前至少执行一次 `npm run check`
- 修改静态资源路径后，同步检查 `index.html`、`manifest.webmanifest`、`sw.js`
- 修改题库结构后，确认 `questions/question_bank_v1.json` 与分学科文件保持一致
- 如果调整版本发布，记得同步更新 `version.json`

## 部署

仓库已包含 GitHub Pages 工作流。推送到 `main` 后会先执行 `npm run validate`，通过后再部署静态站点。
