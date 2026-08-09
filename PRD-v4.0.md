# PRD v4.0 — PalworldBase 最终执行版任务书

**版本:** 4.0
**修订日期:** 2026-08-09
**项目类型:** 全新独立建站（数据资产从 palworldguides.com 继承）
**域名:** palworldbase.net
**状态:** 已锁定，可直接执行

---

## 0. 项目基石

### 0.1 核心原则

1. **旧站不动** — palworldguides.com 保持现状，不做任何修改
2. **新站独立** — palworldbase 作为全新站点，从头建立 SEO 信誉
3. **数据复用，内容重写** — 结构化数值可继承，叙事文本全部重构
4. **产品化而非内容化** — 新站定位为"数据产品"，不是"攻略博客"

### 0.2 数据资产

从 palworldguides.com 继承并补全：

| 资产 | 目标数量 | 当前 | 说明 |
|------|---------|------|------|
| Pal JSON 数据 | 319+ | 279（旧站）+ 44（新增=323） | wiki.gg 自动抓取 44 个新 Pal JSON 骨架（4 个未发布/占位） |
| Breeding Power 表 | 323 条 | 323 条 | 含所有 Pal 的 BP 值（44 新 Pal BP 已写入） |
| Pal 图片 | ~400 张 | ~350 张 | webp 格式，35MB，新 44 个需截图补充 |
| Decision 配置 | N 个 | N 个 | best-mining 等决策排名页配置 |
| 构建算法参考 | 1 套 | 1 套 | buildReverseBreedingIndex() 等已验证逻辑 |

### 0.3 教训清单（来自旧站流量下降）

- ❌ 频繁修改 `<title>` / `<meta description>` 模板
- ❌ 生成页面覆盖手写优化页面
- ❌ sitemap lastmod 日期不一致
- ❌ 大量页面无图片就上线
- ❌ 导航结构频繁变动
- ❌ 短时间大批量 SEO 改动（Aug 1-2 集中改了全站）
- ✅ 新站对策：URL 稳定、模板上线前锁定、sitemap 用 BUILD_DATE、改动用 feature flag

---

## 1. 反重复策略 ⭐ 全方案最核心章节

### 1.1 问题定义

palworldguides.com 已有 279 个 Pal 页被 Google 索引。新站用同一份 JSON 数据生成页面，**必须确保 Google 将两个站视为不同实体**。

### 1.2 事实数据 vs 叙事内容

| 数据类型 | 可否复用 | Google 判定 |
|---------|---------|------------|
| stats 数值（hp/attack/defense...） | ✅ 可复用 | 客观事实，不算 duplicate |
| skills 名称/元素/威力/冷却 | ✅ 可复用 | 游戏数据，无版权归属 |
| workSuitability 等级 | ✅ 可复用 | 游戏机制，公知信息 |
| breedingPower 数值 | ✅ 可复用 | 数学常数，无可替代表述 |
| drops 掉落物品/概率 | ✅ 可复用 | 游戏内固定数据 |
| 图片 | ✅ 可复用 | 游戏素材 |
| 页面信息架构 | ❌ 必须不同 | 结构相似 = 程序化内容嫌疑 |
| 叙事文本（summary/verdict/FAQ） | ❌ 必须重写 | 这是 Google 判定重复的核心 |
| meta title/description | ❌ 必须不同 | 直接影响 SERP 展示 |
| Schema 类型组合 | ❌ 建议不同 | 降低结构化数据相似度 |
| 内部链接逻辑和锚文本 | ❌ 必须不同 | 链接模式雷同 = link scheme 嫌疑 |

### 1.3 七维差异对照表（以 Jetragon 为例）

从 Google 爬虫视角看同一个 Pal 的两站页面：

| 信号维度 | palworldguides.com（旧） | palworldbase（新） | 重复？ |
|---------|-------------------------|-------------------|--------|
| **Title** | `Jetragon Palworld Guide - Stats, Location, Skills & Breeding` | `Jetragon Stats & Breeding — vs All Dragon Pals` | ❌ |
| **Meta Description** | `Learn everything about Jetragon in Palworld including location, stats, skills, breeding combinations, drops, and best uses.` | `See how Jetragon ranks against every Dragon Pal — Speed, ATK, skill loadout, breeding paths compared. #1 flying mount at 230 Speed.` | ❌ |
| **H1** | `Jetragon` | `Jetragon Stats & Breeding — vs All Dragon Pals` | ❌ |
| **页面结构** | Quick Facts → Stats → Verdict → Skills → Breeding → Drops → Best Uses → FAQ | Role Dashboard → Peer Comparison → Skill Loadout → Breeding Paths → Acquisition → Economy → Comparison Tool | ❌ |
| **叙事文本算法** | `renderSummary()`: "{Name} is a {Element} {Rarity} Pal..." / `renderVerdict()`: "✅ Yes — best-in-class..." / 5 个 FAQ 问答 | `renderRoleDashboard()`: "#1 among {Element} Pals in {Stat}" / 无 FAQ / 无 verdict 段落 | ❌ |
| **FAQ 块** | 5 个 FAQ + FAQPage JSON-LD | **无 FAQ 块** | ❌ |
| **Schema 组合** | VideoGameCharacter + FAQPage + BreadcrumbList | VideoGameCharacter + BreadcrumbList（无 FAQPage） | ❌ |
| **内部链接** | `findSimilarPals()` 算法：元素+工作+稀有度加权 → "Similar {Element} Pals" → 6 个卡片 | 固定关系链：同 Element 排名 / 同 Work 替代 / Parent-Child breeding → "Top {Element} Pals" → 排名列表 | ❌ |
| **底部组件** | Related Tools 静态卡片 | Pal Comparison 交互式 JS 组件 | ❌ |

### 1.4 额外防护

- [ ] 两站之间**不互相链接**
- [ ] 新站使用独立的 IndexNow key（不复用旧站的 `d975f82eed7e40669c0e291c6e0f5b6f`）
- [ ] 新站使用独立的 Microsoft Clarity ID 和 GA4 数据流
- [ ] 上线前运行文本扫描：确保新站页面中不出现旧站特征短语：
  - `"Learn everything about"`
  - `"Discover {name}'s stats"`
  - `"Everything a player needs to know"`
  - `"the best ways to use this Pal"`
  - `"How do I get"` / `"What is {name} best used for"` / `"Can you ride"` / `"What does {name}'s Partner Skill do"` / `"best alternatives to"`

---

## 2. 信息架构

### 2.1 页面结构（Phase 1 — 英文站）

```
/                          → 首页（Hub + 搜索 + 工具入口）
/pals/                     → Pal 数据库总览（§3.7：纯文本 Element/Work/Rarity 分组索引）
/pals/{pal-name}/          → Pal 详情页 ×319（模板生成，S/A/B 三级深度）
/breeding-calculator/      → 配种计算器（交互工具）
/pal-finder/               → Pal 筛选器（决策工具）
/guides/                   → 精选指南（4 篇：3 自动 + 1 半自动）
/about/                    → 关于站（EEAT 信号）
/privacy/ /terms/ /cookie-policy/  → 合规 + AdSense 审核页面
```

### 2.2 与旧站的定位差异

| 维度        | palworldguides.com | palworldbase          |
| --------- | ------------------ | --------------------- |
| 核心产品      | 攻略文章               | **数据产品 + 决策工具**       |
| 用户意图      | "怎么玩"              | **"查数据 / 选哪个 / 怎么配"** |
| 页面重心      | FAQ 问答 → SEO 文本    | **交互组件 → 用户工具**       |
| 内容形式      | 叙事段落               | **数据面板 + 可视化 + 对比**   |
| 视觉        | 亮色为主               | **暗色优先**              |
| Google 分类 | 内容站                | **数据产品/工具站**          |

### 2.3 About 页面 + 合规页面 E-E-A-T 策略

Google 对游戏数据站的信任建立在三个问题上：谁在维护？数据从哪来？为什么可信？

**About 页面必须包含：**

1. **维护者信息** — 真人姓名或可验证身份，不写 "PalworldBase Team" 这种无人称
2. **数据来源声明** — 明确标注数据溯源：
   ```
   "Data sourced from wiki.gg (CC BY-SA 3.0), in-game testing, 
   and community-contributed breeding data."
   ```
3. **更新频率承诺** — 建立可信度：
   ```
   "Pal data is updated within 48 hours of each Palworld patch. 
   Last site-wide data refresh: {BUILD_DATE}."
   ```
4. **联系方式**：
   - 玩家联系/社区运营：`alex@palworldbase.net`
   - 技术支持/纠错反馈：`support@palworldbase.net`
   （每个 Pal 页底部也要有纠错反馈入口）
5. **为什么可信** — 一句话说清楚你的方法论：
   ```
   "Breeding calculations are verified against the Palworld breeding formula: 
   Child BP = floor((ParentA BP + ParentB BP) / 2). All 44,000+ combos 
   are algorithmically generated from this single verified formula."
   ```

> **详细法律页面内容规范（Privacy / Terms / Cookie Policy）见 §16**——这三个页面是 AdSense 审核的关键，需要单独规划。

**Pal 详情页底部数据溯源行：**

每个 Pal 页 footer 区域加一行：
```
Data last verified: {BUILD_DATE}. Source: wiki.gg (CC BY-SA 3.0). 
Report an error → support@palworldbase.net
```

---

## 3. 页面设计

### 3.1 视觉系统

- **暗色优先**：`:root` 使用 dark values，light 作为 `[data-theme="light"]` 覆盖
- **字体**：H1 + Logo 使用 **Orbitron**，正文使用 **Inter**（均 Google Fonts）
- **Glow 效果**：H1 和 Logo 使用 `text-shadow: 0 0 20px rgba(accent, 0.3)`
- **主题色**：电蓝 `#00d4ff`（Palworld 科技感 + 天空元素）
- **Pal 元素色系统**：每种元素有独立标识色，用于卡片边框、标签、进度条
- **卡片**：暗色玻璃态（`background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08)`）
- **移动端优先**：所有工具在 375px 宽度可用

### 3.2 首页分区

```
Hero（品牌 + 一句定位 + 4 个即时入口卡）
  ↓
核心工具区（Breeding Calculator + Pal Finder）
  ↓
热门 Pal 快捷入口（8 个高频搜索 Pal 卡片）
  ↓
数据库浏览（Element / Work Suitability / Rarity 三大入口）
  ↓
精选指南（4 篇：3 自动数据驱动 + 1 半自动 Breeding Explained）
  ↓
About PalworldBase（≥300 词原创内容，H2 section）
  ↓
Footer（极简版）
```

#### 3.2.1 Hero 区设计

**Hero 设计决策：无搜索框，嵌入迷你 Breeding Calculator。** 首页 Hero 不只是品牌区——它是 Calculator 的用户流起点。一个零 JS 的 `<form>` 让用户直接在首页选择两个父代 Pal，跳转到 Calculator 看结果。Google 解析到 `<form>` + `<select>` 会理解这个站的核心功能是育种计算。319 个 `<option>` = 319 个深度内链。

**Hero 布局：**

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  🎯  PalworldBase                        [Orbitron, glow] │
│     Pal Stats, Builds & Breeding — Compared       │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  🧬  Find What Two Pals Make              │    │
│  │                                          │    │
│  │  [Parent A ▾]  +  [Parent B ▾]           │    │
│  │                                          │    │
│  │  [Find Child Pal →]                       │    │
│  │                                          │    │
│  │  44K+ combinations · Instant results      │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  319 Pals analyzed · Peer-ranked, not raw stats  │
│                                                  │
│  ┌──────────┬──────────┬──────────┐              │
│  │ 🔥 S-Rank│ ⚡ New   │ 📊 Side  │              │
│  │ Top Pals │ Player   │ -by-Side │              │
│  │          │ Guide    │ Compare  │              │
│  └──────────┴──────────┴──────────┘              │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Hero 设计规格：**

| 元素 | 规格 | 说明 |
|------|------|------|
| 标题字体 | Orbitron 600, 电蓝 glow | 品牌识别 |
| 副标题 | `Pal Stats, Builds & Breeding — Compared` | 三大词 SEO 信号 |
| **迷你 Calculator** | `<form action="/calculator/" method="GET">` + 2 个 `<select>` + `<button>` | **零 JS**，纯 HTML 表单 |
| `<select>` 选项 | 319 个 `<option value="{slug}">{Name}</option>`，构建时生成，按字母序 | 319 个内链到 `/calculator/?parentA={slug}` |
| 统计数字 | `319 Pals · 44K+ combos` | 即时权威感 |
| 背景 | 纯黑 #0a0e14（CSS only） | LCP < 1s |
| 3 卡片落地页 | S-Rank → Pal Finder / New Player → Guide / Compare → Pal Finder 对比模式 | Calculator 已嵌入 Hero，不再需要独立卡片 |

**迷你 Calculator 的 SEO 价值：**

- `<form>` + `<select>` → Google 识别为交互功能 → 可能触发 SearchAction 富结果
- 319 个 `<option value="...">` = 319 个深度内链到 Calculator（锚文本 = Pal 名）
- 首页不再是静态品牌页，而是**交互工具的入口**——Google 理解的页面类型从 "WebPage" 变为 "工具型首页"

#### 3.2.2 即时价值区（3 卡片）

Calculator 已嵌入 Hero，即时价值区缩减为 3 卡片：

```
┌──────────────┬──────────────┬──────────────┐
│ 🔥 S-Rank    │ ⚡ New Player│ 📊 Side-by-  │
│ Top Pals     │ Guide        │ Side Compare │
│              │              │              │
│ See which    │ Everything   │ Compare any  │
│ Pals rank S  │ you need to  │ two Pals     │
│ in each role │ know in 3    │ across every │
│              │ minutes      │ stat         │
└──────────────┴──────────────┴──────────────┘
```

- 每个卡片含：emoji 图标 + 标题 + 一行描述（~10 词）
- 移动端：1×3 堆叠或 2+1 网格

#### 3.2.3 热门 Pal 快捷入口

8 个高频搜索 Pal 卡片（按 Google 搜索量 + 社区热度），覆盖不同元素和工作类型：

| Pal | 卖点 | 元素 |
|-----|------|------|
| Anubis | #1 Handiwork | Ground |
| Jetragon | #1 Speed | Dragon |
| Jormuntide Ignis | #1 Kindling | Fire/Dragon |
| Blazamut | #1 Mining | Fire |
| Frostallion | #1 Cooling | Ice |
| Lunaris | #1 Carry Weight | Neutral |
| Orserk | #1 Generating | Electric/Dragon |
| Lyleen | #1 Planting | Grass |

**设计规格：** Pal 图片 + 名称 + 一行卖点。图片复用 Pal 详情页 webp，不额外请求。点击进 Pal 详情页。

#### 3.2.4 数据库浏览入口

```
┌──────────────┬──────────────┬──────────────┐
│ 🔥 Browse by │ 🔧 Browse by │ ⭐ Browse by │
│ Element      │ Work Type    │ Rarity       │
│              │              │              │
│ Fire Water   │ Kindling     │ Legendary    │
│ Grass Ground │ Watering     │ Epic Rare    │
│ Electric Ice │ Planting …   │ Common       │
│ Dragon Dark  │ 12 types     │              │
│ Neutral      │              │              │
└──────────────┴──────────────┴──────────────┘
```

- 落地到 Pal Finder 对应筛选结果

#### 3.2.5 About PalworldBase（原创内容 section）

位置：首页底部，footer 上方。H2 标题 `## About PalworldBase`。

**内容要求：**
- ≥300 词原创（非 AI 模板文）
- 说明站点差异化（peer-ranked / three builds / shortest path / work breakdown）
- 数据来源声明（wiki.gg CC BY-SA + community datasheets + in-game testing）
- 使用指南（Looking for / Want to breed / Building a base / Comparing）
- 风格：直接、有用、不卖弄。不用 superlative（comprehensive/ultimate/best ever）

**关键词自然落点：** `Palworld stats`, `breeding path`, `peer comparison`, `best mining pal`, `best kindling pal` 在正文段落中自然出现，不做 keyword stuffing。

#### 3.2.6 Footer 修订（配合 About 独立 section）

Footer 左侧极简化——About 内容已独立成 section，footer 不重复：

```
┌──────────────────────────────────────────────────┐
│  PalworldBase — Pal Stats, Builds & Breeding     │
│  Data: wiki.gg (CC BY-SA). Errors? → support@... │
│                                                  │
├────────────────────┬─────────────────────────────┤
│                    │  TOOLS         INFO          │
│                    │  Calculator    About         │
│                    │  Pal Finder    Privacy       │
│                    │  All Pals      Terms         │
│                    │  Guides        Cookie Policy │
│                    │                Contact       │
│                    │                Sitemap       │
└────────────────────┴─────────────────────────────┘
```

左侧从原来的 6 行缩减为 2 行——站点一句话定位 + 数据来源/纠错邮箱。

### 3.3 Pal 详情页结构（新站独有）

```
┌─ Hero ─────────────────────────────────────┐
│  图片  │  Paldeck #126                      │
│        │  Jetragon — Dragon · Legendary     │
│        │  [元素标签] [稀有度] [角色]         │
│        │  "#1 in Speed among Dragon Pals"   │
├────────┴────────────────────────────────────┤
│  📊 Role Dashboard（雷达图式评分总览）       │
├─────────────────────────────────────────────┤
│  📈 Base Stats vs Peers                      │
│  （与同元素/同稀有度 Pal 的对比表 + 排名）    │
├─────────────────────────────────────────────┤
│  ⚔️ Skill Builds（Burst / Sustain / STAB 三套推荐）  │
├─────────────────────────────────────────────┤
│  🧬 How to Breed {Name}                      │
│  （Best Path + Guaranteed + What's Next）     │
├─────────────────────────────────────────────┤
│  🏭 Work Efficiency（重新设计的生产效率面板） │
├─────────────────────────────────────────────┤
│  📍 Acquisition（获取方式 + 刷新条件）        │
├─────────────────────────────────────────────┤
│  💰 Drops & Economy（掉落 + 经济价值分析）    │
├─────────────────────────────────────────────┤
│  🔄 Pal Comparison（交互式对比工具）          │
│  用户可选 2-3 个 Pal 并排比较                 │
└─────────────────────────────────────────────┘
```

**注意：无 FAQ section，无 FAQPage schema。**

### 3.4 全局 Footer

见 §3.2.6 — Footer 已配合 About 独立 section 简化为极简版（左侧 2 行 + 右侧 2 组菜单：TOOLS / INFO）。全站统一。

**设计规则：**

| 规则 | 说明 |
|------|------|
| 左侧极简 | 2 行：站点一句话定位 + 数据来源/纠错邮箱 |
| 右侧菜单精简为 2 组 | TOOLS（Calculator / Pal Finder / All Pals / Guides）/ INFO（About / Privacy / Terms / Cookie Policy / Contact / Sitemap） |
| 每个链接必须有 `title` 属性 | SEO 信号 |
| 邮箱用 `mailto:` 链接 | `<a href="mailto:support@palworldbase.net">` |
| 版权年份用构建日期动态生成 | `© {BUILD_YEAR}` |
| 菜单分 4 组 | Tools / Data / Info / Contact，组间有视觉分隔 |
| 不堆关键词 | Footer 是给人看的，不是 keyword stuffing 位置 |

**SEO 考量：**

- Footer 链接是全站每页都有的"站点级信号"，Google 通过它理解站点主题
- 链接锚文本保持稳定（不因页面不同而改变），帮助 Google 建立站点分类
- Footer 里的 About / Privacy / Terms 是 E-E-A-T 信号的一部分
- 不要在 footer 放 20 个热门 Pal 链接 → 那是 keyword stuffing，会被降权

### 3.5 全局 Header（方案 B — 扁平全展示）

