# 朱青青音乐播放器 TypeScript 重构总纲（教学版）

> 版本：v1.0 ｜ 日期：2026-01-28 ｜ 状态：**已定稿，待执行**
> 本文档是重构项目的总纲：决策记录、技术方案、教学大纲、验收标准、部署方案。
> 执行时按"第 12 节：开工顺序"逐步推进，每完成一课在对应复选框打勾。

---

## 1. 项目背景与目标

| 项 | 内容 |
|---|---|
| 仓库 | `github.com/z2123668062/for_zqq`（分支 `main`） |
| 托管 | GitHub Pages（静态托管，无自定义域名） |
| 现状 | 播放器在 `2/` 目录：`player.js`（364 行 IIFE 纯 JS）+ `index.html` + `styles.css` + PWA manifest |
| 功能 | 音乐/故事双分类、播放/暂停、上下首、顺序/随机/单曲循环、故事倍速、进度条跳转、Media Session 锁屏控制、封面旋转动画 |
| **目标 1** | 用 TypeScript 重构播放器，**行为完全等价**（功能一个不少、表现一模一样） |
| **目标 2** | 在重构过程中**学会 TypeScript**（学习者：零前端基础，会少量 Python 后端） |
| **目标 3** | 重构后**继续托管在 GitHub Pages**，URL 不变 |

**核心原则：先学会，再重构；重构只换"写法"，不换"行为"。**

---

## 2. 已确认的决策记录

| 决策点 | 选择 | 说明 |
|---|---|---|
| 部署方式 | **GitHub Actions 自动构建部署** | 推送 `main` 后云端自动 `npm run build` 并发布 |
| 线上结构 | **保持现状**：圣诞页在根 `/`，播放器在 `/2/` | 部署时做"整站装配"，URL 完全不变 |
| 学习方式 | **手把手**：我讲概念 + 写示范，你照写，我逐行 review | 学得最扎实 |
| 前端基础 | 零 TS / 几乎零前端，会一点 Python | 教学从零开始，多用 Python 类比 |
| 技术栈 | **Vite 6 + TypeScript 5**（vanilla，不引入框架） | 轻量、学习曲线平缓、适合静态站点 |
| 样式 | 沿用现有 `styles.css`，视觉零改动 | 先重构逻辑，样式以后再说 |

---

## 3. 为什么重构后 GitHub Pages 还能托管？

- GitHub Pages 只认**静态文件**（HTML/CSS/JS/音频/图片），不运行任何后端代码；
- TypeScript 编译后的产物就是**纯 JavaScript**，与现在的 `player.js` 没有本质区别；
- 唯一新增的是**一步"构建"**：`.ts` → `.js`。这一步由 GitHub Actions 在云端自动完成；
- 音频（.m4a）、`playlist.json`、图片等资源在构建时**原样拷贝**，不做任何处理。

**结论：可以继续托管，且 URL 不变。** 唯一要注意的坑是 Pages 站点位于子路径（`/for_zqq/2/`），构建时配置 `base: './'`（相对路径）即可，方案已覆盖。

---

## 4. 技术选型与目标目录结构

### 4.1 选型理由

| 选型 | 理由 |
|---|---|
| Vite 6 | 开发服务器秒级启动 + 热更新（改代码浏览器立刻刷新）；`public/` 目录自动原样拷贝资源；是目前主流标配 |
| TypeScript 5 | 类型检查在**写代码时**就帮你抓错误（而不是运行时崩溃）；`interface`/`type` 概念与 Python 类型标注相通 |
| 不引入框架 | 播放器规模小，Vue/React 是多余的复杂度；先把 TS 本身学扎实 |
| GitHub Actions | 免费、与 GitHub 无缝集成、推送即部署 |

### 4.2 目标目录结构（简化版，7 个源文件对应 7 节课）

```
2/
├── index.html              # 入口页面（Vite 会处理其中的资源引用）
├── package.json            # npm 项目清单（依赖 + 脚本命令）
├── tsconfig.json           # TypeScript 编译配置
├── vite.config.ts          # Vite 配置（关键一行：base: './'）
├── styles.css              # 沿用现有样式，不动
├── public/                 # ★ 原样拷贝进产物的目录（Vite 约定）
│   ├── manifest.json       # PWA 清单
│   ├── ppp1.jpg            # 封面/图标
│   ├── music/              # 5 首 m4a + playlist.json
│   └── story/              # 故事 m4a + playlist.json
└── src/
    ├── main.ts             # 第 6 课：入口，装配所有模块
    ├── types.ts            # 第 1 课：核心类型（PlayMode / Category / Track）
    ├── config.ts           # 第 1 课：常量（倍速档位、模式列表、分类路径）
    ├── utils.ts            # 第 2 课：纯函数（时间格式化、歌名解析）
    ├── queue.ts            # 第 3 课：播放队列（索引 + 三种模式切歌算法）
    ├── player.ts           # 第 4 课：Audio 封装（播放/暂停/跳转/倍速/事件）
    └── ui.ts               # 第 5 课：界面交互（歌单渲染/按钮/tab/进度条/Media Session）
```

