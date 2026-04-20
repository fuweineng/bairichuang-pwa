# 分科目题库方案

## 目标
题库按科目拆分独立文件，便于单独维护和更新。

## 结构

```
questions/
  math.js        →  export const MATH = [...]
  english.js     →  export const ENGLISH = [...]
  chinese.js     →  export const CHINESE = [...]
  science.js     →  export const SCIENCE = [...]
  biology.js     →  export const BIOLOGY = [...]
  history.js     →  export const HISTORY = [...]
  geography.js   →  export const GEOGRAPHY = [...]
  politics.js    →  export const POLITICS = [...]
  index.js       →  export { MATH, ENGLISH, ... } from './math.js'; ...
```

加载方式：动态 import，并行拉取，全部 resolved 后合并到 `state.questionBank`。

## 加载流程（app.js init 时）

```js
async function loadQuestionBanks() {
  const modules = await Promise.all([
    import('./questions/math.js'),
    import('./questions/english.js'),
    import('./questions/chinese.js'),
    import('./questions/science.js'),
    import('./questions/biology.js'),
    import('./questions/history.js'),
    import('./questions/geography.js'),
    import('./questions/politics.js'),
  ]);
  const [math, english, chinese, science, biology, history, geography, politics] = modules.map(m => m.default || Object.values(m)[0]);
  return { math, english, chinese, science, biology, history, geography, politics };
}
```

## 题库格式（每科目 .js）

```js
// questions/math.js
export default [
  {
    id: "math-001",
    type: "choice",       // choice | fill
    subject: "math",
    difficulty: 1,         // 1=简单 2=中等 3=困难
    grade: 8,
    knowledgeTags: ["幂的运算"],
    question: "下列计算正确的是：",
    options: ["2³=6", "2³=8", "2³=9", "2³=5"],
    answer: "2³=8",
    explanation: "2³=2×2×2=8"
  },
  // ...
];
```

## 更新流程

1. 编辑对应 `questions/xxx.js`
2. `git add questions/xxx.js && git commit -m "update math questions"`
3. GitHub Actions 自动部署
4. 用户下次打开 PWA → Service Worker 更新缓存 → 新题库生效

## 优点

- 每个科目单独 Git 历史
- 更新一个科目不影响其他
- 可按科目控制加载（按需加载）
- 无需重新生成单一大文件

## 缺点

- 多了 8 个 HTTP 请求（但可缓存在 Service Worker）
- 初始加载比单文件略慢（并行 import 改善）