**设计原则：** Google 爬虫拿到 HTML 就知道这个站有 5 个核心板块。零 JS 依赖，所有链接 `<a href>` 直接可抓。

#### 桌面端

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ⚡ PALWORLDBASE    Calculator  Pal Finder  All Pals  Guides  About │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| 元素 | 规范 |
|------|------|
| Logo | `PALWORLDBASE` · Orbitron · 20px · `letter-spacing: 0.08em` · 电蓝 `#00d4ff` · glow |
| Logo 图标 | `⚡` 或 SVG 闪电图标（电蓝），放在文字左侧 |
| Logo 链接 | `<a href="/">` — 点击回首页 |
| 导航项 | 5 个 `<a>` 标签，无下拉，无 JS |
| 导航文字 | Inter · 14px · medium · `color: rgba(255,255,255,0.75)` |
| 导航 hover | `color: #00d4ff` + 底部 2px 电蓝下划线滑入 |
| 当前页标识 | 当前页面对应的导航项：`color: #00d4ff` + 底部 2px 电蓝实线 |
| 布局 | Logo 左 + 导航链接右，flexbox `justify-content: space-between` |
| 背景 | `rgba(10, 14, 20, 0.85)` + `backdrop-filter: blur(12px)` |
| 位置 | `position: sticky; top: 0; z-index: 100` — 跟随滚动 |
| 高度 | 56px（桌面端）/ 48px（移动端） |

#### 移动端

```
┌──────────────────────────────────────┐
│  ⚡ PALWORLDBASE                      │  ← Logo 行
│  ← Calc | Finder | Pals | Guides | About →  │  ← 水平滚动导航
└──────────────────────────────────────┘
```

| 元素 | 规范 |
|------|------|
| 导航交互 | `overflow-x: auto; scrollbar-width: none` — 可左右滑动，隐藏滚动条 |
| 导航项 | `flex-shrink: 0; white-space: nowrap` — 不换行，不压缩 |
| 左右渐变提示 | 右侧 `linear-gradient(to left, bg, transparent)` 遮罩，暗示可滑动 |
| 当前页 | 滚动到可见位置（`scrollIntoView` 如果 JS 可用），否则用颜色标识 |

#### 导航项锚文本与 URL

| 导航文字 | URL | 用途 |
|---------|-----|------|
| Calculator | `/breeding-calculator/` | 配种计算器 |
| Pal Finder | `/pal-finder/` | Pal 筛选器 |
| All Pals | `/pals/` | Pal 数据库总览（§3.7） |
| Guides | `/guides/` | 4 篇精选指南列表页 |
| About | `/about/` | E-E-A-T 页面 |

#### 搜索框策略

搜索框**不在 Header 里**。放在：
- **首页**：Hero 区域独占，大号搜索框 + 自动补全
- **Pal 详情页 / 工具页**：不提供全局搜索（用户通过 Pal Finder 和 Calculator 完成查询）

> **理由**：Header 搜索框在每个页面都占空间但很少被用。把搜索集中在首页 Hero → 用户搜 Pal 的路径是"回首页 → 搜"或"去 Pal Finder → 筛选"。这比在导航栏塞一个小搜索框更符合实际使用习惯。

#### SEO 分析

- 5 个顶级 `<a href>` → Google 100% 抓取，PageRank 均匀分配
- 导航结构 = 站点内容模型声明：Google 看到 Calculator + Finder + Pals + Guides + About → 理解这是一个"工具+数据+指南"三位一体的站
- 扁平无下拉 → 没有 "重要性分层"：每个链接都是同等级别，Google 不会降低任何一个的权重
- `position: sticky` → HTML 在文档流顶部，Google 优先解析导航区域

### 3.6 颜色系统

#### 设计原则

1. **暗色背景优先** — 所有颜色在 `#0a0e14` 背景上达到 WCAG AA 对比度（≥4.5:1）
2. **元素色更饱和** — 用于卡片边框、标签、排名高亮，需要吸引眼球
3. **工作类型色稍收敛** — 用于小型 badge、等级指示器，不抢元素色的视觉层级
4. **同类色不强行区分** — Fire ≈ Kindling 视觉接近是合理的（生火），两者不会在同一组件中并列出现
5. **CSS 变量统一管理** — 构建时通过 `shared.css` 注入，模板中通过类名引用

#### 9 种元素色

用于：Pal 卡片顶部边框、元素标签、元素筛选按钮、Peer Comparison 进度条。

```
┌─────────────────────────────────────────────────────────────┐
│  Fire        Water       Grass       Ground      Electric   │
│  ● #ff6b4a   ● #4da6ff   ● #5cd859   ● #d4a040   ● #ffd940  │
│  warm-red    clear-blue  fresh-green earthy-gold bright-yel  │
│                                                             │
│  Ice         Dragon      Dark        Neutral                │
│  ● #64d8e8   ● #b080e0   ● #c860a0   ● #9098a8              │
│  cool-cyan   purple      magenta     slate                  │
└─────────────────────────────────────────────────────────────┘
```

| 元素 | CSS 变量 | Hex | HSL | 使用场景 |
|------|------|------|-----|---------|
| Fire | `--color-element-fire` | `#ff6b4a` | `hsl(8, 85%, 65%)` | 火系 Pal 卡片 + 标签 |
| Water | `--color-element-water` | `#4da6ff` | `hsl(210, 85%, 65%)` | 水系 |
| Grass | `--color-element-grass` | `#5cd859` | `hsl(118, 65%, 60%)` | 草系 |
| Ground | `--color-element-ground` | `#d4a040` | `hsl(39, 65%, 55%)` | 地面系 |
| Electric | `--color-element-electric` | `#ffd940` | `hsl(48, 95%, 63%)` | 电系 |
| Ice | `--color-element-ice` | `#64d8e8` | `hsl(187, 70%, 65%)` | 冰系 |
| Dragon | `--color-element-dragon` | `#b080e0` | `hsl(270, 60%, 69%)` | 龙系 |
| Dark | `--color-element-dark` | `#c860a0` | `hsl(325, 50%, 58%)` | 暗系 |
| Neutral | `--color-element-neutral` | `#9098a8` | `hsl(220, 12%, 61%)` | 无属性 |

#### 12 种工作类型色

用于：Work Suitability 等级 badge、工作筛选标签、Pal 详情页 Work Efficiency 面板。

```
┌─────────────────────────────────────────────────────────────┐
│  Kindling    Watering    Planting    Generating   Handiwork  │
│  ● #f07848   ● #58a0e8   ● #68c058   ● #f0c840    ● #e89840 │
│                                                             │
│  Gathering   Lumbering   Mining      Medicine     Cooling   │
│  ● #80b040   ● #b89050   ● #9098a8   ● #e870a0    ● #58c0c8 │
│                                                             │
│  Transporting  Farming                                      │
│  ● #60a0d0     ● #88b850                                    │
└─────────────────────────────────────────────────────────────┘
```

| 工作类型 | CSS 变量 | Hex | 说明 |
|------|------|------|------|
| Kindling | `--color-work-kindling` | `#f07848` | 生火（与 Fire 元素同色系） |
| Watering | `--color-work-watering` | `#58a0e8` | 浇水（与 Water 元素同色系） |
| Planting | `--color-work-planting` | `#68c058` | 播种（与 Grass 元素同色系） |
| Generating | `--color-work-generating` | `#f0c840` | 发电（与 Electric 元素同色系） |
| Handiwork | `--color-work-handiwork` | `#e89840` | 手工（独立暖色） |
| Gathering | `--color-work-gathering` | `#80b040` | 采集（黄绿色，区别于 Planting） |
| Lumbering | `--color-work-lumbering` | `#b89050` | 伐木（木质棕） |
| Mining | `--color-work-mining` | `#9098a8` | 采矿（石灰色，与 Neutral 元素同） |
| Medicine | `--color-work-medicine` | `#e870a0` | 制药（粉红，与 Dark 元素同色系） |
| Cooling | `--color-work-cooling` | `#58c0c8` | 冷却（与 Ice 元素同色系） |
| Transporting | `--color-work-transporting` | `#60a0d0` | 搬运（独立蓝） |
| Farming | `--color-work-farming` | `#88b850` | 牧场（草绿变体） |

#### 颜色使用规范

**元素色 — 高视觉层级：**
```css
/* 元素标签 */
.element-tag {
  background: var(--color-element-fire);
  color: #0a0e14;          /* 深色文字，不是白色 */
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
}

/* Pal 卡片顶部边框 */
.pal-card.fire {
  border-top: 3px solid var(--color-element-fire);
}

/* Peer Comparison 排名条 */
.rank-bar.fire {
  background: linear-gradient(90deg, var(--color-element-fire), transparent);
}
```

**工作类型色 — 中视觉层级：**
```css
/* 工作等级 badge */
.work-badge {
  border: 1px solid var(--color-work-mining);
  color: var(--color-work-mining);
  background: transparent;   /* 空心样式，不抢元素标签 */
  padding: 1px 8px;
  border-radius: 3px;
  font-size: 11px;
}

/* 工作等级进度条 */
.work-level-bar {
  background: var(--color-work-handiwork);
  opacity: 0.7;              /* 半透明，降低视觉重量 */
}
```

**设计规则：**
- 元素色用**实心填充**（标签、边框），视觉重量高
- 工作类型色用**空心/半透明**（边框 badge、半透明进度条），视觉重量低
- 两者不会在同一组件中并排密集出现，所以 Fire ≈ Kindling 的视觉接近不构成混淆
- 文本叠在元素色上时用 `color: #0a0e14`（深色），不是白色

---

### 3.7 Pal 数据库总览页（/pals/）

**定位：** 所有 Pal 的结构化索引。用户从 Header 点 "All Pals" 进来，按分组快速定位目标 Pal → 点进去看详情。不是搜索工具（那是 Pal Finder），是**浏览入口**。

**设计决策：纯文本列表，无图片。** 319 张缩略图即使 lazy load 也会让 DOM 巨大、首屏慢、Google 抓取耗时。这个页面的核心价值是"最快的找到目标 Pal 并点进去"——文本列表用户 1 秒扫完、页面 < 30KB（gzip ~8KB）、LCP < 0.5s。视觉展示留给 Pal 详情页。

#### 3.7.1 页面结构

```
┌─────────────────────────────────────────────────┐
│  H1: All 319 Pals                                │
│  Browse by Element, Work Suitability & Rarity    │
│                                                  │
│  📊 319 Pals · 9 Elements · 12 Work Types        │
│      · 4 Rarity Tiers                            │
├─────────────────────────────────────────────────┤
│                                                  │
│  ═══════════ Browse by Element ════════════      │
│                                                  │
│  ▸ 🔥 Fire (38)                                  │
│  ▸ 💧 Water (42)                                 │
│  ▸ 🌿 Grass (35)                                 │
│  ▸ 🏔 Ground (30)                                │
│  ▸ ⚡ Electric (28)                              │
│  ▸ ❄️ Ice (25)                                   │
│  ▸ 🐉 Dragon (22)                                │
│  ▸ 🌑 Dark (28)                                  │
│  ▸ ⚪ Neutral (31)                               │
│                                                  │
│  ═══════════ Browse by Work Type ═══════════     │
│                                                  │
│  ▸ 🔥 Kindling (18)                              │
│  ▸ 💧 Watering (15)                              │
│  ▸ 🌱 Planting (22)                              │
│  ▸ ⚡ Generating (12)                            │
│  ▸ 🔨 Handiwork (45)                             │
│  ▸ 🧺 Gathering (38)                             │
│  ▸ 🪓 Lumbering (20)                             │
│  ▸ ⛏ Mining (25)                                │
│  ▸ 💊 Medicine (12)                              │
│  ▸ ❄️ Cooling (10)                               │
│  ▸ 📦 Transporting (60)                          │
│  ▸ 🥕 Farming (8)                                │
│                                                  │
│  ═══════════ Browse by Rarity ════════════       │
│                                                  │
│  ▸ 👑 Legendary (5)                              │
│  ▸ 💎 Epic (~35)                                 │
│  ▸ 🔷 Rare (~95)                                 │
│  ▸ ⚪ Common (~144)                              │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 3.7.2 展开后的 Pal 列表（`<details>` 实现）

**纯 HTML，零 JS。** `<details>` 标签原生支持折叠/展开，Google 索引折叠内的文本，屏幕阅读器完全可访问。

```html
<details>
  <summary>🔥 Fire <span class="count">(38 Pals)</span></summary>
  <table class="pal-index-table">
    <thead>
      <tr>
        <th>Pal</th>
        <th>Paldeck #</th>
        <th>Key Strength</th>
        <th>Tier</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><a href="/pals/jormuntide-ignis/">Jormuntide Ignis</a></td>
        <td>#101</td>
        <td>#1 Kindling Lv4</td>
        <td><span class="tier-badge tier-s">S</span></td>
      </tr>
      <tr>
        <td><a href="/pals/blazamut/">Blazamut</a></td>
        <td>#96</td>
        <td>#1 Mining Lv4</td>
        <td><span class="tier-badge tier-s">S</span></td>
      </tr>
      ...
    </tbody>
  </table>
</details>
```

**每行 4 列：**

| 列 | 内容 | 生成方式 |
|----|------|---------|
| Pal | 名称 + `<a href="/pals/{slug}/">` | 构建时从 JSON 遍历 |
| Paldeck # | `#{number}` | `pal.number` |
| Key Strength | `#1 Kindling Lv4` / `Fastest Flying Mount` / `Best Early Game` | 从 `decision.bestFor` 和 stats 排名提取 |
| Tier | S / A / B badge | 从 `data/pal-tiers.json` 读取 |

**排序：Tier（S → A → B）→ Key Strength rank（#1 > #2 > ...）→ 名称字母序**

#### 3.7.3 Work Type 分组下的列表

与 Element 分组不同，Work Type 分组下每行显示该 Pal 在该工种的具体 Work Lv：

| Pal | Paldeck # | {Work Type} | Other Roles | Tier |
|-----|-----------|-------------|-------------|------|
| Jormuntide Ignis | #101 | Kindling Lv4 | — | S |
| Blazamut | #96 | Kindling Lv3 | Mining Lv4 | S |
| Ragnahawk | #74 | Kindling Lv3 | Transporting Lv3 | A |

#### 3.7.4 构建时生成逻辑

```
1. 从 data/pal-tiers.json 读取每个 Pal 的分级
2. 按 Element 分组：
   - 遍历 9 个元素
   - 筛选 classification.elements 包含该元素的所有 Pal
   - 按 Tier → 关键排名 → 字母序排列
   - 生成 <details> 块，每行 4 列
3. 按 Work Type 分组：
   - 遍历 12 个工作类型
   - 筛选 workSuitability.{type} > 0 的所有 Pal
   - 按 Work Lv 降序 → Tier → 字母序排列
   - 每行 5 列（多一列 Work Lv）
4. 按 Rarity 分组：
   - 4 组：Legendary / Epic / Rare / Common
   - 按 Tier → 字母序排列
5. 同一 Pal 在多个分组中出现 = OK（增加内部链接密度）
```

#### 3.7.5 SEO 设计

| 信号 | 值 |
|------|-----|
| Title | `All 319 Pals — Browse by Element, Work & Rarity | PalworldBase` |
| H1 | `All 319 Pals` |
| Description | `Browse all 319 Pals by element, work suitability, and rarity. Find the best Pal for every role — from mining to combat.` |
| Canonical | `<link rel="canonical" href="https://palworldbase.net/pals/">` |
| 内部链接 | 每个 Pal 至少被链接 2-3 次（Element 分组 + Work Type 分组 + Rarity 分组） |
| 页面大小 | < 30KB HTML（gzip ~8KB） |

#### 3.7.6 与 Pal Finder 的分工

| | /pals/ | /pal-finder/ |
|------|------|------|
| **定位** | 浏览索引 | 筛选工具 |
| **交互** | 展开 `<details>`，点击链接 | 筛选控件，实时结果 |
| **JS** | 零 JS | 需要 JS（筛选逻辑） |
| **输出** | 全量 Pal 结构列表 | 筛选后的 Pal 卡片 |
| **SEO** | 内部链接枢纽，每个 Pal 都有链接 | 筛选变化不产生新 URL |
| **用户意图** | "我要浏览" | "我要找到" |

---

### 3.8 404 页面

**定位：** 游戏感 + 快速回到有用页面。不是企业站 "Page Not Found" 风格，而是贴合 Palworld 主题的轻量错误页。

**设计：**

```
┌─────────────────────────────────────────────────┐
│                                                  │
│              🧬                                  │
│                                                  │
│         Pal Not Found                            │
│                                                  │
│    This Pal doesn't exist in the Paldeck.        │
│    Maybe it was bred away, maybe it never was.   │
│                                                  │
│    ┌──────────────────────────────────┐          │
│    │  🔍 Try Pal Finder               │          │
│    │  📋 Browse All 319 Pals          │          │
│    │  🧮 Breeding Calculator          │          │
│    │  🏠 Back to Home                 │          │
│    └──────────────────────────────────┘          │
│                                                  │
└─────────────────────────────────────────────────┘
```

**技术规格：**

| 项目 | 值 |
|------|-----|
| `<title>` | `Pal Not Found — PalworldBase` |
| `<meta robots>` | `noindex`（404 页不应被索引） |
| HTTP 状态码 | 404（Cloudflare Page Rule 或 `_headers` 文件） |
| 页面大小 | < 3KB 纯静态 HTML |
| JS | 零 |

**Cloudflare 配置：** 在 `_headers` 文件中为 `/404.html` 设置 `X-Robots-Tag: noindex`，并配置 Custom Error Page → 404 → `/404.html`。

### 3.9 站内搜索：不做

**确认：全站无搜索功能。**

| 理由 | 替代方案 |
|------|---------|
| 游戏数据库站用户行为 = 浏览/对比，非自由文本搜索 | — |
| Pal Finder（结构化筛选）覆盖"找 Pal"需求 | `/pal-finder/` |
| `/pals/` `<details>` 分组索引覆盖"浏览"需求 | `/pals/` |
| 引入 Fuse.js/Lunr 违背零 JS 设计原则 | — |
| `site:palworldbase.net {query}` 覆盖深度搜索 | Google 站内搜索 |
| Header 已无搜索入口（§3.5） | — |

---

## 4. 内容深度分级

不同 Pal 的搜索价值差异巨大，不能平等对待。

| 级别 | 数量 | 页面深度 | 广告位 | 典型 Pal |
|------|:--:|------|:--:|------|
| **S 级** | ~25 | 8 section + 手写 insight + 三套 Skill Build + What's Next | 2 | Jetragon, Anubis, Frostallion |
| **A 级** | ~80 | 8 section 全量（算法生成） | 1 | Felbat, Kitsun, Galeclaw |
| **B 级** | ~194 | 4 section 数据卡（无叙事、无 Build、无 Best Path） | 0 | Lamball, Chikipi, Cattiva |

### 4.1 分级方法论：三层漏斗（方案 C）

**设计理念**：90% 自动化 + 10% 人工校准。纯数据打分可能把"数值普通但社区热门"的 Pal 漏掉，纯人工审 319 个太累。三层漏斗用硬规则覆盖最明显的误判，只在边界线上做少量人工判断。

```
Layer 1（数据初筛 — 全自动）
  ┌─────────────────────────────────────┐
  │ 用打分模型跑 319 个 Pal             │
  │ 输出：S 候选 ~35 / A 候选 ~90 / B ~174 │
  └─────────────────────────────────────┘
                ↓
Layer 2（规则修正 — 全自动）
  ┌─────────────────────────────────────┐
  │ 硬规则覆盖数据偏差                  │
  │ 输出：S ~28 / A ~85 / B ~186        │
  └─────────────────────────────────────┘
                ↓
Layer 3（人工微调 — 边界审定）
  ┌─────────────────────────────────────┐
  │ 审查 S/A 边界线上下各 ~10 个 Pal    │
  │ 输出：最终 S ~25 / A ~80 / B ~194   │
  │ 调整写入 tier-overrides.json        │
  └─────────────────────────────────────┘
```