构建产物：`2/dist/`（Vite 自动生成，提交时忽略，由 CI 生成）。

---

## 5. 教学大纲（7 节课）

> 每节课格式：**知识点 → 我示范 → 你动手写 → 我 review → 练习**。
> 全程本地 `npm run dev`，改代码浏览器即时生效。

### 第 0 课：环境搭建（30 分钟）
- **知识点**：什么是构建工具 / 为什么需要构建 / npm 基本操作（`npm init`、`npm install`、`package.json` 是什么）/ Vite 项目怎么跑起来
- **产出**：`2/` 下 Vite + TS 空项目，`npm run dev` 能看到页面
- **练习**：改一行页面文字，观察热更新
- **验收**：本地浏览器打开 Vite 地址，显示"你好，TypeScript"

### 第 1 课：类型系统（`types.ts` + `config.ts`）（45 分钟）
- **知识点**：`type` / `interface` / 联合类型（`'sequence' | 'random' | 'loop'`）/ 字面量类型 / 常量 `as const`
- **产出**：定义 `PlayMode`、`Category`、`Track`、`Playlists` 类型；倍速档位、模式列表等常量
- **练习**：给类型加字段 / 故意写错类型看编译器报错
- **验收**：`tsc` 零报错

### 第 2 课：模块与纯函数（`utils.ts`）（30 分钟）
- **知识点**：`import`/`export`（类比 Python `from ... import`）/ 纯函数概念 / 字符串与数组方法
- **产出**：`formatTime(sec)`（秒 → "3:05"）、`basename(path)`（路径 → 歌名）
- **练习**：自己写一个 `stripExt` 函数
- **验收**：两个函数通过给定的测试用例

### 第 3 课：类与状态管理（`queue.ts`）（45 分钟）
- **知识点**：`class` / 属性 / 方法 / 私有字段 `#` / 状态机思想（类比 Python class）
- **产出**：`PlaybackQueue` 类：维护 `idx`、`playMode`，实现 `next()/prev()/getCurrent()/setMode()`，复刻现有三种模式的全部细节（随机防重复、单曲循环下"手动切歌 vs 自然结束"行为差异）
- **练习**：给队列加一个 `shuffle()` 方法
- **验收**：模式行为与旧代码逐条对照一致

### 第 4 课：事件与异步（`player.ts`）（45 分钟）
- **知识点**：`addEventListener` / `async/await`（对比 Python `asyncio`）/ `Promise` / Audio API
- **产出**：`AudioPlayer` 类：封装 `play()/pause()/seek()/setRate()`，暴露 `timeupdate/ended/error` 事件回调
- **练习**：加一个"音量 +10%"方法
- **验收**：控制台能打印播放状态变化

### 第 5 课：DOM 类型化（`ui.ts`）（60 分钟，最重的一课）
- **知识点**：`document.getElementById` 返回 `HTMLElement | null`（为什么 TS 要管 null）/ 类型断言 / `textContent` vs `innerHTML` / 事件对象类型
- **产出**：歌单渲染与高亮、tab 切换、按钮逻辑、进度条点击跳转、Media Session 集成
- **练习**：给歌单项加一个"删除"按钮（仅界面）
- **验收**：播放器在浏览器里完整可用

### 第 6 课：组装与构建（`main.ts`）（30 分钟）
- **知识点**：模块装配顺序 / `npm run build` 产物是什么 / `npm run preview` 本地模拟线上
- **产出**：`main.ts` 把 queue、player、ui 全部接起来；构建通过
- **练习**：看一遍 `dist/` 里的产物文件，找到自己的代码被编译成了什么
- **验收**：**行为等价清单（第 6 节）全部打勾**

