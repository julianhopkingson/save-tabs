# Chrome Plugin "Save Tabs" 架构与设计方案

## 1. 第一性原理分析 (First Principles Analysis)
**问题本质**：
- 用户的核心诉求是**高效管理和恢复浏览器会话 (Session Management)**，由于 Chrome 原生的历史记录或近期关闭功能缺乏便捷的操作入口。
- 现有 UI 设计陈旧、信息展示冗余且存在非必要配置（如字号设置）。这违背了直觉和现代可用性标准。
- 对于核心的“保存所有标签页及分组”的需求进行剖析，其实质是一种**基于状态快照 (Snapshot) 的存储与重载行为**。由于此类操作一旦出错（例如未正确备份就由于执行恢复而被关掉标签页）将造成极大损失并难以逆转，因此安全性和防误触必须置于所有考量的首位。

**核心结论**：
1. **摒弃冗杂**：彻底移除字号配置，仅通过 CSS 自动响应或固定一个最佳可读字号，做到开箱即用。
2. **轻量与可控**：作为轻量级的浏览器操作入口，需遵循 KISS（Keep It Simple, Stupid）原则，不应过度封装，使用原生 Web 技术实现，以降低长期维护成本并提升响应速度。
3. **安全闭环**：在恢复已保存的 Tabs 列表 (Recover) 时，必须建立“先创建新标签群，再销毁旧标签”的兜底机制，以防止全关闭动作导致 Chrome 主进程以为没有窗口而直接触发退出。

## 2. 方案对比与取舍说明 (Architecture & Options)

对于一款强调轻量和快速调出的 Chrome 扩展，技术栈实现思路主要有两种方向：

| 维度 | 方案A：现代原生实现 (Vanilla JS + CSS) <br> 【目前选中】 | 方案B：重度前端框架架构 (React/Vue + Tailwind) |
| --- | --- | --- |
| **设计范式** | 完全依赖现代 WebAPI (CSS Variables, Flexbox, ES6+ native JS) 来手写构建。 | 依赖现代前端框架的庞大生态、编译器及打包工具链。 |
| **复杂度** | 极低（结构清晰，零配置构建，完全透明可视的 HTML/CSS/JS 文件）。 | 较高（后续开发者必须搭建 Node 环境，处理 Manifest V3 CSP 限制及打包配置）。 |
| **可维护性** | 极高（无需随框架升级而频繁修改，直接利用浏览器核心能力，十几年不出错）。 | 维护成本波动（依赖库若进行大版本更迭则易引发破坏性更改）。 |
| **视觉呈现** | 能够利用原生 CSS `backdrop-filter` 等属性直接实现现代化的毛玻璃和精美排版效果，满足“美观”诉求。 | 通过 Tailwind 或特定 UI 库虽然能快速堆砌，但是组件往往显得过重且启动较慢。 |
| **影响面** | 插件最终体积预估不到 `50KB`，极速加载，丝滑响应。 | 最终打包代码可能达到 `数 MB`，首次 Popup 加载易产生视觉延迟白屏。 |

**决策依据**：
本扩展的范围清晰、逻辑边界明确，仅涉及两个页面（Popup 和 Options）以及后台的数据持久化流。基于 KISS 原则与产品可用性第一的原则，强行引入框架属于过度工程化。因此我们推荐采用 **方案A**。它能将资源开销降到极低，提供秒开体验，并赋予后续修改极度透明的开发视角。

## 3. 详细的技术实现路径 (Technical Implementation Path - 方案A)

### 3.1 核心数据存储与通信流
扩展采用 `chrome.storage.local` 处理主要的庞大 Tabs 元数据；使用 `chrome.storage.sync` 设置极少量配置参数。所有的逻辑放置在纯粹的 ES6 Module 脚本中。

#### 保存流程 (Save current tabs)：
1. 用户在 Popup 中点击 "Save current tabs"。
2. 通过核心 API `chrome.tabs.query({currentWindow: true})` 得到当前窗口下所有 Tab 的信息（包括 `url`、`title`、`active`、`pinned`）。
3. 通过组 API `chrome.tabGroups.query({windowId: currentWindowId})` 取得当前窗口内激活分组的元数据（包括 `color`、`title`）。
4. 将 Tab 对象映射到这组元数据中，形成结构化的 JSON 树，保存至 `chrome.storage.local` 下预设定的静态键名 (`saved_session_snapshot`)。新数据自动覆盖旧数据。