### 4.2 Layer 1：数据打分模型（全自动）

**设计决策：Work Lv4 不区分工种。** Kindling Lv4 和 Farming Lv4 分值相同。工种的搜索需求差异由 Layer 2 "唯一 Lv4 强制 S"和 Layer 3 人工修正覆盖。保持模型简单。

| 信号 | 分值 | 来源字段 | 说明 |
|------|:--:|------|------|
| Rarity = Legendary | +30 | `classification.rarity` | — |
| Rarity = Epic | +20 | `classification.rarity` | — |
| Rarity = Rare | +10 | `classification.rarity` | — |
| 任意 Work Lv4 | +25 | `workSuitability.*` | 不区分工种 |
| 任意 Work Lv3 | +15 | 同上 | — |
| isFlyable = true | +20 | `classification.isFlyable` | — |
| isRideable = true | +10 | `classification.isRideable` | — |
| statTotal 排名 Top 10% | +20 | `stats.hp+attack+defense+speed` | 百分位自适应，见下 |
| statTotal 排名 Top 10-25% | +10 | 同上 | — |
| breedingPower < 100（终局） | +15 | `breeding.breedingPower` | — |
| isBossEncounter = true | +10 | `acquisition.isBossEncounter` | — |
| 双元素 | +5 | `classification.elements.length >= 2` | — |
| 育种中心度 ≥3 | +15 | 构建时计算（见 §4.2.1） | 反映育种生态位重要性 |
| 育种中心度 = 2 | +10 | 同上 | — |

**statTotal 百分位计算**（构建时）：

```
1. 遍历全量 Pal，计算 statTotal = hp + attack + defense + speed
2. 排序，取 P90（前 10% 阈值）和 P75（前 25% 阈值）
3. statTotal ≥ P90 → +20；statTotal ≥ P75 → +10
```

**初始阈值：**

```
总分 ≥ 70 → S 候选
总分 35-69 → A 候选
总分 < 35 → B 候选
```

> **注意**：新增育种中心度信号后，S 候选阈值可能需要上调（原 ≥70 相当于 3 个中高分信号之和，加了第 13-14 个信号后总分上限提高）。**建议首轮跑完后看分布再校准阈值，首次构建用 ≥75。**

#### 4.2.1 育种中心度计算

**定义**：一个 Pal 的"育种中心度"= 该 Pal 作为父代（包括自身物种）能够直接生出的 S 级 + A 级 Pal 的**物种数**（不是组合数）。

```
育种中心度 = |{ ChildSpecies | (ParentA_Species = 本Pal 或 ParentB_Species = 本Pal) 
                           且 Child 的最终分级 ∈ {S, A} }|
```

**计算步骤（构建时）：**
1. 先跑 Layer 1+2，得到 S/A/B 初始分级
2. 对每个 Pal，遍历全育种组合（~44K），统计它能生出多少个不同的 S/A 级物种
3. 中心度 ≥3 → +15；中心度 = 2 → +10
4. 重新跑评分（含中心度信号），得到最终 Layer 1 分数

**示例：**
- Chikipi（BP=1500）生不出任何 S/A Pal → 中心度 0
- Relaxaurus（BP=270）通过中段 BP 能桥接出多个 S 级 Pal → 中心度可能 ≥5

**为什么用物种数而非组合数**：避免因某个 Pal 的配对组合特别多而虚高。物种数反映的是"有多少个有价值的子代"，而非"有多少种方式生同一个子代"。

### 4.3 Layer 2：硬规则修正（全自动）

数据打分有两个系统性偏差：① 新手 Pal 数值低但玩家可能搜索 ② Legendary Pal 数值必然高，不能因为某个 Legendary 数值相对低就掉到 A。

**规则按顺序执行（后面的可能覆盖前面的）：**

| # | 规则 | 动作 | 理由 |
|---|------|------|------|
| 1 | `rarity = Legendary` | → **强制 S** | Legendary 每个都有搜索价值 |
| 2 | `number ≤ 10` 且 `rarity = Common` | → **强制 B** | 新手教程宠（Lamball, Cattiva, Chikipi…），搜索量极低 |
| 3 | 某个 Work Lv4 **整个游戏只有 1 个 Pal 达到** | → **强制 S** | 独特性 > 数值 |
| 4 | 作为父代能生出 **≥2 个 S 级 Pal** | → **升一级** | 育种桥梁 Pal——生态位重要性不反映在自身数值上 |
| 5 | `isBossEncounter + rarity ≥ Epic` | → 升一级 | Boss 有话题度和搜索量 |
| 6 | `breedingPower < 100` | → 强制 S 或 A（看分数） | 终局 Pal，育种需求高 |
| 7 | 双元素 + `isFlyable` | → 升一级 | 多功能 Pal 搜索价值更高 |
| 8 | `decision.bestFor` 包含 ≥3 个类别 | → 升一级 | 用途广泛的 Pal 搜索意图更多 |

> **升一级** = B→A 或 A→S。**强制 S** = 不管 Layer 1 分数多少，直接 S。
>
> **规则 4（育种桥梁）**：如 B 级 Pal 恰好是 2+ 个 S 级 Pal 的关键父代 → 自动升 A。这比人工 hardcode 到 tier-overrides 更可靠——数据驱动，游戏更新时自动重新计算。

### 4.4 Layer 3：人工微调（边界审定）

Layer 1（含育种中心度）+ Layer 2 之后，审查 S/A 边界线上下各 ~10 个 Pal（共 ~20 个）。

**A+B 策略**：育种中心度（§4.2.1）已自动化抓取了"数值普通但育种生态位重要"的 Pal。Layer 3 聚焦在算法抓不到的信号——**社区热度、梗文化、视频内容量**——这些只有人能判断。

**判断标准：**

- 这个 Pal 出现在多少篇社区攻略里？（"Top 10 Pals" / "Best Base Workers"）
- YouTube 上有没有以它为主题的视频？（搜索 `"{Pal Name} Palworld guide"`）
- 玩家在 Discord/Reddit 问它的问题频率？
- 是 meme Pal 但搜索意图不是策略型吗？（如 Tocotoco → 强制 B）

**输出文件：** `data/tier-overrides.json`

```json
{
  "daedream": "S",
  "tocotoco": "B",
  "explanation": {
    "daedream": "Community favorite despite mid stats. High search volume.",
    "tocotoco": "Meme Pal. High awareness but zero strategy search intent."
  }
}
```

构建时读取：Layer 1+2 算出初始分级 → 用 `tier-overrides.json` 覆盖 → 得到最终分级。

### 4.4.1 完整构建流程

```
1. 加载全量 Pal JSON（data/pals/*.json）
2. 加载 breeding ranks（data/wiki-breeding-ranks.json）
3. Layer 1 v1（不含中心度）→ 得到初始分级
4. 计算育种中心度（§4.2.1）
5. Layer 1 v2（含中心度）→ 重新打分
6. Layer 2 硬规则 → 修正
7. Layer 3 → 读取 tier-overrides.json → 覆盖
8. 输出最终分级 → 写入 data/pal-tiers.json
9. 构建页面（根据分级选择模板深度）
```

### 4.5 B 级页面说明

B 级页面只展示结构化数据，不生成分析段落：
- 有 Stats 表格 + Work 面板 + Location 数据 + 全父代表格
- 没有 Skill Builds 推荐
- 没有 Best Path 标注
- 没有叙事文本（Role Dashboard / Peer Comparison / Verdict / "At a Glance" 摘要）
- 不挂广告

> **好处**：既避免了 thin content（有足够结构化数据），又避免了程序化内容嫌疑（不拼凑废话）。

### 4.6 维护流程

游戏版本更新后（新增 Pal、BP 调整、新 Legendary）：

1. 更新 `data/pals/*.json`（新增/修改）
2. 跑完整构建流程（§4.4.1 的 9 步）
3. 审查输出：
   - 新增 Pal 的分级是否合理
   - 因中心度变化而变动的 Pal（通常 < 10 个）
   - S/A 边界线的 Pal
4. 如需微调，更新 `tier-overrides.json`
5. 重新构建全站

**首次构建注意事项**：阈值（S ≥75, A ≥35）是估值的——首轮跑完后检查分布，根据实际 S/A/B 数量比例校准。如果 Layer 1+2 输出 S 超过 30 个，上调 S 阈值；如果 A 超过 100 个，上调 A 阈值。

---

## 4.7 精选指南（4 篇）

**设计原则：能自动生成的绝不手写。** 4 篇指南中 3 篇从 Pal JSON 数据全自动生成（数据驱动排名页），1 篇半自动生成（机制解释 + 人工审核）。

### 4.7.1 指南总览

| # | 标题 | 类型 | 人工投入 | 搜索意图 |
|---|------|------|---------|---------|
| 1 | Best Base Workers — Mining, Kindling & More | 🟢 全自动 | 零 | `best mining pal` `best kindling` `best base workers` |
| 2 | Best Flying Mounts — Speed Ranking | 🟢 全自动 | 零 | `fastest flying mount` `best flying pal` |
| 3 | Best Combat Pals — DPS Ranking by Element | 🟢 全自动 | 零 | `best combat pal` `strongest pal` `best dps pal` |
| 4 | Palworld Breeding Explained | 🟡 半自动 | 审稿 | `palworld breeding guide` `how to breed` `breeding explained` |

**URL 结构：**
```
/guides/best-base-workers/
/guides/best-flying-mounts/
/guides/best-combat-pals/
/guides/breeding-explained/
/guides/                              → 指南列表页（4 篇索引）
```

### 4.7.2 🟢 全自动生成指南（#1-3）

**生成方式：** 构建时从 Pal JSON 数据提取、排序、生成 HTML。

**统一模板结构：**

```
┌─────────────────────────────────────────────┐
│  H1: {Title}                                │
│  Meta: Published {BUILD_DATE}. Data-driven  │
│  ranking from 319 Pals.                      │
├─────────────────────────────────────────────┤
│  📊 At a Glance（前三名速览表）             │
│  表头: Rank | Pal | Stat | Element | Role   │
├─────────────────────────────────────────────┤
│  🥇 Top 10 排名表（含子分类排名）           │
│  可排序: Name / Stat / Work Lv / Speed      │
├─────────────────────────────────────────────┤
│  ⚖️ Tier by Tier（Lv1→Lv4 各级最佳）        │
│  Work Lv4 → Lv1，每级列 Top 3              │
├─────────────────────────────────────────────┤
│  📝 How We Rank（方法论说明，100-150 词）    │
│  说明排序依据、数据来源、排名限制            │
├─────────────────────────────────────────────┤
│  🔗 Related: {其他 Guide 的链接}            │
└─────────────────────────────────────────────┘
```

**#1 Best Base Workers 数据逻辑：**

```
对 12 种 Work 类型分别：
  1. 按 workSuitability.{type} 降序排列
  2. 同级 Work Lv 内按 statTotal 降序
  3. 标注是否存在唯一 Lv4 Pal

页面结构：
  🥇 Mining（Top 5 + Lv4→Lv1 各级最佳）
  🥈 Kindling
  🥉 Watering
  ...
  Handiwork / Gathering / Lumbering / Cooling / ...
  （12 个 work type 独立表）
```

**#2 Best Flying Mounts 数据逻辑：**

```
1. 筛选 isFlyable = true
2. 按 rideSprintSpeed 降序
3. 副排序按 statTotal

额外维度：
  - 最快冲刺（Top 10）
  - 综合最佳（speed + stamina 加权）
  - 按元素分组的最快坐骑
```

**#3 Best Combat Pals 数据逻辑：**

```
1. 按 skill build DPS（Burst / Sustain）降序
2. 按元素分组，每组 Top 3
3. 标注 Legendary / Boss

额外维度：
  - 综合 DPS Top 10
  - 按元素 Top 3（覆盖所有 9 元素）
  - Legendary vs 非 Legendary 分别排名
```

### 4.7.3 🟡 半自动生成指南（#4 Breeding Explained）

**为什么半自动：** 机制解释需要自然语言段落，不能纯靠数据表。

**AI 生成 → 人审的流程：**

```
1. build.js 输出 HTML 框架（数据表 + 公共页头 + footer）
2. AI 写正文段落：
   - 育种公式解释（Child_BP = floor((A+B)/2)）
   - BP 表使用方法
   - "最短路径"算法原理（steps count + rarity sum）
   - Calculator 使用指南（选两个父代 → 看子代）
   - 常见误区（不是所有组合都可育种、稀有度不影响子代）
3. 人工审核：
   - 公式是否正确
   - 有没有社区已知的特例/例外
   - 补充 2-3 条"实际游戏中要注意"的经验提示
4. CSS class: .guide-content 渲染正文
```

**#4 Breeding Explained 页面结构：**

```
┌─────────────────────────────────────────────┐
│  H1: Palworld Breeding Explained            │
│  (手写 / AI+审)                             │
├─────────────────────────────────────────────┤
│  📐 How Breeding Works（公式 + BP 表逻辑）   │
│  (AI generated, ~200 词)                    │
├─────────────────────────────────────────────┤
│  🧬 Shortest Path Algorithm                 │
│  (从 §8.3 算法提取)                        │
├─────────────────────────────────────────────┤
│  🔢 Breeding Power Reference                │
│  表: Pal | BP | 最短路径需要几步            │
│  (自动生成，Top 50 常用 Pal)               │
├─────────────────────────────────────────────┤
│  ❓ Common Mistakes                         │
│  (AI + 人工补充)                            │
├─────────────────────────────────────────────┤
│  🧮 Try It: Breeding Calculator             │
│  (链接 + 简短说明)                          │
└─────────────────────────────────────────────┘
```

### 4.7.4 指南列表页（/guides/）

**数据：** 构建时自动生成，遍历 `/guides/` 下所有页面。

```
┌─────────────────────────────────────────────┐
│  H1: Palworld Guides                        │
│                                              │
│  ┌──────────┐ ┌──────────┐                   │
│  │ Base     │ │ Flying   │  ...              │
│  │ Workers  │ │ Mounts   │                    │
│  │          │ │          │                    │
│  │ Auto-    │ │ Ranked   │                    │
│  │ ranked   │ │ by speed │                    │
│  │ top picks│ │          │                    │
│  │          │ │          │                    │
│  │ [View →]│ │ [View →] │                    │
│  └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────┘
```

---

## 5. Meta 数据模板

### 5.1 Title 规范

**硬约束：≤60 字符。** Google SERP 截断线 ≈ 580-600px ≈ 60-70 英文字符。取 60 为安全上限，保证 95%+ 设备完整显示。

**品牌策略：** 首页和工具页带品牌前缀 `PalworldBase —`，Pal 详情页不加品牌后缀——Paldeck 编号 + 独特 Title 格式本身就是品牌信号。用户第二次搜到 `vs All Dragon Pals` 这种格式就知道是同一个站。

```
首页:
PalworldBase — Pal Stats, Builds & Breeding Compared              (57 ✅)

S 级 Pal:
{Name} Stats & Breeding — vs All {Element} Pals
例: Jetragon Stats & Breeding — vs All Dragon Pals               (52 ✅)
例: Jormuntide Ignis Stats & Breeding — vs All Dragon Pals       (60 ✅)

A 级 Pal:
{Name} | {Element} Pal: Stats & Breeding Path
例: Felbat | Dark Pal: Stats & Breeding Path                     (46 ✅)
例: Jormuntide Ignis | Dragon Pal: Stats & Breeding Path         (57 ✅)

B 级 Pal:
{Name} | #{N} {Element} Stats & Location
例: Lamball | #1 Neutral Stats & Location                         (44 ✅)

Breeding Calculator:
Palworld Breeding Calculator — Shortest Path to Any Pal           (60 ✅)

Pal Finder:
PalworldBase Pal Finder — Filter 319 Pals by Element, Work & Role (59 ✅)

指南页（每篇独立 Title，禁统一后缀）:
Best Base Workers — Mining, Kindling & Every Role Ranked           (59 ✅)
Fastest Flying Mounts — Speed Ranking for All Ridable Pals         (59 ✅)
Best Combat Pals — DPS Ranking by Element                          (50 ✅)
Palworld Breeding Explained — Formula, Shortest Paths & Calculator (67 → 见下)

> **Breeding Explained 超长处理**：67 字符超出 60 限制。缩短为：
> `Palworld Breeding Explained — Formula, Paths & Calculator`       (59 ✅)

> **设计原则**：禁止所有 Guide 使用统一后缀（如 `— Palworld Guide`）。统一后缀 = 程序化 SEO 信号，Google 会判为批量生成页面。每篇 Guide 的 Title 独立设计，用该篇独特的关键词结尾。
```

> **设计逻辑**：Pal 页是流量入口，319 页每页省下品牌后缀的 17 字符 → 换成 `vs All Dragon Pals` 这种差异化信号 → 点击率更高。品牌建设在首页和工具页完成。

#### 最长 Pal 名压力测试

以 `Jormuntide Ignis`（16 字符，最长的 Pal 名之一）验证：

| 模板 | Jormuntide Ignis 实际长度 | 判定 |
|------|:--:|:--:|
| S: `{Name} Stats & Breeding — vs All {Element} Pals` | `Jormuntide Ignis Stats & Breeding — vs All Dragon Pals` = 60 | ✅ |
| A: `{Name} \| {Element} Pal: Stats & Breeding Path` | `Jormuntide Ignis \| Dragon Pal: Stats & Breeding Path` = 57 | ✅ |
| B: `{Name} \| #{N} {Element} Stats & Location` | `Jormuntide Ignis \| #121 Dragon Stats & Location` = 56 | ✅ |

> 如果未来有超过 16 字符的 Pal 名，缩短 Element 名（`Dragon` → `Drag.` 不推荐）或去掉 `Path`（A 级）即可。

### 5.2 Meta Description 规范

**Description 只负责 CTR（点击率），不负责排名。**

三条规则：
1. **结构**：动作承诺 + 具体价值 + 一个数字
2. **回答"我为什么要点你"**，不是"这是什么"。写给人看，不是写给搜索引擎看
3. **必须与正文一致**：Google 经常不采用你的 description，而是从正文里挑一段。正文没有的功能/数字，别写进 description

禁止：
- 谎报数字
- 写页面没有的功能
- 重复标题内容
- 超过 155 字符被截断

#### 写之前问自己 5 个问题

1. 页面真有这个功能/数据？还是我编的？
2. 用户看到这行字，能多获得一个点击理由吗？还是只是把标题换了种说法？
3. 能删掉 3 个词但不减信息量吗？（能 → 删。越短，完整显示概率越高）
4. 有没有具象信号？（Best / Fastest / #1 / vs. / compared → 比 "Learn about" 更有力）
5. 数字在页面上找得到吗？（不在 → 删掉数字）

#### Google 改写与"页面内容合约"

Google 会改写 ~70% 的 meta description。Description 的真正价值不只在 SERP 展示——它是一份**页面内容合约**：

- 描述里写了 `"#1 in Speed among all Dragon Pals"` → 页面上必须真的有这个排名数据
- 写了 `"verified against formula"` → 页面上必须真的解释了这个公式
- Google 爬完页面发现正文兑现了描述里的承诺 → 更可能直接采用你的 description → SERP 里就是你要的效果
- 正文没有的内容写进 description → Google 从正文随便抽一段 → 可能抽到不完整的句子 → CTR 崩

> **红线**：描述不是"希望 Google 显示的样子"，而是"页面已经做到了的事情"。先有内容，后有描述。

#### Description 模板