### 第 7 课：GitHub Actions 自动部署（45 分钟）
- **知识点**：什么是 CI/CD / YAML 语法 / workflow 的三个要素（触发条件、任务、步骤）
- **产出**：`.github/workflows/deploy.yml`，推送 `main` 自动构建 + 发布
- **练习**：改一行代码推上去，观察 Actions 运行过程（绿的/红的）
- **验收**：线上播放器与本地构建效果一致

---

## 6. 行为等价验收清单（重构成功的唯一标准）

> 第 6 课结束时逐条打勾，任何一条不满足 = 重构未完成。

- [ ] tab 切换（🎵 音乐 / 📖 故事），按钮高亮正确
- [ ] 歌单渲染、点击播放、当前项高亮 + 自动滚动到可见位置
- [ ] 播放/暂停按钮文案切换（"播放" ↔ "暂停"）
- [ ] 封面旋转动画随播放状态启停
- [ ] 上一首/下一首在三种模式下行为与旧代码一致
- [ ] 随机模式防重复（同一首歌不会连续随机到两次）
- [ ] 单曲循环：自然播放结束 → 重播本曲；手动点下一首 → 正常切歌
- [ ] 倍速按钮**仅故事分类**显示，档位 1.0/1.25/1.5/2.0/0.8 循环；音乐分类恒为 1.0
- [ ] 进度条点击跳转、时间显示实时刷新
- [ ] Media Session：锁屏/耳机可控制播放暂停、上下首、进度拖动
- [ ] `playlist.json` 优先加载；缺失时数字文件 fallback（`music/1.m4a`~`20.m4a`）
- [ ] 空歌单显示"暂无内容"，初始化失败显示兜底文案
- [ ] 页面标题随歌曲变化；`document.title` 同步

---

## 7. 部署方案（GitHub Actions）

### 7.1 整站装配思路（保住 URL 不变）

```
线上站点结构（装配后）：
https://z2123668062.github.io/for_zqq/
├── index.html        ← 圣诞页（仓库根，原样拷贝）
├── 1/                ← 原样拷贝
└── 2/                ← 播放器 = 2/dist/ 的内容
    ├── index.html
    ├── assets/...    ← 编译后的 JS/CSS
    ├── manifest.json
    ├── music/*.m4a
    └── story/*.m4a
```

### 7.2 Workflow 骨架（第 7 课再写完整版）

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:        # 支持手动触发
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: 2/package-lock.json }
      - run: npm ci && npm run build        # 在 2/ 目录
      - run: 组装站点（根文件 + 2/dist 合并进 _site/）
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: _site }
      - uses: actions/deploy-pages@v4