#### 恢复流程 (Recover saved tabs)：
1. **防爆栈和防手抖拦截**：用户点击 "Recover" 后，不立刻生效。弹出经过现代化 UI 修饰的内联确认模态框（而非生硬的原生 window.alert），发出警示：“这将会彻底关闭当前的所有标签页并尝试无缝重载保存的文件，是否确认？”。
2. 一旦用户确认执行，随即提取 `saved_session_snapshot`。
3. **安全重构执行线**：
   - 提取正在被使用的所有需要被清空的 Tab ID 集。
   - 根据记录遍历调用 `chrome.tabs.create` ，新建已休眠或记录的链接。
   - 对包含在分组内的标签集，调用 `chrome.tabs.group`。这一步由于原来的组ID已经失效，生成的是全新的 ID，随后需要用 `chrome.tabGroups.update` 对其重设名称和颜色特征。
   - 等待整个新建序列结束并且 Chrome 标记部分新页面渲染周期完成，通过 `chrome.tabs.remove(oldTabIds)` 批量抛出废弃的原标签页。这样即可完成“不伤进程”的平滑复位。

### 3.2 界面交互与现代美学升级 (UI/UX)
- **色调与排版 (Color & Typography)**：应用干净柔和的扁平化主题，支持明暗自动适配，抛弃繁琐的衬线体与手设字号，采用系统级高可读字体流（`system-ui, -apple-system, Roboto`）。
- **列表控制面板 (Popup.html)**：
  - **上部：关闭列表（Undo Closed Tabs）**：调用 `chrome.sessions.getRecentlyClosed()` 渲染项，加入平滑列表 hover 动画，每一行都有微微的阴影提亮效果。
  - **下部：任务操作底栏**：使用类似于 macOS 底部 Dock 的毛玻璃悬空设计 (`backdrop-filter: blur(8px)`，背景呈现半透明胶囊风格)，集中陈列 “History”、“Save Tabs”、“Recover Tabs” 三大图标与精简文字，明确层级。
- **参数控制台 (Options.html)**：
  - 基于留白的极简卡片式结构。
  - 除标题和必须的 “Number of tab sessions displayed” 的输入表单外，裁切掉以往一切会使得界面显得臃肿（如 “字号调整”）的不必要设置。

## 4. 潜在风险评估及其应对策略 (Risk Assessment & Mitigation)

| 潜在风险点 (Risk) | 风险级别 | 产生原因 | 应对策略 (Mitigation) |
| --- | --- | --- | --- |
| **API 极值限制与截断** | 低 | 浏览器对 `chrome.sessions` 具有系统级返回数量强制设限 (`MAX_SESSION_RESULTS` 通常为 25 左右)。 | 在扩展脚本层面，若用户在选项页设置大于极值量，则后台会静默降级以防止溢出报错，并向用户提示当前浏览器的支持上限。 |
| **主窗口闪退崩溃** | 高 | 在 Recover 的操作闭环中，若执行销毁现有选项卡时，新生成的选项卡尚未建立底层关联，Chrome 为防止无界面进程将发生强制退出。 | 前文实现路径提到的强制“先新建验证，后抛弃旧集”流转机制，若遇到由于某种极其偶发的情况导致未能正常创建，将截断旧 Tab 抛弃指令，中止操作保证最后一条防线的安全。 |
| **标签组特征匹配丢失** | 中 | `groupId` 是系统随时生成且无记忆性的临时标识符。在新的窗口上下文中或恢复时这些旧的 ID 完全作废。 | 我们在“存储”这一环节并非只记 ID，而是采用深拷贝思维，记录并序列化对应的 `title/color`。在恢复时使用新建组并即时打上属性来重现实体。 |

## 5. 总结

```markdown
📌 Save Tabs 架构设计 (Save Tabs Architecture Design)
├── 🧠 第一性原理 (First Principles)
│   ├── 🗑️ 精简原则 (Remove redundancy, UI enhancement)
│   ├── ⚡ 原生路线 (Go Native for lightness, KISS rule)
│   └── 🛡️ 安全重载 (Safe reload to avoid process crash)
├── ⚖️ 方案决策 (Architecture Decision)
│   ├── 🥇 方案A：现代纯原生栈 (Vanilla JS/CSS) [选用]
│   └── 🥈 方案B：重型前端构建框架 (React/Vue) [弃用]
├── 🛠️ 技术实现 (Implementation)
│   ├── 💾 持久化 (Storage Config local/sync)
│   ├── 🎨 现代UI (Modern Typography & Glassmorphism)
│   ├── 📸 会话快照 (Session Snapshot & Group metadata)
│   └── 🔄 安全闭环恢复 (Safe Recover Flow with modal)
└── ⚠️ 风险控制 (Risk Mitigation)
    ├── 📉 API上限截断应对 (Handle MAX_SESSION_RESULTS limit)
    ├── 🚫 防误关闪退机制 (Anti-Crash process flow)
    └── 🔗 分组元信息重构 (TabGroup reconstruct metadata logic)
```