```
首页:
Compare any Pal side-by-side. Find the shortest breeding path to any of the
319 Pals. 44,000+ combos, verified against the Palworld breeding formula.

S 级 Pal（排名型 — 如 Jetragon）:
{Name} ranks #{Rank} in {TopStat} among all {Element} Pals. Compare stats,
skill loadout, and every breeding path that produces {Name}.
{Stat1} {Val1}. {Stat2} {Val2}.

S 级 Pal（Work 型 — 如 Anubis）:
{Name}: {Work1} Lv {Lv1}, {Work2} Lv {Lv2} — {role summary}. {N} breeding
pairs that produce {Name}. Compared to every {Element} Pal.

A 级 Pal:
How does {Name} compare to other {Element} Pals? Stats, skills, and {N}
breeding pairs that produce {Name}. Best breeding path verified.

B 级 Pal:
Find every breeding pair that produces {Name}. Paldeck #{Number}.
{Element} · {Rarity}. HP {hp}, ATK {atk}. See all {Element} Pals
ranked by stats.

Breeding Calculator:
Find the shortest breeding path to any Pal. 44,000+ combos verified against
the Palworld breeding formula. Works both ways: parent + parent → child,
or target → parents.

Pal Finder:
Find the best Pal for your needs. Filter 319 Pals by element, work type,
mount, or rarity. Compare stats side-by-side.
```

#### S 级双模板说明

S 级 Pal 分两类，因为 CTR 钩子不同：

| 类型 | 特征 | CTR 钩子 | 示例 |
|------|------|---------|------|
| **排名型** | 在某个 Stat 上有绝对优势（#1-#3） | `ranks #1 in Speed among all Dragon Pals` | Jetragon, Frostallion, Shadowbeak |
| **Work 型** | 核心价值是工作适应性而非战斗 | `Handiwork Lv 4, Mining Lv 3 — best base worker` | Anubis, Astegon, Jormuntide Ignis |

判断逻辑（构建时）：
- 如果 `decision.scores[role] >= 90` 且该 role 在同类 Pal 中排名前 3 → 用排名型模板
- 如果 `workSuitability` 有 Lv3+ 且 `decision.bestFor` 包含 work 类别 → 用 Work 型模板
- 如果既排不进前 3 又没有高等级工作 → 降级为 A 级 Pal

> **原则**：不要为了用模板而强行说 "{Name} ranks #8 in HP"——排不进前三就不算"hook"，用 A 级模板更诚实。

#### 模板变量对照表

| 变量 | 数据来源 | 说明 |
|------|---------|------|
| `{Role}` | `pal.decision.bestFor[0]` | "Flying Mount" / "Mining" / "Combat" |
| `{N}` | `reverseBreeding[pal.slug].length` | 该 Pal 的配种父代组合数 |
| `{hp}` / `{atk}` / `{spd}` | `pal.stats` | 基础数值 |
| `44,000+` | 全量 breeding combos 总数 | 在 Calculator 页面显式标注 |

> **注意**：S 级描述中的排名（"#1"）和比较词汇（"every Dragon Pal"）必须对应页面上 Peer Comparison section 的实际内容。如果页面没有生成完整的同元素排名表，不要写 "every"。

### 5.3 H1 模板

**H1 必须复述 Title 的承诺。H1 是正文里最重要的关键词信号，不能只是一个名字。**

```
首页:
Pal Stats, Builds & Breeding — Compared

S 级 Pal:
{Name} Stats & Breeding — vs All {Element} Pals

A 级 Pal:
{Name} | {Element} Pal: Stats & Breeding Path

B 级 Pal:
{Name} | Paldeck #{Number} — {Element} Stats & Location

Breeding Calculator:
Shortest Path to Any Pal — Palworld Breeding Calculator

Pal Finder:
Filter 319 Pals by Element, Work & Role — PalworldBase Pal Finder

指南页（H1 = 对应 Title 去掉 `PalworldBase —` 前缀，如 Title 无此前缀则保持一致）:
Best Base Workers — Mining, Kindling & Every Role Ranked
Fastest Flying Mounts — Speed Ranking for All Ridable Pals
Best Combat Pals — DPS Ranking by Element
Palworld Breeding Explained — Formula, Paths & Calculator
```

> **原则**：H1 = Title 去掉品牌前缀（`PalworldBase —`），保留全部关键词信号。用户读完 H1 就知道这页能干什么。

### 5.4 首页 Title / Description

```
Title: (≤60 chars)
PalworldBase — Pal Stats, Builds & Breeding Compared

Description: (≤155 chars, CTR-optimized)
Compare any Pal side-by-side. Best skill builds for every Pal. Find the
shortest breeding path. 319 Pals, 44K+ combos — peer-ranked stats, not raw numbers.
```

### 5.5 程序化内容审计 ⭐ 全模板扫描

**审计范围：** PRD 中所有模板生成的文本模式——Title、Description、H1、section 标题、CTA 块、alt 文本、ai-summary、数据溯源行、Guide 页面模板。

**审计方法：** 逐项对照 Google 2026 年程序化内容（Programmatic Content / Scaled Content）判定信号——共享句子框架、统一后缀、同类页面结构雷同、段落级文本相同。

**风险分级：**

| 级别 | 含义 | 对策 |
|------|------|------|
| 🔴 高风险 | Google 大概率判定为批量生成模式 | 必须改——差异化或引入多样性 |
| 🟡 中风险 | 有可能被判定为模板化，但数据差异提供一定掩护 | 建议改——低成本增加多样性 |
| 🟢 低风险 | 自然模板化，Google 不视为程序化垃圾 | 不改——保持现状 |

---

#### 🔴 高风险项（必须修复）

##### 1. A 级 Description：所有页面以相同问句开头

**模式：**
```
How does {Name} compare to other {Element} Pals? Stats, skills, and {N}
breeding pairs that produce {Name}. Best breeding path verified.
```

**影响页面：** ~80 个 A 级 Pal 页
**Google 判定依据：** 80 个页面 description 以完全相同的 8 词序列 `"How does * compare to other * Pals?"` 开头——这是 Google 程序化内容检测器的最强信号之一（共享句子前缀）。
**修复方案：** A 级 Description 引入 3-4 个轮换模板，每个 Pal 根据其特征选模板：

```
模板 A（排名型 — 在某个 Stat 进入 Top 10）:
{Name} ranks #{Rank} in {Stat} among {Element} Pals. {N} breeding pairs,
stats breakdown, and best breeding path — verified.

模板 B（多功能型 — decision.bestFor ≥ 2）:
{Name} is a top {Role1} and {Role2} in Palworld. See how it stacks up
against other {Element} Pals — stats, skills, and {N} breeding pairs.

模板 C（育种价值型 — 组合数 N > 500）:
{N} possible parent pairs can produce {Name}. Compare stats vs other
{Element} Pals, and find the easiest breeding path.

模板 D（默认/通用 — 以上都不满足）:
{Name} stats, breeding paths, and how it compares to every {Element}
Pal. Paldeck #{Number}. {N} parent combos verified.
```

> **选模板逻辑（构建时判断）**：A 优先（有 Top 10 排名）→ B（多功能）→ C（高育种组合数）→ D（兜底）。确保 80 个页面均匀分布在 3-4 个模板中。

##### 2. B 级 Description：所有页面以相同短语开头

**模式：**
```
Find every breeding pair that produces {Name}. Paldeck #{Number}.
{Element} · {Rarity}. HP {hp}, ATK {atk}. See all {Element} Pals
ranked by stats.
```

**影响页面：** ~194 个 B 级 Pal 页
**Google 判定依据：** 194 个页面以相同的 6 词序列 `"Find every breeding pair that produces"` 开头——规模是 A 级的 2.4 倍，程序化信号更强。
**修复方案：** B 级 Description 引入 3 个轮换模板：

```
模板 A（默认）:
Every breeding pair that makes {Name} — Paldeck #{Number}.
{Element} · {Rarity}. HP {hp}, ATK {atk}. All {Element} Pals ranked.

模板 B（获取导向）:
Where to find {Name} and every way to breed it. Paldeck #{Number}.
{Element} · {Rarity}. Stats, locations, and all {Element} Pals compared.

模板 C（数据导向）:
{Name} (#{Number}) stats: HP {hp}, ATK {atk}, DEF {def}.
{Element} · {Rarity}. All {N} parent pairs that produce {Name}.
```

> **轮换策略（构建时）**：按 Paldeck Number % 3 分配到模板 A/B/C，确保均匀分布。比按特征分配更安全——Google 看到的不是 "194 个相同前缀" 而是 "三种前缀随机分布"。

##### 3. Pal 详情页 Section 标题：8 个 H2/H3 在 ~299 页中完全相同

**模式（从 §3.3 和 §8 模板提取）：**

| Section 标题 | 出现在多少页 | 相同程度 |
|-------------|:--------:|------|
| `📊 Role Dashboard` | ~105 (S+A) | 完全相同 |
| `📈 Base Stats vs Peers` | ~105 | 完全相同 |
| `⚔️ Skill Builds` / `⚔️ Skill Builds for {Name}` | ~105 | 前缀相同 |
| `🧬 How to Breed {Name}` | ~299 (全 S/A/B) | 前缀相同 |
| `🏭 Work Efficiency` | ~299 | 完全相同 |
| `📍 Acquisition` | ~299 | 完全相同 |
| `💰 Drops & Economy` | ~299 | 完全相同 |
| `🔄 Pal Comparison` | ~299 | 完全相同 |

**Google 判定依据：** 300 个页面共享 8 个完全相同的 section 标题 = 强程序化信号。Google 的页面结构分析会检测 "同一模板生成的页面"——共享 heading 层级是核心检测维度之一。
**修复方案：** 每个 section 标题注入一个页面特有的差异化元素，确保没有两个页面的同位置 H2 完全相同：

```
修复前 → 修复后

📊 Role Dashboard
  → 📊 How {Name} Performs（S 级）
  → 📊 {Name} at a Glance（A 级）

📈 Base Stats vs Peers  
  → 📈 {Name} vs {Element} Pals（S 级——显示对比对象）
  → 📈 {Name} Stats Compared（A 级）

⚔️ Skill Builds / ⚔️ Skill Builds for {Name}
  → ⚔️ Best Skills for {Name}（把 "Builds" 换 "Best Skills"——更自然）

🧬 How to Breed {Name}  ← 已有变量，低风险，不需改

🏭 Work Efficiency
  → 🏭 {Name} Base Work（S/A）
  → 🏭 Work Suitability（B 级——不需要 Pal 名）

📍 Acquisition
  → 📍 How to Get {Name}（S/A）
  → 📍 Where to Find {Name}（B 级）

💰 Drops & Economy
  → 💰 What {Name} Drops（S/A）
  → 💰 Drops & Materials（B 级）

🔄 Pal Comparison
  → 🔄 Compare {Name} Side-by-Side（S/A）
  → 🔄 Compare Pals（B 级——精简）
```

> **关键**：S 级和 A 级用不同的标题变体，B 级再用另一组。这样同一个 H2 永远不会在三种页面上完全相同。同级别内还有 Pal 名作为差异化变量。

##### 4. Content Upgrade CTA 块：段落文本完全相同

**模式（§7.2）：**
```
You just saw the shortest path. Want to see ALL combinations — including
ones that use Pals you already own?
```

**影响页面：** ~105 个 S/A 级 Pal 页
**Google 判定依据：** 105 个页面中出现完全相同的 2 句话 CTA 段落。Google 的 Boilerplate Detection 会识别并忽略这段文本，同时标记页面为模板生成。
**修复方案：** CTA 段落引入 3 个轮换文案：

```
变体 A（路径导向）:
You just saw the shortest path. Want to see ALL combinations — including
ones that use Pals you already own?

变体 B（选择导向）:
That's one path. But {Name} has {combinationCount} possible parent pairs.
Find the one that fits your roster.

变体 C（工具导向）:
There are {combinationCount} ways to breed {Name}. Open the Calculator
to find the easiest pair you can make right now.
```

> **轮换策略（构建时）**：按 Paldeck Number % 3 分配。`{combinationCount}` 已在设计中有唯一值，天然差异化。

##### 5. 图片 alt 文本：统一模板 319 页

**模式（§12.6）：**
```
"{Name} — {Element} {Rarity} Pal in Palworld"
```

**影响页面：** 319 个 Pal 详情页（主图）+ N 个卡片缩略图
**Google 判定依据：** 319 个图片 alt 使用同一句子框架。Google 图片搜索的 alt 分析会检测模板化 alt——相同结构 = 程序化图片。
**修复方案：** 引入 3 个 alt 模板轮换：

```
模板 A: "{Name} — {Element} {Rarity} Pal in Palworld"
模板 B: "{Name} ({Element}) · Paldeck #{Number} · Palworld"
模板 C: "{Name} Palworld — {Element} type, {Rarity} rarity"
```

> **轮换策略**：主图 alt 按 Paldeck Number % 3 分配。卡片缩略图全部用简短模板 `{Name} — Paldeck #{Number}`，与主图的轮换模板不冲突。

---

#### 🟡 中风险项（建议修复）

##### 6. S 级 Description：排名型/Work 型模板框架相同

**模式（§5.2）：**
```
排名型: {Name} ranks #{Rank} in {TopStat} among all {Element} Pals. Compare
stats, skill loadout, and every breeding path that produces {Name}. {Stat1}
{Val1}. {Stat2} {Val2}.

Work型: {Name}: {Work1} Lv {Lv1}, {Work2} Lv {Lv2} — {role summary}. {N}
breeding pairs that produce {Name}. Compared to every {Element} Pal.
```

**影响页面：** ~25 个 S 级 Pal 页
**Google 判定依据：** 25 个页面的描述前半句共享结构。规模小（~25），且描述后半句各有不同数值（{Stat1} {Val1}. {Stat2} {Val2}）提供自然差异。风险低于 A/B 级，但仍然值得多样化。
**修复方案：** 给 S 级 Description 加入一个"独特卖点句"——每个 Pal 页面的描述最后一句写该 Pal 最特别的一个事实（数据驱动，构建时自动选）：

```
末尾句候选（构建时按优先级选第一个适用的事实）：
- "Only Pal with {uniqueWork} Lv 4."（如果该 Work 全游戏唯一 Lv4）
- "Fastest non-Legendary flying mount."（如果 speed 在非 Legendary 中排 #1）
- "One of only {N} Pals with {rareSkill}."（如果有稀有的独特技能）
- "Breeding Power {BP} — among the hardest to breed."（如果 BP < 50）
- （无特殊事实 → 不额外加句，保持现有模板）
```

> 这样做的好处：描述不是靠轮换模板来"假装多样"，而是**每个 Pal 真的有不同的事实**。Google 看到的不是模板变体，是不同的事实陈述。

##### 7. ai-summary meta tag：统一结构 319 页

**模式（§12.9）：**
```
{Name} (#{Number}): {Elements}/{Rarity} {role}. Speed {Speed} (#{Rank}),
ATK {ATK}. Breed via {parentA} + {parentB}. Best for: {uses}. BP: {BP} ({stage}).
```

**影响页面：** 319 个 Pal 页
**Google 判定依据：** `ai-summary` 是面向 AI 搜索引擎的 meta tag（非 Google 排名信号），Google 不直接用它做程序化判定。但以统一结构给 AI 模型喂数据，AI 可能识别出"这是批量生成的摘要"。
**修复方案：** 不用轮换模板（AI 模型比 Google 更擅长检测模板轮换）。改为**保留结构但去掉模板感**——把 "Breed via" / "Best for" / "BP:" 这些 key:value 格式替换为自然句：

```
修复前:
"Jetragon (#126): Dragon/Legendary flying mount. Speed 230 (#1),
ATK 200. Breed via Frostallion + Necromus. Best for: flying exploration,
dragon combat. BP: 90 (endgame)."

修复后:
"Jetragon is the fastest flying mount in Palworld — 230 Speed, 200 ATK,
Dragon/Legendary type. Bred from Frostallion + Necromus. Used for
dragon combat and exploration. Endgame Pal (BP 90, one of the hardest)."
```

> **差异**：不是 `key: value` 列表，而是一个自然段。AI 读到的是一段人类写的描述，不是数据字段拼接。

##### 8. 数据溯源行：全站统一文本

**模式（§2.3）：**
```
Data last verified: {BUILD_DATE}. Source: wiki.gg (CC BY-SA 3.0).
Report an error → support@palworldbase.net
```

**影响页面：** 312 页全站
**Google 判定依据：** Google 的 Boilerplate Detection 会把全站相同的 footer 行识别为"模板外壳"——本身不扣分，但如果其他模板信号已经很强，叠加后会推高综合判定分数。
**修复方案：** 将 "Report an error →" 改为每页特有：
```
Data last verified: {BUILD_DATE}. Source: wiki.gg (CC BY-SA 3.0).
Something wrong with {Name}'s data? → support@palworldbase.net
```

> Pal 名变量让每页的溯源行都不同。12 字符的差异虽然小，但对 Google 的 Near-Duplicate Detection——319 个版本中同一位置的文本都不同 → 不像程序化生成。

##### 9. Guide 页面共享 section 标题

**模式（§4.7.2）：**

| 共享标题 | 出现位置 |
|---------|---------|
| `📊 At a Glance` | Guide #1, #2, #3 |
| `📝 How We Rank` | Guide #1, #2, #3 |
| `Data-driven ranking from 319 Pals.` | Guide #1, #2, #3（副标题） |

**影响页面：** 3 个全自动 Guide
**Google 判定依据：** 3 个页面不存在程序化判定问题（规模太小）。但 3 个页面共享标题会让 Google 将它们视为同一模板的实例——这 3 篇是在不同长尾词上竞争的页面，如果被 Google 归类为"同一模板"，可能只有 1 篇获得好排名。
**修复方案：** 每篇 Guide 用独立的标题：

```
修复前（三篇相同）:
📊 At a Glance
📝 How We Rank

修复后（每篇独立）:

#1 Best Base Workers:
📊 Top Workers at a Glance
📝 How We Rank Base Workers

#2 Best Flying Mounts:
📊 Fastest Mounts at a Glance
📝 How We Rank Flying Mounts

#3 Best Combat Pals:
📊 Top Combat Pals at a Glance
📝 How We Rank Combat Pals
```

##### 10. `📋 Full Skill Pool` / `📋 All Parent Combos` 子标题

**模式（§8.3 / §8.4）：**
- `📋 Full Skill Pool` — S/A 级 ~105 页完全相同
- `📋 All Parent Combos` — S/A 级 ~105 页完全相同
- `🧬 What's Next?` — S 级 ~25 页完全相同

**影响页面：** ~105 个 S/A 级 Pal 页
**Google 判定依据：** 这些是三级标题（H3/H4），Google 的 heading 结构分析覆盖所有级别的标题。中等规模（~105）共享完全相同的小标题。
**修复方案：**

```
📋 Full Skill Pool
  → 📋 All {Name}'s Skills（~105 页，每个 Pal 名不同）

📋 All Parent Combos  
  → 📋 All {N} Parent Pairs for {Name}（~105 页，每个组合数 + Pal 名不同）

🧬 What's Next?
  → 🧬 What to Breed After {Name}（~25 页，每个 Pal 名不同）
```

---

#### 🟢 低风险项（保持现状）

##### 11. Title 模板（§5.1）

S 级 `{Name} Stats & Breeding — vs All {Element} Pals`、A 级 `{Name} | {Element} Pal: Stats & Breeding Path`、B 级 `{Name} | #{N} {Element} Stats & Location` — 每个页面的 Element 名称、Paldeck 编号、Pal 名都不同，Google 不将变量化模板视为 duplicate title。**不改。**

##### 12. H1 模板（§5.3）

H1 = Title 去掉品牌前缀，与 Title 同逻辑。变量化程度足够。**不改。**