```

### 7.3 需要你手动做的一次性设置（第 7 课我会带你做）

1. 浏览器打开仓库 → **Settings → Pages**
2. **Source（源）** 改为 **"GitHub Actions"**
3. 以后每次推 `main`，Actions 自动构建发布，无需再碰设置

### 7.4 备选方案（不采用，仅记录）

| 方案 | 说明 | 为何不用 |
|---|---|---|
| 本地构建 + 推 `gh-pages` 分支 | 手动 `npm run build` 后把 `dist` 推分支 | 每次更新都要手动操作，容易忘 |
| `tsc` 直编译提交产物 | 编译产物提交进仓库 | 仓库混入构建产物，不干净 |

---

## 8. TypeScript vs Python 概念对照表（学习速查）

| TypeScript | Python | 说明 |
|---|---|---|
| `const x = 1` | `x = 1`（习惯上用大写常量名） | TS 用 `const`/`let` 声明；`const` 不可重新赋值 |
| `let x: number = 1` | `x: int = 1`（类型标注） | TS 类型标注在变量名后，冒号分隔 |
| `type T = ...` / `interface T` | `class` / `dataclass` / `TypedDict` | 定义"数据的形状" |
| `'a' \| 'b'`（联合类型） | `Literal['a','b']` / `enum` | 值只能取列出的几个 |
| `x: string \| null` | `x: str \| None` | 可空类型——TS 强制你处理 null |
| `import { a } from './utils'` | `from utils import a` | 模块导入（注意路径要带 `./` 和扩展名规则） |
| `async function f() {}` / `await` | `async def f():` / `await` | 异步语法几乎一样 |
| `function f(a: number): string {}` | `def f(a: int) -> str:` | 函数签名，只是箭头写法 |
| `class A { #x = 1 }` | `class A: __x = 1` | `#` 是真正的私有字段 |
| `array.map(x => x * 2)` | `[x * 2 for x in arr]` | 函数式列表变换，TS 用箭头函数 |
| `JSON.parse(str)` | `json.loads(str)` | 几乎同名 |
| 编译期类型检查 | 运行时才能发现类型错误 | **最大的区别**：TS 错误在写代码时就报 |

---

## 9. 术语表（遇到不懂随时回来看）

| 术语 | 通俗解释 |
|---|---|
| 构建（build） | 把源码（TS 等）转成浏览器能直接运行的文件 |
| 打包（bundle） | 把多个源文件合并成一个/几个 JS 文件 |
| npm | Node 的包管理器，类似 Python 的 pip |
| node_modules | 依赖安装目录（pip 的 site-packages），体积大，不提交 git |
| 热更新（HMR） | 改代码后浏览器不刷新自动更新 |
| `dist` | distribution 的缩写，构建产物目录 |
| CI/CD | 持续集成/持续部署：代码推送后自动测试、自动发布 |
| workflow | GitHub Actions 里的一个自动化流程定义（YAML 文件） |
| PWA | 网页应用，可"添加到主屏幕"像 App 一样用 |
| Media Session | 浏览器提供的锁屏/耳机控制接口 |

---

## 10. 风险与注意事项

| 风险 | 应对 |
|---|---|
| 子路径部署导致资源 404 | `vite.config.ts` 配 `base: './'`，构建后检查产物路径 |
| 首次部署需要手动改 Pages 设置 | 第 7 课手把手带你改（一分钟） |
| 重构引入行为回归 | 行为等价清单逐条验收，旧 `player.js` 保留到验收通过才删 |
| 学习者被概念淹没 | 每课只讲本课需要的概念；术语表随时查 |
| 本工作区沙箱访问不了 github.com | 推送/验证需要你在本地终端或网页操作，我会给逐条命令 |
| m4a 兼容性 | 与现状完全一致（线上已在跑），零变化 |

---

## 11. 里程碑与时间预估

| 里程碑 | 内容 | 预估时长 |
|---|---|---|
| M1 | 第 0~2 课（环境 + 类型 + 工具函数） | 1.5~2 小时 |
| M2 | 第 3~5 课（队列 + 播放器 + 界面） | 2~2.5 小时 |
| M3 | 第 6 课（组装 + 验收清单全过） | 0.5~1 小时 |
| M4 | 第 7 课（Actions 部署 + 线上验证） | 0.5~1 小时 |

总计约 **5~7 小时**，可拆成 3~4 次完成（每次 1~2 小时）。

---

## 12. 开工顺序（执行时按此推进）

> **实施记录（2026-01-28）：** 播放器 v2.0 已完成编码与本地构建验证
> （`tsc` 零报错、`vite build` 通过、本地静态服务全资源 200）。
> **v2.1（同日）：** 创意版 UI「青听 · KTV 时光机」——5 张照片绑定 5 首歌、
> 照片即封面与沉浸式背景、主题色随照片抽取、Q 版应援小人；
> 已用无头 Edge 截图完成桌面/移动端视觉自查。
> **v3（同日）：** 用户否掉"方框播放器"，改走「少女手账」美学：
> 米色纸张 + 拍立得扇面 + 卡带播放器 + 手写配文，照片轮播与歌曲解耦。
> **v4（同日）：** 用户要求手机优先——卡带改为**底部悬浮迷你条**，
> 手机拍立得改**横滑胶片条**，双端一屏放下；新增搞怪照片入册。
> 剩余步骤 8/9 需要你在本地终端完成（沙箱无法访问 GitHub）。

- [x] **步骤 0**：确认本机 git 仓库状态（改在 `main` 上直接推进，未新建分支）
- [x] **步骤 1**：第 0 课——在 `2/` 初始化 Vite + TS 项目
- [x] **步骤 2**：第 1 课——`types.ts` + `config.ts`
- [x] **步骤 3**：第 2 课——`utils.ts`
- [x] **步骤 4**：第 3 课——`queue.ts`
- [x] **步骤 5**：第 4 课——`player.ts`
- [x] **步骤 6**：第 5 课——`ui.ts`
- [x] **步骤 7**：第 6 课——`main.ts` 组装 + 构建 + 本地资源验证
- [ ] **步骤 8**：第 7 课——推送 + 手动改 Pages 设置（Source → GitHub Actions）+ 线上验证
- [ ] **步骤 9**：验收通过后删除旧 `2/player.js`（已删除），合并分支收尾 —— 等待线上验证后确认

> 每完成一课，回本文档把对应条目打勾，并在"学习笔记"区（可自行添加）记下你踩过的坑——这是属于你自己的知识沉淀。