##### 13. Schema.org `VideoGameCharacter`（§12.1）

Game 数据站使用 `VideoGameCharacter` 是标准做法，Google 期望这个类型。319 个同类型 Schema 不触发 spam 判定。**不改。**

##### 14. BreadcrumbList（§12.1）

`Home > All Pals > {Name}` — 标准面包屑，Google 不将其视为程序化信号。**不改。**

##### 15. 全局 Footer / Header（§3.4 / §3.5）

全站统一的导航结构是正常网站特征，Google 用它们理解站点架构而非判定程序化。**不改。**

##### 16. Breeding Path 输出模板（§8.4）

`Best Path` / `Guaranteed Combo` 等标签——这些是数据面板的 UI 标签（类似表格列名），不是叙事文本。Google 对数据产品站的标签级文本不敏感。**不改。**但确保 B 级页面不加 `Best Path` 标注（已在 §8.5 和 §4.5 中规定）。

---

#### 📊 审计汇总

| # | 问题 | 风险 | 影响页数 | 修复方式 |
|---|------|:--:|:--:|------|
| 1 | A 级 Description 共享问句开头 | 🔴 | ~80 | 4 模板轮换 |
| 2 | B 级 Description 共享短语开头 | 🔴 | ~194 | 3 模板轮换 |
| 3 | 8 个 section 标题全站相同 | 🔴 | ~299 | 注入 Pal 名+级别变体 |
| 4 | CTA 段落文本完全相同 | 🔴 | ~105 | 3 文案轮换 |
| 5 | 图片 alt 统一模板 | 🔴 | 319 | 3 模板轮换 |
| 6 | S 级 Description 结构共享 | 🟡 | ~25 | 末尾加独特卖点句 |
| 7 | ai-summary key:value 格式 | 🟡 | 319 | 改为自然段落 |
| 8 | 数据溯源行统一文本 | 🟡 | 312 | 注入 Pal 名 |
| 9 | Guide 共享 section 标题 | 🟡 | 3 | 每篇独立标题 |
| 10 | 三级子标题共享 | 🟡 | ~105 | 注入 Pal 名+组合数 |
| 11-16 | Title/H1/Schema/Breadcrumb/Footer/Breeding标签 | 🟢 | 全站 | 不改 |

**修复后 Google 视角的变化：**

修复前 → 修复后：
- 319 个页面共享 8 个 section 标题 → 每个页面的同位置 H2 包含 Pal 名，全部不同
- ~80 个 A 级 description 以相同问句开头 → 3-4 种不同的句子开头均匀分布
- ~194 个 B 级 description 共享前缀 → 3 种前缀轮换
- ~105 个 CTA 块文本完全相同 → 3 种文案 + 唯一 combinationCount
- 319 个 alt 文本同模板 → 3 种 alt 模板 + Paldeck Number 轮换
- 312 页同数据溯源行 → 312 个唯一溯源行（Pal 名差异）

> **净效果**：不增加页面数量、不增加构建复杂度、不影响用户体验。所有修复都是模板层的变化——构建时选择不同的句子框架/标题/文案，但页面结构（section 顺序和内容）完全不变。

### 5.6 系统性规避策略 ⭐ 五层防御体系

§5.5 是"治标"——逐项修补模板信号。本节是"治本"——一套让 Google 根本不会触发程序化判定的系统架构。

#### Google 程序化检测的 6 维打分模型

Google 不是靠单一规则判定程序化内容，而是从多个维度打分，总分超过阈值才触发降权：

```
程序化判定分 ≈ 
    结构雷同度 × 0.30
  + 文本模板度 × 0.25
  + 规模因子   × 0.20
  + 深度差异度 × 0.15
  + 更新模式   × 0.10
  - 外部信号   （附加降分项）
```

每一维降低 30-50% → 总分降到阈值以下。不需要在任何一维做到完美，但每维都要有对策。

---

#### 维度 1：结构雷同度（权重 ~30%）

**Google 怎么检测：** 提取页面的 DOM 骨架（heading 层级 + section 顺序），同类页面做结构聚类。如果 300 个页面同位置出现相同的 H2 → 聚类收敛 → 高分。

**我们的对策：**

| 策略 | 方法 | 效果 |
|------|------|------|
| **条件渲染** | Section 是否渲染由数据驱动——`if hasUniqueSkill → render稀有技能高亮块`、`if isBoss → render Boss信息面板`、`if hasNoSTAB → 跳过 STAB Build section` | 不是每个页面都有相同的 section 组合 |
| **Section 顺序微调** | 战斗型 Pal：Skill Builds 在 Breeding 前面；工作型 Pal：Work Efficiency 在 Skill Builds 前面 | 同级页面之间也有结构差异 |
| **标题变量注入** | 每个 H2/H3 包含 Pal 名或级别变体（§5.5 第 3、10 项） | 同位置标题文本不同 |

**关键原则：** 不是 300 个页面 × 8 个固定 section = 2400 个相同 DOM 节点。而是页面结构由数据驱动——每个 Pal 的数据不同 → 渲染的 section 组合不同 → DOM 骨架不同。

**具体实现（构建时）：**

```javascript
// 不是硬编码 section 列表，而是根据 Pal 数据动态决定渲染哪些 section
const sections = [];

// 所有 Pal 都有的基础 section
sections.push(renderStats(pal));
sections.push(renderWorkEfficiency(pal));
sections.push(renderAcquisition(pal));

// 条件 section — 只有数据达标才渲染
if (pal.tier === 'S' || pal.tier === 'A') {
  sections.push(renderRoleDashboard(pal, allPals));
  sections.push(renderPeerComparison(pal, allPals));
  sections.push(renderSkillBuilds(pal));  // 如果 < 3 个技能，内部还跳过 Build 推荐
  sections.push(renderBreedingPath(pal, allPals));  // 如果是 Guaranteed Combo，输出不同结构
  if (pal.tier === 'S') {
    sections.push(renderWhatsNext(pal, forwardIndex));
  }
}

// 可选 section — 有数据才渲染
if (pal.drops && pal.drops.length > 0) {
  sections.push(renderDrops(pal));
}
if (pal.classification.elements.length === 2) {
  sections.push(renderDualElementNote(pal));  // 双元素 Pal 特有的分析块
}
if (pal.partnerSkill && isUnique(pal.partnerSkill)) {
  sections.push(renderUniquePartnerCallout(pal));  // 独特伙伴技能高亮
}
```

> **效果**：319 个页面中，B 级 ~194 个只有 4-5 个 section，S 级 ~25 个有 8-10 个 section，A 级 ~80 个在中间。section 数量分布本身就是反模板信号。

---

#### 维度 2：文本模板度（权重 ~25%）

**Google 怎么检测：** n-gram 分析——提取 3-5 词序列，在同类页面中统计出现频率。`"Find every breeding pair that"` 出现 194 次 → 强信号。

**我们的对策（三层递进）：**

##### 第 1 层：多模板轮换（基础——§5.5 已覆盖）

A 级 Description 4 模板、B 级 Description 3 模板、alt 文本 3 模板、CTA 文案 3 模板。轮换策略：按 `Paldeck Number % 3`（或 % 4）分配，确保均匀分布。

**但轮换本身不够。** Google 如果看到 3 种模板各出现 ~65 次，仍然能识别出"这是 3 个模板在轮换"。轮换只是把 1 个强信号拆成 3 个中等信号。

##### 第 2 层：变量位置分散化（进阶）

不是只在句子末尾换变量，而是让变量渗透到句子的不同位置：

```
❌ 差（变量只在末尾）:
{Name} ranks #1 in Speed. {Name} ranks #3 in ATK. {Name} ranks #2 in total stats.
→ Google 看到: "X ranks #N in Y. X ranks #N in Y. X ranks #N in Y."
→ 5-gram "ranks # in" 出现 300 次 → 强信号

✅ 好（变量位置分散）:
Among Dragon Pals, {Name} leads in Speed at 230.
Its ATK of 200 places it #3, behind only {PalA} and {PalB}.
Total stats: 1,200 — second only to {PalC} in the entire {Element} group.
→ Google 看到: 三个不同结构的句子，共享的只有 Pal 名
→ 没有 5-gram 在多个页面中出现
```

##### 第 3 层：数据驱动的事实选择（最优——核心策略）

不从模板库选句子——从数据中提取"值得说的事实"，然后为每个事实生成一句话：

```
构建逻辑:
1. 分析 pal.stats → 找出 Z-score > 1.5 的异常值（显著高于/低于同类均值）
2. 分析 pal.workSuitability → 找出 Lv3+ 的工种
3. 分析 pal.breeding → 找出组合数异常多（>500）或异常少（<10）的
4. 分析 Pal 排名 → 找出 Top 3 的维度
5. 选 2-3 个最值得说的事实（按 Z-score 绝对值降序）
6. 为每个事实生成一句话（每个事实类型有 2-3 个句式变体）

这样:
- Jetragon 的事实 = "Speed #1（Z=3.2）" + "BP=90 极难育种" + "唯二 Dragon/Legendary"
- Anubis 的事实 = "Handiwork Lv4（唯一）" + "784 种育种组合（Z=2.1）" + "Ground ATK #1"
- Chikipi 的事实 = "最基础 Pal" + "BP=1500 极易育种" + "牧场产蛋"
- 某个平庸 A 级 = "ATK 接近 {Element} 均值（Z=0.3）" + "3 种可行的育种路径"
                → 没有突出事实就诚实地说"平均水平"，不强行制造卖点

→ 每个 Pal 的描述由不同的事实组合构成，不是模板填充。
→ "平庸" Pal 也有独特描述——"This Pal is average" 本身就是一个诚实的事实陈述。
```

**这是核心差异：** 不是"80 个页面用 4 种模板"，而是"每个页面根据该 Pal 的异常数据生成 2-3 句独一无二的事实陈述"。

---

#### 维度 3：规模因子（权重 ~20%）

**Google 怎么检测：** 同类页面数量。319 个 Pal 页全部同一模板 → 规模因子直接拉满。

**我们的对策：**

| 策略 | 方法 | 为什么有效 |
|------|------|-----------|
| **三级内容深度** | S/A/B 三级已有本质差异——B 级无叙事、无 Build、无广告 | Google 不会把 B 级的精简数据卡和 S 级的深度分析页归为"同类页面" |
| **分批上线** | Day 1 只提交 ~30 个 S 级页面，Day 3 ~80 个 A 级，Day 7 ~194 个 B 级（§13.3） | Google 看到的是"站点在持续增长"而非"一次性灌入 319 个模板页" |
| **sitemap 分级** | 3 个独立 sitemap 文件（sitemap-s.xml / sitemap-a.xml / sitemap-b.xml），lastmod 日期不同 | Google 按 sitemap 分批抓取，同一批内同类页面数量 < 100 |

**关键洞察：** Google 对一个页面是否"模板生成"的判断不是只看它自己——它看同域名下同类页面的比例。B 级 194 个精简数据卡 + S 级 25 个深度分析页 → Google 看到的混合结构降低了综合判定分。

---

#### 维度 4：深度差异度（权重 ~15%）

**Google 怎么检测：** 页面长度/词数分布。如果 300 个页面都是 800-1000 词 → 模板。如果分布从 200 词到 3000 词 → 不像模板。

**我们的对策——三级深度天然差异化：**

| 级别 | 页面大小 | 词数估算 | Section 数 |
|------|---------|---------|:--:|
| S 级 | ~25KB | ~1500-2500 词 | 8-10 |
| A 级 | ~15KB | ~800-1200 词 | 6-8 |
| B 级 | ~8KB | ~200-400 词 | 4-5 |

**进一步的优化——S 级内部也不完全相同：**

手写 insight 块的长度也由数据驱动。Jetragon（有 5 个异常值）可能写 80 词，而某个边缘 S 级 Pal（只有 1 个突出维度）可能只写 20 词。**词数分布的自然不均匀**本身就是反模板信号。

**再加一个随机噪声——构建时对描述性段落的词数做 ±15% 的微调**（不改变事实，只调整措辞的详细程度）。这样即使两个 Pal 特征类似，词数也不会完全相同。

---

#### 维度 5：更新模式（权重 ~10%）

**Google 怎么检测：** lastmod 日期集中度。319 个页面的 sitemap lastmod 都是同一天 → 批量生成信号。

**我们的对策：**

| 策略 | 方法 |
|------|------|
| **分批 lastmod** | sitemap-b.xml 的 lastmod 设为上线日 + 7 天（而非与 sitemap-s.xml 同一天） |
| **手动页面独立日期** | 首页、工具页、Guides 的 lastmod 与 Pal 页不同 |
| **后续更新差异化** | 游戏更新时，只更新受影响 Pal 的 lastmod（≥2 个 Pal 数据变化的才批量刷新），不用全局刷 |
| **真实时间戳** | BUILD_DATE 用构建当天的真实日期，不回溯、不统一 |

> 上线后一个月的 sitemap lastmod 分布应该是：首页每天更新（About section 微调），S 级 Pal 页 2-3 次/月（数据修正），A 级 Pal 页 1-2 次/月，B 级 Pal 页 0-1 次/月。Google 看到的是"有更新节奏的活站点"。

---

#### 维度 6：外部信号（附加降分项）

Google 的判定不只是看页面本身——外部信号可以"救"一个模板化的站：

| 外部信号 | 作用机制 |
|---------|---------|
| **外链多样性** | 如果有 50 个不同域名链向不同的 Pal 页（而不是全链向首页），Google 会认为每个页面都有独立价值 |
| **搜索点击行为** | 如果 B 级页面也有稳定的搜索点击和低跳出率，Google 不会因为"模板生成"而降权——用户行为数据压倒算法推测 |
| **社交分享** | Pal 页被分享到 Reddit/Discord 时通常带具体的 URL → 外部信号证明页面不是无价值的自动生成页 |

**应用到我们的推广策略（§13.5 强化）：**

- 在 Reddit 发帖时，不链向首页——链向具体的 S 级 Pal 页（如 Jetragon 的 Peer Comparison section）
- 在 Discord 回答"怎么配 Anubis"时，链向 Anubis 的 Breeding section
- 每篇 Guide 页面底部推荐 2-3 个相关的 Pal 详情页——外部流量进来后有路径分散到各个 Pal 页
- Breeding Calculator 的分享链接带 `?target={pal-slug}` 参数 → 搜索结果中可能直接出现 Calculator + 具体 Pal 的组合 URL

---

#### 五层防御总结

```
Layer 1（PRD 已有）: 三级内容深度
  → S/A/B 页面结构、文本量、section 数本质不同
  → 打击"结构雷同度"和"深度差异度"两个维度

Layer 2（§5.5 审计修复）: 模板变量化
  → Description/section标题/alt/CTA 引入多模板 + Pal 名注入
  → 打击"文本模板度"维度

Layer 3（本节新增）: 事实驱动生成
  → 不从模板库选句子，从数据中提取值得说的事实
  → Z-score 异常值 → 事实选择 → 句式变体 → 独一无二的描述
  → 打击"文本模板度"维度的根因

Layer 4（§13.3 上线策略）: 分批上线 + 分级 sitemap
  → Day 1/3/7 分三批提交，sitemap lastmod 错开
  → 打击"规模因子"和"更新模式"两个维度

Layer 5（§13.5 推广策略）: 外部信号注入
  → 推广链接指向具体 Pal 页，不集中指向首页
  → 用外链多样性和用户行为数据压倒算法推测
```

**单靠任何一层都不够。五层叠加才能把 Google 的程序化判定分压到阈值以下。**

**构建时验证（上线前必须跑）：**

```bash
# 1. n-gram 扫描 — 检查共享文本序列
#    提取所有 Pal 页的 <p> 文本，统计 5-gram 频率
#    任何 5-gram 在超过 20% 的页面中出现 → 报告警告
node scripts/audit-ngrams.js dist/pals/

# 2. 结构指纹扫描 — 检查 section 顺序多样性
#    提取每个 Pal 页的 H2 序列（如 "Role Dashboard|Peer Comparison|Skill Builds|..."）
#    统计唯一序列数 — 应该 ≥ 10 种不同的 section 排列
node scripts/audit-structure.js dist/pals/

# 3. 词数分布检查 — 确认不是集中在窄区间
#    统计 Pal 页的词数分布 — 标准差应该 > 200（词数差异足够大）
node scripts/audit-wordcount.js dist/pals/
```

---

## 6. 关键词落点映射

### 6.1 每个目标长尾词必须在正文有自然落点

不做 keyword stuffing，但每个词要有"归宿"——正文段落、小标题、表格列名、FAQ 都算。

| 长尾词 | 首页落点 | Pal 页落点 | 工具页落点 |
|--------|---------|-----------|-----------|
| `shortest breeding path` | Hero 副标题 + 工具卡片描述 | Breeding Paths section 标题 | Calculator H1 + 表格列名 |
| `peer comparison` / `side-by-side` | 工具卡片描述 | Peer Comparison section H2 | — |
| `best flying mount` / `best mining pal` | 热门 Pal 卡片 alt 文本 | S 级 Pal 的 Role Dashboard 首句 | Pal Finder 筛选结果 |
| `Paldeck #{N}` | — | H1 下方 Paldeck 编号行 | — |
| `44,000+ combos` / `44K+` | 工具卡片数字标注 | Breeding section 首段 | Calculator hero 显式标注 |
| `319 Pals` | Hero 统计数字 + 首页多处 | — | Pal Finder "Showing X of 319" |
| `Palworld stats` | — | Stats section H2 | — |
| `breed {Name}` / `how to breed {Name}` | — | Breeding section "How to Breed {Name}" — Best Path + 全父代表格 | Calculator 反向结果 |

> **验证方法**：构建后跑一个脚本，检查每个目标词是否出现在对应的 HTML 结构中。缺了 → 模板补位。

### 6.2 核心功能必须首屏可见 + 可抓取

Google 抓不到 JS 动态渲染的内容。工具类页面的核心内容必须是**静态 HTML**，JS 只做增强。

| 页面 | 静态 HTML（Google 可见） | JS 增强（用户交互） |
|------|------------------------|-------------------|
| Breeding Calculator | 反向查找表单 + "How Breeding Works" 说明 + Popular Recipes 表格 | 自动补全下拉、计算结果展示 |
| Pal Finder | 筛选表单（input/select） + 默认展示 Top 20 Pal 卡片 | 实时筛选、排序切换、URL 同步 |
| Pal 详情页 | 所有 section 内容（Stats/Comparison/Breeding/Acquisition） | Comparison Widget（选 Pal 对比） |

> **红线**：用户不点任何按钮、不输任何内容时，页面上必须有可读的、可被 Google 抓取的核心内容。空白页面 = Google 空手而归。

---

## 7. 内部链接策略

**核心目标：Breeding Calculator 是全站权重最高的页面。** 它是 PalworldBase 最硬的护城河——44K 组合瞬时计算，零后端，竞品最难复制。

三个方向协同发力：

### 7.1 方向①：首页 Hero 嵌入迷你 Calculator（§3.2.1）

首页 Hero 不再是静态品牌区，而是一个零 JS 的 `<form>`：

```html
<form action="/calculator/" method="GET">
  <select name="parentA"> <!-- 319 <option>, 构建时生成 --> </select>
  <span>+</span>
  <select name="parentB"> <!-- 319 <option>, 构建时生成 --> </select>
  <button type="submit">Find Child Pal →</button>
</form>
```

**SEO 效果：**
- `<form action="/calculator/"` → 首页直接指向 Calculator，PageRank 单向汇聚
- 319 个 `<option value="{slug}">` = 319 个深度内链（锚文本 = Pal 名）→ Google 不视为 spam（每个链接目标 URL 参数不同：`/calculator/?parentA=anubis`）
- Google 解析到 `<form>` + `<select>` → 理解站点核心功能是"育种查询"

### 7.2 方向②：Pal 详情页 Content Upgrade CTA（S/A 级）

每个 Pal 页的 "How to Breed" section 底部，嵌入一个上下文 CTA 块——不是模板化的 "Try Calculator"，而是**每个 Pal 独有的数据驱动 CTA**：

```html
<div class="calculator-upgrade">
  <p>
    <strong>{Name}</strong> has 
    <strong>{combinationCount}</strong> possible parent pairs.
  </p>
  <p>
    You just saw the shortest path. 
    Want to see ALL combinations — including ones 
    that use Pals you already own?
  </p>
  <a href="/calculator/?child={slug}" class="cta-button">
    Open in Breeding Calculator →
  </a>
</div>
```

**设计规格：**

| 属性 | 值 |
|------|-----|
| 适用范围 | S 级 + A 级 Pal 页（~105 页） |
| B 级页面 | 不加（无 Breeding section） |
| 背景 | `rgba(0, 212, 255, 0.05)` + 左边框 `2px solid var(--color-accent)` |
| 锚文本变体 | `{combinationCount}` 每个 Pal 不同（784 / 1024 / 441...）→ 锚文本自然多样性 |
| 链接目标 | `/calculator/?child={slug}` → 带查询参数，数据可追踪 |

**SEO 效果：**
- ~105 个唯一的、上下文相关的 Calculator 链接
- 每个链接的周围文本不同（combinationCount 不同、Pal 名不同）→ 零模板痕迹
- 用户意图匹配：正在看 "How to Breed Anubis" → CTA 说 "看 Anubis 的所有组合" → 自然转化

### 7.3 方向③：Calculator → Pal 页反向链接（双向环）

Calculator 输出结果时，每个子代/父代 Pal 名都是链接，指回该 Pal 的详情页。

```
首页（Hero form）→ Calculator
319 Pal 页 → Calculator（~105 个 Content Upgrade CTA + Header/Footer 全域）
Calculator → 319 Pal 页（计算结果中的 Pal 名链接）
```

**双向环的 SEO 价值：**
- 不是单向 PageRank 汇聚——是双向流动
- Calculator 既是链接目标，也是链接来源
- Google 看到的图：Calculator 是全网中心节点，连接所有 Pal 页

### 7.4 全站 Calculator 链接密度

| 来源 | 页面数 | 每页链接 | 总链接 |
|------|--------|---------|--------|
| Header nav | 312 | 1 | 312 |
| Footer TOOLS | 312 | 1 | 312 |
| 首页 Hero `<form>` `<option>` | 1 | 319 | 319 |
| S/A 级 Content Upgrade CTA | ~105 | 1 | 105 |
| Guides #4 Breeding Explained | 1 | 2-3 | 3 |
| Guides #1-3 "How to get" 旁注 | 3 | 1 | 3 |
| /pals/ 页面顶部提示 | 1 | 1 | 1 |
| **合计** | | | **~1,055** |

> 注意：Header/Footer 的链接是所有页面的固定链接，Google 对其权重低于上下文链接（Content Upgrade / Hero form options）。但量 + 上下文多样性 = 强信号。

### 7.5 锚文本规则

- 全局导航：`Calculator` / `Breeding Calculator`（固定）
- 上下文链接：**动态锚文本**——
  - `{N} possible parent pairs`（Content Upgrade CTA）
  - `Find child pal`（Hero form button）
  - `breed {Name}`（Guides 内联）
- ❌ 不使用：`Click here` / `Try it now` / `Breeding tool`

### 7.6 禁止的链接模式

- ❌ 每页底部完全相同的 "Related Tools" 卡片组
- ❌ B 级页面强制加 Calculator 链接（无上下文）
- ❌ sidebar / floating button（需要 JS）
- ✅ 每个链接都有上下文——要么在 Breeding section 里，要么是 Hero 表单选项

---

## 8. 模板生成算法

### 8.1 旧站文本生成（已知模式 — 不再使用）

```javascript
// 旧站：介绍性叙事
renderSummary(pal)    → "{Name} is a {Element} {Rarity} Pal in Palworld."
renderVerdict(pal)    → "✅ Yes — best-in-class for {Work}."
renderPalFAQ(pal)     → "How do I get {Name}?" → 200 字叙述段落
```

### 8.2 新站文本生成（全新算法）

```javascript
// 新站：分析性/对比性文本
renderRoleDashboard(pal, allPals)  → 雷达图数据 + "Compared to {Element} average: {StatDiff}"
renderPeerComparison(pal, allPals) → "Among {Count} {Element} Pals, ranks #{Rank} in {Stat}"
renderSkillBuilds(pal)             → 三套 Build（Burst/Sustain/STAB），见 §8.3
renderBreedingPath(pal, allPals)   → 一条 Best Path + What's Next，见 §8.4
renderPalComparison(palA, palB)    → 交互式 JS，不是静态 HTML
```

### 8.3 Skill Builds 算法（三套推荐 + 全池展示）

**设计理念**：不用单一 "Optimal Combo" 这个词——不同战斗场景需要不同搭配。给玩家三套方案，让他们自己选。

#### 算法输入

```javascript
pal.skills[]           // [{name, element, power, cooldown, level}]
pal.classification.elements[]  // Pal 自身元素
pal.partnerSkill       // 伙伴技能（独立槽位，不算进 3 个技能槽）
```

#### 💥 BURST BUILD（爆发）

**场景**：Boss 战 — 在短时间窗口内打出最高总伤

```
算法：
  1. 从所有技能中取 power 最高的 3 个
  2. totalPower = sum(power of 3)
  3. rotationTime = max(cooldown of 3)  ← 最长冷却决定一轮时间
  4. 标注 "{totalPower} Power · {rotationTime}s rotation"
```

#### 🔄 SUSTAIN BUILD（持续）

**场景**：推图/刷怪 — 长时间战斗中每秒伤害最高

```
算法：
  1. 计算每个技能的 adjustedDPS = power / cooldown
  2. 取 adjustedDPS 最高的 3 个
  3. totalPower = sum(power of 3)
  4. rotationTime = avg(cooldown of 3)
  5. 标注 "{totalPower} Power · {rotationTime}s avg rotation"
```

#### 🎯 STAB BUILD（本系专精）

**场景**：打特定元素弱点的 Boss — 最大化同属性加成

```
算法：
  1. 筛选 element IN pal.elements 的技能
  2. STAB power = power × 1.2（Palworld 同属性 +20% 伤害）
  3. 按 STAB power 降序取前 3
  4. 标注 "Full STAB +20% · {totalSTABPower} Power · {rotationTime}s rotation"
```

#### 边界情况

| 情况 | 处理 |
|------|------|
| 技能总数 < 3 | 不推荐 Build，展示 "Limited skill pool — only {N} active skills" |
| 没有 STAB 技能 | STAB BUILD 显示 "No STAB skills available for this Pal" |
| Burst 和 Sustain 选了同一套技能 | Sustain 自动降级选次优组合（去重） |
| Pal 是双元素（如 Dragon/Fire） | 两种元素都享受 STAB +20% |
| 伙伴技能（Partner Skill） | 独立标注 `Ⓟ {PartnerSkillName}`，不占技能槽 |

#### 模板输出

```
⚔️ Skill Builds for {Name}

┌──────────────────────────────────────────────────┐
│  💥 BURST BUILD                                  │
│  Dragon Meteor → Fire Ball → Thunder Strike       │
│  385 Power · 18s rotation · Boss killer           │
│                                                   │
│  🔄 SUSTAIN BUILD                                │
│  Dragon Cannon → Fire Blast → Ice Cutter          │
│  220 Power · 9s avg rotation · Mob clearing       │
│                                                   │
│  🎯 STAB BUILD（Dragon +20%）                     │
│  Dragon Meteor → Dragon Cannon → Dragon Burst     │
│  420 Power · 22s rotation · Full STAB             │
│                                                   │
│  Ⓟ Partner Skill: Missile Launcher               │
│  ⚠ {Name} also learns Dragon Meteor —             │
│  one of only {N} Pals that can use it.            │
└──────────────────────────────────────────────────┘

📋 Full Skill Pool（全部可学技能表格，按 Power / CD / DPS 可排序）
```

### 8.4 Breeding Path 算法（一条 Best Path + What's Next）

**设计理念**：玩家只想要一个答案——"怎么用最容易的方式配出 {Name}？"不给三条路径让玩家选，直接给最优解。

#### 旧版问题（已废弃）

- Fastest 和 Easiest 经常选同一对父代（都用 BP 最高的）→ 两条路径重复
- "Best Parent" 不是玩家用语，且玩家配出一个 Pal 后想问的是"下一步用它配什么"而不是"它是最好的父代吗"
- 三个答案 = 认知负担。一个答案就够了。

#### ⚡ Best Path 算法

**目标**：找一条玩家实际操作成本最低的路径。

```
Step 1: 检查特殊配方（同种配同种、固定组合等）
  → 如果有，返回为 "✅ Guaranteed Combo"，不执行后续步骤

Step 2: 按"步骤数"对父代组合分组
  - 0 步：两个父代都 isCatchable=true（直接抓了配）
  - 1 步：一个父代需要育种（先配出父代，再配目标）
  - 2+ 步：链式育种

Step 3: 在同一步骤数内，按"父代总稀有度"排序
  - 稀有度量化：Common=1, Uncommon=2, Rare=3, Epic=4, Legendary=5
  - raritySum = parentA.rarity + parentB.rarity
  - 取 raritySum 最低的组合

Step 4: 难度标签
  raritySum ≤ 3  → 🟢 Easy
  raritySum ≤ 6  → 🟡 Medium
  raritySum ≤ 8  → 🟠 Hard
  raritySum > 8  → 🔴 Endgame

Step 5: 链式育种展开
  如果 Best Path 是 1 步（需要先育种父代）：
    递归调用 Best Path 算法获取父代的育种路径
    输出："Step 1: Breed {ParentA} via {parentBestPath}"
          "Step 2: Breed {ParentA} + {ParentB} → {TargetName}"
```

#### 🧬 What's Next 算法

**目标**：配出这个 Pal 之后，最有价值的下一步是什么？

```
1. 从 forwardBreedingIndex 获取该 Pal 作为父代能产出的所有子代
2. 按子代"价值"排序：
   value = getMaxScore(child) + rarityBonus(child)
   - getMaxScore = decision.scores 中最高 role 的得分
   - rarityBonus = Legendary → 15, Epic → 10, Rare → 5, 其余 → 0
3. 返回 Top 3
```

#### 模板输出

```
🧬 How to Breed {Name}

┌──────────────────────────────────────────────────┐
│  ⚡ Best Path                                     │
│  Catch {ParentA} at {habitatA}                    │
│  + Catch {ParentB} at {habitatB}                  │
│  → Breed them → {Name}                            │
│  Difficulty: 🟢 Easy                              │
│                                                   │
│  ✅ Guaranteed Combo（如果有特殊配方）             │
│  {SpecialParentA} + {SpecialParentB} → {Name}     │
└──────────────────────────────────────────────────┘

🧬 What's Next?
Breed {Name} + {Partner1} → {Child1}（{Role1} rated {Score}/100）
Breed {Name} + {Partner2} → {Child2}（{Role2}）
Breed {Name} + {Partner3} → {Child3}（{Role3}）

📋 All Parent Combos（全部合法父代组合 ×{N}，按难度排序，可筛选）
```

### 8.5 S/A/B 级差异化

| Section | S 级 | A 级 | B 级 |
|--------|------|------|------|
| **Skill Builds** | 三套 Build + 独特技能高亮 + 全池表格 | Burst Build + 全池表格 | 全池表格（不推荐 Build） |
| **Breeding Path** | Best Path + Guaranteed + What's Next + 全父代表格 | Best Path + 全父代表格 | 全父代表格（不标注 Best Path） |
| **Role Dashboard** | 雷达图 + allPals 排名 | 雷达图（算法生成） | 精简统计表 |
| **Peer Comparison** | 同 Element Top 5 排名表 + 对比洞察 | 同 Element 排名表 | 同 Element 列表（不排名） |
| **Drops & Economy** | 掉落 + 经济价值分析 | 掉落列表 | 掉落列表 |

### 8.6 与旧站的关键差异

| 维度 | 旧站算法 | 新站算法 |
|------|---------|---------|
| 文本性质 | 介绍性（"This is"） | 对比性（"Compared to / Ranks #"） |
| 技能推荐 | 无 | 三套 Build（Burst/Sustain/STAB） |
| 育种推荐 | 无（只展示 breeding 表格） | 一条 Best Path + What's Next |
| FAQ | 5 个标准问答 | 无（用数据面板替代） |
| Verdict | 判断句（"Yes — best-in-class"） | 排名句（"#3 among 12 Dragon Pals in ATK"） |
| S/A/B 分级 | 无（所有 Pal 同等对待） | 三级深度，B 级不生成叙事文本 |

---

## 9. Breeding Calculator 设计

### 9.1 核心算法

```
Child_BP = floor((ParentA_BP + ParentB_BP) / 2)
Child = Pal whose BP is closest to Child_BP
```

BP 数据源：`data/wiki-breeding-ranks.json`（需从 283 条补全至 323 条）。

### 9.2 两种模式

**模式 A：正向计算（Parent + Parent → Child）**
- 两个搜索框 + 自动补全（选父代 A 和 B）
- 结果：子代 Pal 名称 + 元素 + 工作适应性
- 场景："我手上有 A 和 B，能配出什么？"

**模式 B：反向查找（Target → All Parent Pairs）** ⭐ 默认模式
- 单搜索框 + 自动补全（选目标 Pal）
- 结果：所有父代组合表格，按难度排序
- 每条显示：Parent 1 / Parent 2 / Difficulty / BP Avg
- 特殊配方高亮标注 `✅ Guaranteed`
- 场景："我想配 Anubis，用什么配最容易？"

### 9.3 已确认的设计决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 默认模式 | 反向查找（满足搜索意图更强） |
| 2 | UI 形式 | 搜索框 + 自动补全 |
| 3 | 特殊配方 | 高亮标注 `✅ Guaranteed` |
| 4 | URL 参数 | 支持 `/breeding-calculator/?target=anubis` |
| 5 | BP 数值 | 默认隐藏，点击 "Show Details" 展开 |
| 6 | 难度分级 | 基于父代 BP 值：BP > 500 → 🟢 Easy, 200-500 → 🟡 Medium, 100-200 → 🟠 Hard, < 100 → 🔴 Endgame |

### 9.4 页面职责边界：Calculator vs Finder

两个页面不能互相抢词。职责先定归属，再动工。

| 维度 | Breeding Calculator | Pal Finder |
|------|-------------------|------------|
| **管什么** | 选父母看后代，选目标看配种路径 | 按条件筛选 Pal 列表 |
| **核心问题** | "用什么配出 Anubis？" / "A + B = ？" | "哪些 Pal 会挖矿 Lv3+ 且能飞？" |
| **目标长尾词** | `breeding calculator` / `breeding path` / `breed {Name}` / `shortest path` | `best {role} Pal` / `{element} {work} Pal` / `Pal finder` |
| **不抢的词** | 不优化 `best mining Pal` / `Pal list` | 不优化 `breeding calculator` / `breeding combo` |
| **页面间链接** | 结果卡片 → "See {Name} stats & comparison" 链接到 Pal 详情页 | 结果卡片 → "See {Name} stats & breeding" 链接到 Pal 详情页 |
| **互链锚文本** | "Find all {Element} Pals in Pal Finder" | "Find breeding path for {Name} in Breeding Calculator" |

> **上线前验证**：搜 `site:你的域名 "breeding calculator"` 和 `site:你的域名 "pal finder"` —— 确保各自页面的索引标题/描述没有抢对方的核心词。

---

## 10. Pal Finder 设计

### 10.1 筛选维度

| 维度 | 类型 | 选项 |
|------|------|------|
| Element | 多选 | Fire / Water / Grass / Ground / Electric / Ice / Dragon / Dark / Neutral |
| Work Suitability | 多选 + 等级滑块 | Kindling / Watering / Planting / Generating / Handiwork / Gathering / Lumbering / Mining / Medicine / Cooling / Transporting / Farming（Lv 1-4） |
| Rarity | 多选 | Common / Uncommon / Rare / Epic / Legendary |
| Mount | 多选 | Flying / Ground / None |
| Game Stage | 多选 | Early / Mid / Late |

### 10.2 已确认的设计决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 默认排序 | 按决策评分（decision.scores）降序，同分按 ATK 降序 |
| 2 | 结果展示 | 卡片网格（移动端 2 列，桌面端 4 列），每张卡片含名称 + 元素标签 + 核心统计 |
| 3 | URL 参数 | 支持 `/pal-finder/?element=dragon&work=mining_3`，利于 SEO 长尾和社交分享 |
| 4 | 筛选逻辑 | 多维度 AND 关系（同时满足所有条件），同维度多选 OR 关系 |

---

## 11. 技术方案

### 11.1 构建管线

```
data/pals/*.json          ──┐
data/game.json             ──┤
data/wiki-breeding-ranks   ──┼── node scripts/build.js ──→ dist/
data/decisions/*.json      ──┤
data/manual-pages.json     ──┘
```

- **零依赖**：纯 Node.js，不引入 npm 包
- **构建输出**：`dist/` 目录，每个页面独立文件夹 + `index.html`
- **CSS**：`shared.css`（全局设计系统） + `generated-components.css`（构建时生成的组件样式）
- **JS**：工具页内嵌 Vanilla JS，无框架
- **图片**：软链接或拷贝自旧站 `images/` 目录

### 11.1.1 数据抓取：wiki.gg Scraper（2026-08-09 完成）

**脚本：** `scripts/scrape-missing-pals.py`

**结果：44/44 成功抓取**（100%）

```
data/pals-new/amione.json ... woolipop_terra.json  (44 files)
```

**数据质量：**

| 类别 | 数量 | 说明 |
|------|------|------|
| 完整抓取 | 40 | 含 stats / element / work suitability / skills / partner skill |
| 未发布/占位 | 4 | Boltmane (已删除), Faleris Noct (空), Illuminant Bat (#0), Woolipop Terra (#0) |
| BP 已知 | 42 | 2 个 BP=None（Boltmane 已删除, Faleris Noct 无数据） |

**每个文件标记 `_needsReview` 的 7 个字段（需人工填写）：**
1. `skills[].power` — 技能威力（wiki 无此数据）
2. `skills[].cooldown` — 技能冷却时间
3. `skills[].element` — 技能元素类型映射
4. `stats.scale` — 属性成长倍率
5. `drops` — 掉落物列表（部分 wiki 有 `_rawDrops` 可解析）
6. `acquisition.habitats` — 栖息地位置
7. `decision.scores` / `decision.bestFor` / `decision.gameStage` — 决策引擎评分

**下一步数据工序：**
1. 从 `palworld-guide/data/pals/` 拷贝 279 个现有 Pal JSON
2. 合并 `pals-new/` 44 个文件，统一放到 `data/pals/`
3. 补充技能 game data（power/cooldown/element mapping）
4. 运行三层漏斗生成 `data/tier-overrides.json`

### 11.2 多语言架构（Phase 2+ 预留）

```
/en/pals/jetragon/    → 英文（Phase 1 默认）
/zh/pals/jetragon/    → 中文（Phase 2a）
/ja/pals/jetragon/    → 日文（Phase 2b）
```

- JSON 数据结构预留 `name.{lang}` / `partnerSkill.description.{lang}` 字段
- 构建命令：`node scripts/build.js --lang=zh`
- 每语言独立 sitemap，hreflang 交叉引用
- **Phase 1 不上线多语言**，但代码架构必须支持后续无缝扩展

### 11.3 部署

- 平台：Cloudflare Pages
- 域名：palworldbase.net
- 构建命令：`node scripts/build.js`
- 输出目录：`dist/`
- 自定义域名 + 自动 SSL

### 11.4 Core Web Vitals 性能目标

工具站有交互组件（自动补全、筛选、实时对比），性能直接影响排名和用户体验。

| 指标 | 目标 | 说明 |
|------|------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 首屏最大内容（通常是 Pal 图片或 Hero 区域） |
| INP (Interaction to Next Paint) | < 200ms | 替代 FID，测量所有交互延迟 |
| CLS (Cumulative Layout Shift) | < 0.1 | 防止图片/字体加载导致的布局跳动 |
| Mobile Lighthouse Score | > 90 | 综合性能/可访问性/最佳实践/SEO |

**实现策略：**
- Pal 图片使用 `<img loading="lazy" width="…" height="…">` 预占空间防 CLS
- Orbitron 字体使用 `font-display: swap` + 预加载
- 工具页 JS 使用 `type="module"` + 代码分割（自动补全数据懒加载）
- 静态 HTML 不加任何 render-blocking 资源
- **广告位必须预留固定高度容器**（`min-height` 或 aspect-ratio），防止广告加载后撑开布局 → CLS 飙升。详见 §16.4

---

## 12. SEO 技术清单

### 12.1 每页必须包含

- [ ] Unique `<title>`
- [ ] Unique `<meta name="description">`
- [ ] `<link rel="canonical">`
- [ ] Open Graph：`og:title` / `og:description` / `og:image` / `og:url` / `og:type`
- [ ] JSON-LD 结构化数据：
  - Pal 页：`VideoGameCharacter` + `BreadcrumbList`（**无 FAQPage**）+ `sameAs` 指向 wiki.gg
  - 工具页：`WebApplication` + `BreadcrumbList`
  - 首页：`WebSite` + `SearchAction`
  - Guides：`Article` + `BreadcrumbList`

### 12.2 全站级别

- [ ] `sitemap.xml` 包含所有页面
- [ ] `robots.txt` 指向 sitemap + AI crawler 规则（见 §12.7）
- [ ] `favicon.svg` 存在
- [ ] Favicon 多尺寸集（§12.2.1）
- [ ] 暗色默认（`:root` 用 dark values）
- [ ] 404 页面存在
- [ ] `llms.txt` 存在且内容按规范（见 §12.8）
- [ ] 无 AI 套话词（grep 扫描：comprehensive / ultimate / one-stop / dive in / master the / unlock the secrets / learn everything about / discover * stats / best ways to use）

### 12.2.1 Favicon 规格

**设计方案：** 方案 A（几何 P 字母标）— 电蓝 #00d4ff，暗色背景透明化。

**源文件：** `image_422188079025880.png`（1024×1024，AI 生成）

**生成文件（`assets/` 目录）：**

| 文件 | 尺寸 | 大小 | 用途 |
|------|------|------|------|
| `assets/favicon.ico` | 16+32 | 0.7 KB | 传统浏览器 fallback |
| `assets/favicon-16.png` | 16×16 | 0.7 KB | 小屏 bookmark |
| `assets/favicon-32.png` | 32×32 | 1.8 KB | 浏览器标签默认 |
| `assets/favicon-180.png` | 180×180 | 20 KB | Apple Touch Icon |
| `assets/favicon-192.png` | 192×192 | 22 KB | Android PWA |
| `assets/favicon-512.png` | 512×512 | 118 KB | PWA manifest / og:image 备用 |

**每页 `<head>` 必须包含：**

```html
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon-180.png">
<link rel="manifest" href="/manifest.json">
```

**⚠️ ✅ SVG 已生成**（446B，手写几何路径）— 见 `assets/favicon.svg`。

**og:image 方案：**

| 页面类型 | Phase 1 og:image | Phase 2 |
|---------|-----------------|---------|
| 首页 / 工具页 / Guides | `assets/og-default.png`（512×512 favicon） | 专用社交图 |
| Pal 详情页 | `/images/pals/{slug}.webp`（Pal 实机截图） | 自动生成叠加图（Pal 名 + 排名 + glow） |

**Phase 1 HTML 模板：**

```html
<!-- 首页 / 工具页 / Guides -->
<meta property="og:image" content="https://palworldbase.net/assets/og-default.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">

<!-- Pal 详情页 -->
<meta property="og:image" content="https://palworldbase.net/images/pals/{slug}.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

Phase 1 用已有资源，零额外设计。Phase 2 构建时自动生成叠加图。

### 12.3 上线后 48 小时内

- [ ] Google Search Console 提交 sitemap
- [ ] 手动请求首页抓取
- [ ] 确认 GSC 无 404/5xx
- [ ] 搜 `site:palworldbase.net` → 确认首页已索引
- [ ] Clarity 验证数据正常流入

### 12.4 上线后 SEO 检查清单

#### 解决什么问题

网站上线后 SEO 基础配置遗漏的问题——一个没配对的 canonical、一个没提交的 sitemap、一个写错的 robots.txt，都可能让搜索引擎抓不到你的站。

> **金句：上线不等于上线——搜索引擎能看到你的站，才叫真正上线。**

#### Canonical 检查

1. 检查首页 `<link rel="canonical" href="https://palworldbase.net/">` 是否存在
2. 确保指向的是主域名（非 www），不带末尾斜杠以外的多余路径

#### Sitemap 检查

确保 `https://palworldbase.net/sitemap.xml` 可访问，并提交到 GSC

#### Robots.txt 检查

1. 访问 `https://palworldbase.net/robots.txt`
2. 确认内容包含 `Allow: /` 和 `Sitemap: https://palworldbase.net/sitemap.xml`
3. 确认 AI crawler 规则已生效（见 §12.7）

#### llms.txt 检查

1. 访问 `https://palworldbase.net/llms.txt`
2. 确认该文件存在且按规范列出 AI/LLM 可抓取的内容入口（见 §12.8）

> llms.txt 是面向 AI 爬虫的内容声明文件，影响 AI 引用和 GEO 曝光

#### Google Search Console

添加 **Domain** 属性（非 URL prefix）：

> Domain 属性同时覆盖 http/https/www/non-www，一步到位。很多人不知道这个区别，结果发现只覆盖了一个子域名的数据。

#### Bing Webmaster Tools

绑定域名，开启 IndexNow

#### HTTPS 终极标准（七项全部通过）

| # | 检查项 |
|---|--------|
| 1 | `https://palworldbase.net` 可访问 |
| 2 | `http://palworldbase.net` 自动 301 到 https |
| 3 | `http://www.palworldbase.net` 自动 301 到 https |
| 4 | `https://www.palworldbase.net` 自动 301 到 https |
| 5 | 所有页面 canonical 指向 `https://palworldbase.net` |
| 6 | sitemap 使用 https |
| 7 | robots.txt 使用 https |

> 这七个检查项花不了 10 分钟，但漏掉任何一个，搜索引擎就可能抓错 URL、收录错误版本、或者干脆抓不到。

### 12.5 数据更新全站同步清单

当 Pal 数量、breeding combos 总数等基础数据发生变化时，以下位置必须同步更新。一处改了，处处改。

| 数据点 | 影响位置 | 检查方法 |
|--------|---------|---------|
| Pal 总数（如 319 → 330） | 首页 Hero 数字 / `<title>` / `<meta description>` / 所有提及 "319 Pals" 的段落 / Pal Finder "Showing X of N" / sitemap 条目数 | `grep -r "\b319\b" dist/` 确认全部替换为新值 |
| Breeding combos 总数（如 44K → 46K） | 首页工具卡片 / Calculator `<meta description>` / Calculator hero 段落 / 首页 description / 所有提及处 | `grep -r "44,000\|44K" dist/` |
| `game.lastUpdated` 日期 | sitemap `<lastmod>` / 首页 top-bar / Pal 页 top-bar / JSON-LD dateModified | 构建后检查 sitemap 日期与 game.json 一致 |
| 单个 Pal 数据（stats/skills/breeding） | 该 Pal 页所有 section + FAQ + JSON-LD + `<meta description>` + 同 Element ranking 页 | 重新构建该 Pal 页 + 所有引用该 Pal 的 ranking 页 |

**FAQ 额外规则**（适用于 Guide 页面和未来可能的 FAQ section）：

1. FAQ 正文与 JSON-LD **逐字一致**，问题数量一致
2. 正文说 "1 Cake 一次"，schema 就不能说 "多次"
3. 构建后验证脚本：提取页面中所有 `.faq-q` / `.faq-a` 文本 → 比对 JSON-LD `FAQPage.mainEntity` → 不一致则报错

**同步检查脚本**（构建后自动运行）：

```bash
# 检查 Pal 总数一致性
HOMEPAGE_COUNT=$(grep -oP '"totalPals":\s*\K\d+' dist/index.html)
SITEMAP_COUNT=$(grep -c '<loc>.*/pal/' dist/sitemap.xml)
if [ "$HOMEPAGE_COUNT" != "$SITEMAP_COUNT" ]; then
  echo "❌ Pal count mismatch: homepage=$HOMEPAGE_COUNT, sitemap=$SITEMAP_COUNT"
fi
```

### 12.6 图片 SEO

350 张 Pal 图片是可观的图片搜索流量来源。

**alt 模板：**

```
"{Name} — {Element} {Rarity} Pal in Palworld"
例: "Jetragon — Dragon Legendary Pal in Palworld"
```

**图片格式与尺寸：**
- 格式：WebP（已在用）
- Pal 页主图：600×600，`loading="eager"`（首屏）
- 卡片缩略图：200×200，`loading="lazy"`
- 所有 `<img>` 必须有 `width` / `height` 属性（防 CLS）

**可选增强（Phase 2）：**
- 生成独立 `image-sitemap.xml` 提交给 GSC
- Pal 图片加结构化数据 `ImageObject`

### 12.7 AI Crawler robots.txt 规则

2026 年，AI 爬虫已成主要流量来源之一。默认 robots.txt 只管理 Google/Bing，必须显式配置 AI 爬虫访问权限。

```
# === Google / Bing (search indexing) ===
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /

# === AI crawlers (GEO discoverability) ===
User-agent: GPTBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: anthropic-ai
Allow: /

# === Rate limiting (protect origin from scraping storms) ===
Crawl-delay: 10

# === Sitemap ===
Sitemap: https://palworldbase.net/sitemap.xml
```

> **注意**：`Crawl-delay: 10` 对所有 bot 生效。如果上线后发现 Google 抓取频率不够，可以只对 AI crawler 组设置 delay，Googlebot 单独放开。

### 12.8 llms.txt 内容规范

`/llms.txt` 是 AI/LLM 爬虫的第一入口文件。没有它，AI 模型可能根本不知道你的站有什么内容。

**文件位置：** `https://palworldbase.net/llms.txt`

**内容规范（遵循 llms.txt 标准）：**

```markdown
# PalworldBase — Palworld Data Platform
> Pal stats, peer comparison, and shortest breeding paths for all 319 Pals.
> Data verified against Palworld breeding formula. Updated {BUILD_DATE}.

## Core Tools
- Breeding Calculator: https://palworldbase.net/breeding-calculator/
  Find the shortest path to breed any Pal. 44,000+ combos.
- Pal Finder: https://palworldbase.net/pal-finder/
  Filter 319 Pals by element, work type, mount, rarity. Side-by-side comparison.

## Pal Data (319 Pals, full structured data)
- All Pals index: https://palworldbase.net/pals/
- Example: https://palworldbase.net/pals/jetragon/
  Stats, skills, breeding paths, work efficiency, peer comparison, drops.

## Guides
- How Breeding Works: https://palworldbase.net/guides/breeding-explained/
  The BP formula explained: Child BP = floor((ParentA BP + ParentB BP) / 2)

## Optional
- Full Pal JSON data: https://palworldbase.net/data/pals/index.json
  Machine-readable index of all 319 Pal pages with last-updated timestamps.
```

**关键规则：**
1. 第一行用 `# Site Name — One-liner` 格式
2. `>` blockquote = 站点简短描述（1-2 句，AI 用于判断是否引用）
3. 每个链接后面跟 1-2 句说明（AI 用来决定引不引用这一页）
4. 只列出核心页面，不枚举 319 个 Pal（AI 通过 index.json 发现）
5. 构建时自动替换 `{BUILD_DATE}`

### 12.9 AI 引用锚点（`ai-summary` meta tag）

AI 模型引用你的内容时，通常从正文中随机抽取一段。这段文字可能断章取义，也可能不是你最想让 AI 引用的信息。

**解决方案：** 每个 Pal 页 `<head>` 中加入 `ai-summary` meta tag，给 AI 提供一个高度浓缩、结构化的摘要。

```html
<meta name="ai-summary" content="Jetragon (#126): Dragon/Legendary flying mount.
Speed 230 (#1), ATK 200. Breed via {parentA} + {parentB}.
Best for: flying exploration, dragon combat. BP: 90 (endgame).">
```

**格式规则：**
- `{Name} (#{Number}): {Elements}/{Rarity} {role}`
- 关键数值：Speed / ATK / 核心 Work 等级
- 最佳培育路径：最快的 1 对父母
- Best for：1-3 个用途
- BP 值 + 游戏阶段
- 控制在 300 字符以内

> **作用**：AI 模型抓取页面时优先读取 `ai-summary`，引用内容精确可控。不直接影响 Google 排名，但影响 AI 搜索引擎（Perplexity、ChatGPT Search、Google AI Overview）的引用质量。

### 12.10 Schema.org `sameAs` 实体消歧

`VideoGameCharacter` schema 支持 `sameAs` 属性，链接到外部权威实体。这对 Google Knowledge Graph 实体解析和 AI 实体消歧都重要。

```json
{
  "@type": "VideoGameCharacter",
  "name": "Jetragon",
  "sameAs": "https://palworld.wiki.gg/wiki/Jetragon"
}
```

- 每个 Pal 的 `sameAs` 指向 wiki.gg 对应页面
- wiki.gg 是 Google 已知的 Palworld 权威数据源
- 如果你的站和 wiki.gg 都说 Jetragon 的 Speed 是 230，Google 对数据的信任度更高
- AI 模型通过 `sameAs` 可以在知识图谱中正确合并实体

---

## 13. Phase 1 执行计划

### 13.1 页面清单（~310 页，一次性上线）

| # | 页面 | URL | 数量 | 类型 |
|---|------|-----|------|------|
| 1 | 首页 | `/` | 1 | 手动编写 |
| 2 | Pal 数据库总览 | `/pals/` | 1 | 构建时自动生成（§3.7） |
| 3a | S 级 Pal 详情页 | `/pals/{name}/` | ~25 | 模板 + 手写 insight |
| 3b | A 级 Pal 详情页 | `/pals/{name}/` | ~80 | 模板全量生成 |
| 3c | B 级 Pal 详情页 | `/pals/{name}/` | ~194 | 模板精简生成 |
| 4 | 配种计算器 | `/breeding-calculator/` | 1 | 手动 + JS |
| 5 | Pal 筛选器 | `/pal-finder/` | 1 | 手动 + JS |
| 6 | 精选指南 | `/guides/{slug}/` | 4 | 3 自动 + 1 半自动 |
| 7 | 关于/隐私/条款/Cookie | `/about/` `/privacy/` `/terms/` `/cookie-policy/` | 4 | 手动编写 + AdSense 合规 |
| 8 | 404 页面 | `/404.html` | 1 | 手动编写（§3.8） |
| | **合计** | | **~312 页** | |

### 13.2 上线前数据补全

- [x] ~~补全缺失的 20 个 Pal JSON~~ → 已完成 44 个（§11.1.1），待从旧站拷贝 279 个
- [ ] 修复 2 个编号为空的 Pal（cave_bat / enchanted_sword）
- [ ] 交叉补齐 breeding ranks
- [ ] 补齐新增 44 个 Pal 的 webp 图片
- [ ] 运行三层漏斗，确定 S/A/B 三级分类名单

### 13.3 索引提交策略

为避免新域名爬取预算浪费：

| 时机 | 提交内容 | 说明 |
|------|---------|------|
| Day 1 | 首页 + 工具页 + S 级 Pal（~30 页） | 高质量页面先被抓取 |
| Day 3 | A 级 Pal（~80 页） | 谷歌已开始爬取，第二批喂入 |
| Day 7 | B 级 Pal（~194 页） | 全量 sitemap 提交 |

> 做法：生成 3 个 sitemap 文件（`sitemap-s.xml` / `sitemap-a.xml` / `sitemap-b.xml`），通过 `sitemap-index.xml` 管理，按节奏提交到 GSC。

### 13.4 Phase 2+ 路线

| 阶段 | 内容 | 触发条件 |
|------|------|----------|
| Phase 2a | 中文站（zh）+319 Pal 页 + 首页 + 工具页 | 英文站稳定运行 1 个月 + GSC 显示非英文搜索需求 |
| Phase 2b | 日文站（ja） | 中文站上线后评估 |
| Phase 3 | 韩/德/法/西/葡 | 按 GSC 多语言搜索量数据决定优先级 |

### 13.5 权威建设策略（Phase 1.5）

新域名 DR = 0。310 页内容再高质量，没有外链支撑，排名天花板很低。上线后需要主动做权威建设。

#### 链接磁铁识别

Breeding Calculator 和 "We analyzed 44,000 breeding combos" 类数据内容天然适合被引用：

| 资产 | 为什么会被引用 | 推广渠道 |
|------|--------------|---------|
| Breeding Calculator | 工具型页面，玩家日常使用后自然分享 | Reddit r/Palworld, Discord, ProductHunt |
| 数据驱动文章 | "We analyzed all 44,000 breeding combos — here's what we found" — 有新闻价值 | Reddit, Hacker News, 游戏媒体投稿 |
| S 级 Pal 页 | 深度对比分析是 wiki 类站点没有的独特内容 | Discord 社区回答问题时引用 |

#### Phase 1.5 行动清单

- [ ] Breeding Calculator 提交到 ProductHunt（"Palworld Breeding Calculator" 标签：Developer Tools / Gaming）
- [ ] 在 Reddit r/Palworld 发布 1 篇数据驱动内容（非推广，纯价值分享）：
  ```
  标题: "I analyzed all 44,000+ breeding combos in Palworld.
         Here are 5 surprising things I found."
  ```
- [ ] 联系 Palworld wiki.gg / PalDB.cc 等社区站点做友情链接交换
- [ ] 在 Palworld Discord 的 #breeding-help 频道中，用 Breeding Calculator 回答配种问题（自然植入工具链接）
- [ ] 提交站点到 Google Merchant Center（如果后续有商业组件）

#### 关键原则

- **不买链接** — Google 手动惩罚风险极高，新站承受不起
- **不做 PBN**（Private Blog Network）— 2026 年的 Google 算法能识别
- **贡献式推广** — 先给社区提供价值（数据/工具/分析），链接是副产品，不是目的
- **内容资产的复用** — 一篇 Reddit 爆款帖子可以改成 Twitter thread、YouTube short、TikTok 视频

---

## 14. 任务拆解与执行顺序

### Step 1: 项目骨架
- [ ] 初始化目录结构
- [ ] 建立 `scripts/build.js` 基础框架
- [ ] 建立 `scripts/config.js`（域名/SEO 模板/导航定义）

### Step 2: CSS 设计系统
- [ ] `shared.css`：暗色主题变量 + 排版 + 布局 + 基础组件
- [ ] 元素色系统（9 个元素 + 12 个工作类型的标识色）
- [ ] 响应式断点（375 / 768 / 1024 / 1280）

### Step 3: 数据补全
- [ ] 生成/补全 20 个缺失 Pal JSON
- [ ] 补全 breeding ranks 到 323 条
- [ ] 修复数据异常（编号为空等）
- [ ] 确认 319 个 Pal 的 S/A/B 分级名单

### Step 4: 模板开发
- [ ] Pal 详情页模板（S/A/B 三级，共享基础框架 + 分支逻辑）
- [ ] 首页模板
- [ ] Pal 数据库总览页模板
- [ ] 工具页模板（Breeding Calculator + Pal Finder）

### Step 5: 构建脚本
- [ ] 数据加载器
- [ ] 模板渲染器（renderRoleDashboard / renderPeerComparison / renderSkillBuilds / renderBreedingPath / renderWhatsNext）
- [ ] sitemap 生成器（分三级生成）
- [ ] llms.txt 生成器
- [ ] AI crawler robots.txt 生成
- [ ] 构建执行入口

### Step 6: 手动页面
- [ ] 首页
- [ ] Pal 数据库总览
- [ ] 配种计算器（HTML + JS）
- [ ] Pal 筛选器（HTML + JS）
- [ ] 精选指南 4 篇（3 自动数据驱动 + 1 半自动）
- [ ] About / Privacy / Terms

### Step 7: 部署
- [ ] Cloudflare Pages 配置
- [ ] 域名绑定（palworldbase.net）+ SSL
- [ ] 首次构建 + 部署
- [ ] GSC 提交 + 索引监控

---

## 15. 执行就绪确认

所有重大决策已锁定，无遗留待讨论项：

- ✅ 旧站不动，新站独立
- ✅ 域名：palworldbase.net
- ✅ 319 Pal 全量一次性上线（279 旧站 + 44 新抓取）
- ✅ S/A/B 三级内容深度（三层漏斗：13 信号打分 + 8 硬规则 + 人工微调）
- ✅ 反重复七维策略
- ✅ 不做 FAQ
- ✅ 首页 + Hero 设计（无搜索框，4 卡即时价值区，About ≥300 词）
- ✅ /pals/ 总览页（`<details>` 手风琴，纯文本，零 JS）
- ✅ 精选指南 4 篇（3 自动 + 1 半自动）
- ✅ Breeding Calculator 设计锁定
- ✅ Pal Finder 设计锁定
- ✅ Meta 模板锁定（含品牌后缀策略）
- ✅ 暗色 + Orbitron + glow + 电蓝
- ✅ Favicon 完整就绪（SVG + 6 PNG + ico）
- ✅ og:image Phase 1 方案（默认 + Pal webp）
- ✅ 404 页面设计
- ✅ 站内搜索：确认不做
- ✅ Node.js 纯静态 + Cloudflare Pages
- ✅ 多语言架构预留
- ✅ 分级 sitemap 提交策略
- ✅ E-E-A-T 策略（About 页面 + 数据溯源 + sameAs）
- ✅ AI crawler robots.txt 规则
- ✅ llms.txt 内容规范
- ✅ AI 引用锚点（ai-summary meta tag）
- ✅ 图片 SEO 规范
- ✅ CWV 性能目标
- ✅ Phase 1.5 权威建设策略
- ✅ AdSense 合规（Privacy / ToS / Cookie Policy / 同意弹窗）
- ✅ 程序化内容审计（§5.5：10 项风险识别，5 项🔴+5 项🟡 含修复方案 + §5.6：五层防御体系 + 构建时验证脚本）

---

## 16. AdSense 合规与广告变现策略

### 16.0 为什么这一章重要

Google AdSense 审核不只看你有没有 Privacy Policy 页面——它看内容质量、页面结构、Cookie 处理机制、以及站点是否在为"展示广告而生"而非"为用户而生"。

**三个核心风险：**

| 风险 | 后果 |
|------|------|
| Privacy Policy 不完整或 Cookie 未声明 | AdSense 审核直接拒绝 |
| 内容过薄（thin content） | "Low Value Content" 拒绝 |
| 广告位干扰用户体验（CLS / 遮挡内容） | Google 算法降权 + AdSense 限流 |

本章解决这三个问题。

### 16.1 Google AdSense 审核的核心要求

#### 内容质量要求

| 要求 | 我们的情况 | 对策 |
|------|----------|------|
| 原创性 | 279 个旧站页面可能被判定为重复 | 七维反重复策略（§1） + 分析性/对比性文本 |
| 实质性 | B 级 194 个页面只有数据卡 | B 级页面不挂广告（见 §16.4） |
| 更新频率 | 游戏有版本更新时数据会变化 | 首页 + About 页声明更新承诺 |
| 语言 | 英文内容优先（AdSense 审核语言） | Phase 1 全英文 |

> **AdSense 红线**：不要为了展示广告而生成页面。B 级 194 个 Pal 页如果只有 3 行数据 + 1 个广告位，Google 会判定为 "Made for AdSense" → 拒绝或封号。

#### 必需要有的页面

Google AdSense 审核员会手动检查以下页面是否存在且内容完整：

| 页面 | 必须包含的内容 | 没有的后果 |
|------|-------------|----------|
| **Privacy Policy** | Cookie 使用声明 + Google 广告个性化说明 + 用户权利 + 联系方式 | 直接拒绝 |
| **Terms of Service** | 免责声明 + 知识产权 + 用户行为规则 | 可能延迟审核 |
| **Cookie Policy / Consent** | Cookie 类型说明 + 同意机制 + 退出方式 | GDPR 违规 + 拒绝 |
| **About / Contact** | 真实身份 + 联系方式 + 站点目的 | E-E-A-T 不足 |

### 16.2 Privacy Policy 内容规范

**页面 URL：** `/privacy/`

**必须包含的 7 个 section：**

```
1. Information We Collect
   - Log data (IP, browser type, pages visited) — Cloudflare Pages 默认收集
   - Cookies (详见 Cookie Policy 页)
   - Contact information (if user emails us)

2. How We Use Your Information
   - Improve site content and functionality
   - Respond to user inquiries
   - Display relevant advertisements (Google AdSense)

3. Cookies and Tracking Technologies
   - Essential cookies (no consent needed)
   - Analytics cookies (Microsoft Clarity)
   - Advertising cookies (Google AdSense)
   - Link to full Cookie Policy page

4. Third-Party Services
   - Google AdSense ("Third-party vendors, including Google, use cookies
     to serve ads based on a user's prior visits to this website.")
   - Google's use of the DoubleClick cookie:
     "Google's use of the DoubleClick cookie enables it and its partners
     to serve ads to your users based on their visit to your sites and/or
     other sites on the Internet."
   - Microsoft Clarity (analytics)
   - Cloudflare (hosting/CDN)

5. Data Retention
   - Server logs: 30 days (Cloudflare default)

6. Your Rights (GDPR / CCPA)
   - GDPR (EU users): Right to access, rectification, erasure, restriction,
     data portability, objection
   - CCPA (California users): Right to know what personal information is
     collected, right to delete, right to opt-out of sale
   - Contact us at support@palworldbase.net to exercise any right

7. Changes to This Policy
   - Last updated: {BUILD_DATE}
   - Users will be notified of material changes via site banner
```

**关键表述（必须逐字包含）——AdSense 审核员会搜这些关键词：**

- `"third-party vendors, including Google, use cookies to serve ads"`
- `"DoubleClick cookie"`
- `"opt-out"` + link to `https://www.google.com/settings/ads`
- `"Users may opt out of personalized advertising"` + link to `https://www.aboutads.info`

### 16.3 Cookie Policy + 同意弹窗

#### Cookie 分类

| 类别 | 实例 | 需要同意？ | 加载时机 |
|------|------|----------|---------|
| **Essential** | Cloudflare CDN session cookie | ❌ 不需要 | 页面加载即刻 |
| **Analytics** | Microsoft Clarity | ✅ 需要（GDPR） | 用户点 "Accept" 后 |
| **Advertising** | Google AdSense / DoubleClick | ✅ 需要（GDPR + CCPA） | 用户点 "Accept" 后 |

#### 弹窗设计（Cookie Consent Banner）⭐ 高颜值 + 暗色主题

##### 设计理念

99% 的 cookie 弹窗是站点最丑的组件。一个精心设计的弹窗本身就是品牌信号——用户在点 "Accept" 之前就已经判断了这个站的品质。

**目标**：做出一个值得被其他网站截图引用的 Cookie 弹窗。

##### 视觉规范

```
┌──────────────────────────────────────────────────┐
│                                                   │
│  🔒  Cookie Preferences                           │
│      Orbitron · 18px · tracking-wider             │
│      text-shadow: 0 0 15px rgba(0, 212, 255, 0.2)│
│                                                   │
│      We use cookies to understand how players     │
│      use PalworldBase and to show relevant ads.   │
│      Your data helps us keep the tools free.      │
│      Inter · 14px · line-height 1.6               │
│      color: rgba(255, 255, 255, 0.7)              │
│                                                   │
│      ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│      │ Reject   │  │ Customize│  │ Accept All │  │
│      │ Optional │  │          │  │ Recommended│  │
│      └──────────┘  └──────────┘  └────────────┘  │
│       ghost 按钮     ghost 按钮    accent 实心按钮  │
│                                                   │
│      Privacy Policy · Cookie Policy               │
│      小字链接 · rgba(255,255,255,0.4)              │
│                                                   │
└──────────────────────────────────────────────────┘
     ↑                                              ↑
     │ 整个面板在页面底部，距边缘 16px                │
     │ background: rgba(18, 22, 30, 0.95)           │
     │ backdrop-filter: blur(20px)                  │
     │ border: 1px solid rgba(0, 212, 255, 0.15)    │
     │ border-radius: 12px                          │
     │ box-shadow: 0 0 40px rgba(0, 212, 255, 0.08) │
```

##### 设计细节

| 元素 | 规范 | 作用 |
|------|------|------|
| 图标 | `🔒` 非 `🍪` | 强调隐私保护，弱化追踪感——用户看到锁比看到饼干更愿意点接受 |
| 标题字体 | Orbitron 18px · tracking: 0.05em | 与站点 H1/Logo 统一字体家族 |
| 标题 glow | `text-shadow: 0 0 15px rgba(0, 212, 255, 0.2)` | 与站点 H1 glow 保持一致 |
| 正文 | Inter 14px · `opacity: 0.7` | 不抢焦点，但清晰可读 |
| 面板背景 | `rgba(18, 22, 30, 0.95)` + `backdrop-filter: blur(20px)` | 玻璃态，与站点卡片一致 |
| 面板边框 | `1px solid rgba(0, 212, 255, 0.15)` | 电蓝微光边框，暗色中视觉分层 |
| 面板阴影 | `0 0 40px rgba(0, 212, 255, 0.08)` | 微弱的电蓝光晕扩散 |
| 圆角 | 12px | 现代感，不尖锐 |
| 底部间距 | 页面底部 16px，左右居中，max-width: 640px | 浮层效果，不贴边 |

##### 按钮设计

```
Reject All        Customize         Accept All
┌──────────┐    ┌──────────┐    ┌────────────┐
│  暗色幽灵  │    │  暗色幽灵  │    │  电蓝实心    │
│  按钮     │    │  按钮     │    │  + glow    │
└──────────┘    └──────────┘    └────────────┘

Ghost 按钮:
  background: transparent
  border: 1px solid rgba(255, 255, 255, 0.15)
  color: rgba(255, 255, 255, 0.8)
  Inter 13px · medium weight
  padding: 10px 20px · border-radius: 6px
  hover: border-color → rgba(0, 212, 255, 0.4), background → rgba(0, 212, 255, 0.05)

Accent 按钮 (Accept All):
  background: #00d4ff
  color: #0a0e14 (深色文字，不是白色)
  Inter 13px · semibold weight
  padding: 10px 24px · border-radius: 6px
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.3)
  hover: box-shadow → 0 0 30px rgba(0, 212, 255, 0.5)
```

##### 动画

| 时机 | 动画 |
|------|------|
| 首次显示 | `@keyframes slideUp`：面板从底部滑入 + 淡入（0.4s ease-out），延迟 0.8s 触发——给用户先看到页面的时间 |
| 用户点击按钮后 | 面板滑出消失（0.3s ease-in） + 页面内容无跳动（面板是 fixed overlay，不影响文档流） |
| Hover 按钮 | 0.2s transition，仅在桌面端生效（`@media (hover: hover)`） |

##### 移动端适配

- 面板：`margin: 0 12px 12px; max-width: 100%; border-radius: 10px`
- 按钮：全宽纵向排列（Reject → Customize → Accept All 从上到下）
- Accept All 放在最下面（拇指最容易够到的位置）
- 标题：16px；正文：13px
- 面板周围保留安全区域（`env(safe-area-inset-bottom)`）

##### 品牌文案（正文部分）

不使用通用的 "This website uses cookies to improve your experience"：

```
We use cookies to understand how players use PalworldBase and to
show relevant ads. Your data helps us keep the tools free for
the Palworld community.
```

**文案策略**：诚实 + 对等交换——"你让我们用 cookie，我们让工具免费"。比 "为改善您的体验" 这种模糊说辞更可信。

##### "Customize" 展开面板

用户点击 Customize 后，面板原地展开，不需要弹窗套弹窗：

```
🔒  Cookie Preferences

    [======== Essential ========] ● Always On
    Required for the site to function. Cannot be disabled.

    [======= Analytics =========] ○ ──●── ○
    Microsoft Clarity. Helps us understand which tools
    players use most.

    [======= Advertising =======] ○ ──●── ○
    Google AdSense. Personalized ads that help keep
    PalworldBase free.

    [Reject All]  [Accept Selected]  [Accept All]
```

- Toggle 开关用 CSS-only 实现
- Analytics 和 Advertising 默认关闭（用户主动开启才算同意）
- "Accept Selected" 只保存用户选中的类别

##### 行为规则

- 用户首次访问时显示（延迟 0.8s 动画进入）
- 三个按钮：`Accept All` / `Reject All` / `Customize`
- 用户做出选择之前，**不加载** Google AdSense 脚本和 Clarity 脚本
- 选择存储在 `localStorage`，有效期 12 个月
- 12 个月后或清缓存后重新弹窗
- 用户可通过 Footer 中的 "Cookie Settings" 链接随时重新打开弹窗修改选择

#### 实现方式

```html
<!-- cookie-consent.js — 在 <head> 中同步加载，体积 < 2KB -->
<script>
  (function() {
    var consent = localStorage.getItem('cookie-consent');
    if (consent === 'accepted') {
      // 加载广告和分析脚本
      loadScripts();
    } else if (consent === 'rejected') {
      // 不加载任何非必要脚本
    } else {
      // 显示弹窗
      showBanner();
    }
  })();
</script>
```

> **原则**：Google AdSense 和 Clarity 脚本默认不加载，用户同意后才动态注入 `<script>` 标签。这是 GDPR 合规的最低标准。

#### Cookie Policy 页面内容

**页面 URL：** `/cookie-policy/`

简要版（比 Privacy Policy 更聚焦 Cookie），包含：
1. What are cookies
2. Types of cookies we use（表格：名称 / 用途 / 有效期 / 是否第三方）
3. Third-party cookies（Google AdSense / Clarity）
4. How to manage cookies（浏览器设置 + opt-out 链接）
5. Link to Privacy Policy

### 16.4 广告位策略：SEO + UX + 收入三角平衡

#### 核心原则

> **广告服务于用户体验，而不是反向。用户先获得有价值的工具/数据，广告是副产品。**

#### 广告位置清单

| 位置 | 页面类型 | 格式 | 是否影响 CLS | 优先级 |
|------|---------|------|------------|--------|
| 首页：Hero 下方 | 首页 | Responsive horizontal | 预留固定高度（90px） | P1 |
| Pal 详情页：Stats section 下方 | S 级 / A 级 Pal 页 | Responsive horizontal | 预留固定高度（90px） | P1 |
| 工具页：结果区域上方 | Calculator / Finder | Responsive horizontal | 预留固定高度（90px） | P2 |
| Guide 页面：正文中部 | Guides | Responsive horizontal | 预留固定高度（90px） | P1 |
| 全局：页面底部 Footer 上方 | 所有页面 | Responsive horizontal（可选） | 预留固定高度（90px） | P3 |

#### 🔴 B 级页面不挂广告

194 个 B 级页面只展示数据卡，内容深度不足以支撑广告。挂广告 = Made for AdSense 嫌疑。
B 级页面只放内部链接 + Footer，零广告。

#### CLS 防护规则

每条广告容器必须：
```html
<div class="ad-container" style="min-height:90px; width:100%">
  <!-- Google AdSense code -->
</div>
```
- 广告未加载时，容器保持 `min-height: 90px`，不塌缩
- 广告加载后如超出 90px，容器自然撑开（`min-height` 不限制）
- 绝对禁止：广告加载前容器高度为 0，加载后突然撑开

#### 广告数量上限

| 页面类型 | 最多广告位 | 说明 |
|---------|----------|------|
| 首页 | 2 | Hero 下方 + Footer 上方 |
| S 级 Pal 页 | 2 | Stats 下方 + Footer 上方 |
| A 级 Pal 页 | 1 | Stats 下方 |
| B 级 Pal 页 | 0 | 不挂广告 |
| 工具页 | 2 | 结果区域上方 + Footer 上方 |
| Guide | 2 | 正文中部 + Footer 上方 |
| 合规页面 | 0 | About/Privacy/Terms/Cookie 页零广告 |

### 16.5 Terms of Service 内容规范

**页面 URL：** `/terms/`

```
1. Acceptance of Terms
2. Description of Service
   "PalworldBase is a data platform providing Palworld game statistics,
    breeding calculations, and comparison tools."
3. Intellectual Property
   - Site code, design, and original analysis © PalworldBase
   - Palworld game data, images, and names are property of Pocketpair, Inc.
   - Data sourced from wiki.gg (CC BY-SA 3.0)
4. User Conduct
5. Disclaimer of Warranties
   "Game data is provided 'as is' for informational purposes. While we
    strive for accuracy, game updates may cause temporary discrepancies."
6. Limitation of Liability
7. Third-Party Links and Advertisements
   "This site displays ads served by Google AdSense. We are not responsible
    for the content of third-party advertisements."
8. Contact Information
   alex@palworldbase.net / support@palworldbase.net
```

### 16.6 AdSense 申请前检查清单

提交 AdSense 申请之前，逐项确认：

- [ ] Privacy Policy 页面存在且包含 Google 广告声明 + DoubleClick cookie 说明
- [ ] Cookie Policy 页面存在
- [ ] Terms of Service 页面存在
- [ ] Cookie 同意弹窗正常工作（同意前不加载 AdSense 脚本）
- [ ] About 页面有真实联系方式和数据来源声明
- [ ] 首页有 ≥500 字原创内容（非模板生成）
- [ ] S 级 + A 级 Pal 页的叙事文本全部是全新算法生成（非旧站复制）
- [ ] B 级页面无广告位
- [ ] 所有广告位有固定高度容器
- [ ] 站点有 ≥30 个页面（S+A+工具页+指南已超过此数）
- [ ] 导航结构清晰（Header nav + Footer menu）
- [ ] robots.txt 无禁止 Google AdSense crawler（`Mediapartners-Google`）
- [ ] 站点上线 ≥2 周，有一定自然流量后再申请（不要上线当天申请）

> **最后一条很重要**：AdSense 审核员看到一个 0 流量的全新站，拒绝概率远高于有一个月自然流量的站。建议上线后先跑 2-4 周，GSC 有索引数据了再提交 AdSense 申请。

### 16.7 robots.txt 补充：允许 AdSense Crawler

```
User-agent: Mediapartners-Google
Allow: /
```

> AdSense 的抓取器 `Mediapartners-Google` 需要能访问所有有广告的页面。如果 robots.txt 不声明 Allow，广告可能无法正常投放。

---

*本任务书为 FINAL 执行版。所有设计决策已确认，可直接进入 Step 1 编码阶段。*
