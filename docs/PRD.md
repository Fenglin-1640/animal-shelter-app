# Animal Shelter & Adoption Management System Product Requirements Document

| 项目 | 内容 |
|---|---|
| 正式系统名称 | Animal Shelter & Adoption Management System (ASAMS) |
| 文档版本 | v1.1 |
| 文档状态 | 可用于原型开发与验收 |
| 目标交付 | BISM7255 Assignment 2 工作原型及 4 分钟演示 |
| 主要依据 | Assignment 2 Brief、Assignment 1 FUS1-FUS7、NFUS1-NFUS7、七张最终 UML 图 |
| 目标开发方式 | Low-code 或 AI-assisted coding，平台无关 |

> 本文档是原型的开发与验收基准。所有页面、数据字段、权限和流程应使用本文规定的名称。A1 UML 中已有的角色、类、状态、用例和操作名称不得自行改名。

## 1. 文档目标与需求优先级

本 PRD 将 A2 的最低原型要求、A1 的用户故事和最终 UML 设计整合为一套可执行规格。开发完成后，系统应能用真实页面和测试数据演示动物从入库、评估、医疗放行、公开展示、领养申请、审核、签约付款、放行到回访的完整过程。

当不同材料的表达存在差异时，按以下顺序处理：

1. A2 明确规定的原型最低要求和角色限制。
2. A1 已提交的 FUS 与 NFUS 验收标准。
3. A1 七张最终 UML 图中的流程、状态、类和关系。
4. 本 PRD 中为消除歧义而作出的实现决定。

### 1.1 优先级定义

| 优先级 | 含义 | 交付要求 |
|---|---|---|
| P0 | 作业最低要求或核心业务闭环 | 演示前必须完整实现 |
| P1 | 支持 Grade 7 的完整性、专业性和高级功能 | 应尽量完整实现 |
| P2 | 生产环境能力，原型中可用可验证的模拟方式呈现 | 至少保留数据结构、配置或状态记录 |

## 2. 产品背景、目标与边界

### 2.1 背景

动物收容所的入库、政府转移、医疗、行为评估和领养记录容易分散在纸质或独立文件中。ASAMS 通过一份贯穿动物全生命周期的记录，将不同角色的操作、状态变化和审计证据连接起来。

### 2.2 产品目标

- 集中记录每只动物从到达到安置后的完整历史。
- 通过角色权限保护医疗信息、领养人资料和政府转移记录。
- 用业务规则阻止未完成法定留置、医疗放行或行为评估的动物被错误发布。
- 让领养申请的三项适合度检查、见面评估、协议、付款和放行条件可以追踪。
- 提供清晰、专业、易演示的角色化界面。

### 2.3 成功标准

原型达到以下结果即视为业务成功：

- 五个测试账号可分别展示 Administrator、Shelter Staff Member、Veterinarian、Council Animal Control Officer 和 Adopter 的不同权限。
- 每个账号的 Landing Screen 只显示该角色获准使用的功能。
- 可现场创建一只动物，并演示其状态经过至少三个关键阶段。
- 可完整演示一条成功领养路径和至少一条失败或回退路径。
- 所有 P0 操作都有数据持久化、输入校验、成功提示、错误提示和返回 Landing Screen 的方式。
- 通过直接输入受限页面 URL 也无法绕过权限控制。

### 2.4 原型边界

以下功能仍需在界面和数据层呈现，但允许采用原型模拟：

- National Pet Registry 使用本地模拟查询，不连接真实政府接口。
- Adoption Payment 记录模拟付款结果，不处理真实银行卡或资金。
- 邮件、短信和系统提醒可写入 Notification 列表，不要求接入真实通信服务。
- 备份、恢复、七年留存和法规导出以配置页、状态页和测试日志证明设计能力，不要求控制低代码平台的真实基础设施。
- 法律文本使用演示模板，不声称已经获得法律审查。

## 3. 统一术语与跨材料一致性决定

### 3.1 角色名称

| 统一名称 | 使用方式 |
|---|---|
| Administrator | 一个具有全部 Shelter Staff Member 权限并额外具有管理权限的账户。系统同时只能有一个 Active Administrator。 |
| Shelter Staff Member | 负责正式入库、行为评估、领养审核、付款记录、发布动物和回访。 |
| Veterinarian | 负责医疗检查、治疗、疫苗、绝育安排、医疗放行和放行前检查。 |
| Council Animal Control Officer | 负责 Council Transfer Submission、支持文件和本人提交记录的查询。 |
| Adopter | 系统账户角色。A1 用例图中的 Prospective Adopter 是其领养完成前的业务身份。 |
| Shelter Employee | UML 中的抽象父角色，用于归纳 Shelter Staff Member 与 Veterinarian 的共同职责。它不是可登录角色。 |

### 3.2 已解决的差异

| 问题 | 实现决定 |
|---|---|
| A2 将 Animal Intake Screen 描述为 Council Officer 使用，FUS1 和 Activity Diagram 1 又规定 Staff 创建正式入库记录 | Intake Management 提供两个角色视图。Council Officer 创建转移提交并上传文件。Shelter Staff Member 审核提交、创建正式 `IntakeRecord` 和 `Animal`。 |
| A2 使用 Not Fit、Pre-Listing、Current、Adopted、Removed，状态机使用 Under Assessment 等状态 | 使用 `Animal.currentStatus` 保存 A1 状态机的业务状态。使用 `listingStatus` 保存 A2 的展示状态。两者按第 7 节规则同步。 |
| 谁将动物从 Not Fit 更新为 Pre-Listing | Veterinarian 签发 Medical Clearance 后，系统在法定留置已解决且最新行为结果合格时，将 `listingStatus` 更新为 Pre-Listing。Shelter Staff Member 再执行 Publish Adoption Profile，将其更新为 Current。 |
| State Diagram 写 applicationSubmitted 后进入 Application In Progress，Activity Diagram 2 和 Sequence Diagram 2 在审批通过后才更新动物状态 | 提交时只更新 `AdoptionApplication.applicationStatus`。全部检查通过并由 Staff 批准后，才将 `Animal.currentStatus` 更新为 Application In Progress。状态机中的 applicationSubmitted 在原型中解释为获批申请正式进入处理。 |
| FUS7 在 finalise 时将动物标记为 Adopted，状态机在放行前使用 Awaiting Release | finalise 后 `listingStatus = Adopted`，同时 `currentStatus = Awaiting Release`。这样动物从公开列表消失，但仍必须完成放行前健康检查。 |
| A1 类图只有 `currentStatus`，A2 还要求 Adoption Listing Status | `listingStatus` 作为原型实现字段加入 Animal 页面，但不替换或重命名 UML 中的 `currentStatus`。 |

## 4. 用户角色与访问原则

### 4.1 身份和账户规则

- 任何公开注册用户默认获得 `role = Adopter` 和 `status = Active`。
- `Inactive` 或 `Locked` 用户不得登录。
- 连续 6 次密码错误后，账户变为 `Locked`。Administrator 可解除锁定。
- 系统任何时刻只能存在一个 Active Administrator。
- Administrator 不得将自己的状态改为 Inactive。
- Administrator 转移必须选择一个 Active 用户并再次确认。成功后目标用户成为 Administrator，原 Administrator 自动变为 Staff。
- Administrator 拥有 Shelter Staff Member 的全部业务权限。
- 页面入口隐藏和服务端权限校验必须同时存在。

### 4.2 演示账户

至少准备以下五个独立账户，以便清楚展示普通 Staff 与 Administrator 的差异：

| 账户 | 角色 | 状态 | 演示重点 |
|---|---|---|---|
| admin@asams.demo | Administrator | Active | 用户管理、下拉选项维护、Staff 业务功能 |
| staff@asams.demo | Shelter Staff Member | Active | 入库、行为评估、领养处理、回访 |
| vet@asams.demo | Veterinarian | Active | 医疗、放行、术前检查 |
| council@asams.demo | Council Animal Control Officer | Active | 转移提交、本人记录 |
| adopter@asams.demo | Adopter | Active | 浏览、申请、见面、签约、状态查看 |

演示密码可统一使用仅限本地原型的 `Demo123!`。生产环境不得使用共享密码。

## 5. 信息架构与界面规范

### 5.1 全局页面

| Screen ID | 页面 | 主要内容 |
|---|---|---|
| SC-01 | Sign In | 邮箱、密码、登录、错误次数提示 |
| SC-02 | Sign Up | 姓名、Title、邮箱、电话、密码、隐私同意 |
| SC-03 | Landing Screen | Administration Functions 与 User Functions 两组角色化入口 |
| SC-04 | My Profile | 当前用户个人资料、联系方式和密码维护 |
| SC-05 | Notifications | 待处理提醒、留置到期、复评、术前检查和回访任务 |

### 5.2 Landing Screen 入口

| 角色 | Administration Functions | User Functions |
|---|---|---|
| Administrator | User Administration、System Administration、Audit Log、Retention and Backup Status | Staff 的全部入口 |
| Shelter Staff Member | 不显示管理入口 | Animal Intake、Animals、Behaviour Assessments、Adoption Applications、Adoptions、Follow Up Visits |
| Veterinarian | 不显示管理入口 | Animals、Medical Work Queue、Pre-Release Checks |
| Council Animal Control Officer | 不显示管理入口 | New Council Transfer、My Transfers |
| Adopter | 不显示管理入口 | Adoption Listings、My Adopter Profile、My Applications、My Meet and Greets、My Agreements |

### 5.3 全局交互要求

- 登录后首先进入 Landing Screen。
- 所有内部页面固定显示 Home、Notifications、My Profile 和 Sign Out。
- 每个表单取消或完成后提供返回 Landing Screen 的明确路径。
- 关键操作成功后显示结果、记录编号和下一步按钮。
- 列表页支持搜索、筛选、排序、分页和空状态提示。
- 状态同时使用文字和颜色，不得只依赖颜色表达。
- 未获授权的功能不显示入口。若用户直接访问 URL，系统返回 Access Denied 并记录审计事件。
- 必填字段显示 `*`，提交失败时在字段旁和页面顶部同时给出具体原因。
- Staff 端优先桌面布局，Adopter 端同时适配桌面和移动端。

### 5.4 UI 设计方向与适用边界

ASAMS 采用用户提供的 Rosé Pine Dawn 与 Rosé Pine Moon Cool 截图作为视觉参考。设计目标是保留其清晰的顶部栏、左侧导航、内容卡片、右侧筛选面板、细边框、柔和阴影、圆角标签和高信息密度，同时将所有内容、命名、图标和交互改造成 ASAMS 自有界面。

- 浅色主题命名为 `ASAMS Dawn`，深色主题命名为 `ASAMS Moon Cool`。
- 两个主题使用同一套布局、组件和语义令牌，只切换颜色、阴影及必要的图片资源。
- 不直接复制 AO3 页面、文字、标志、图标或依赖其 DOM 选择器。提供的 CSS 仅用于提取视觉规律和设计令牌。
- 实现时建立 ASAMS 自有的 CSS custom properties 与组件类。组件中不得散落无法追踪的硬编码颜色。
- 第一优先级是完成业务流程、权限、数据和状态反馈。自有 Logo、动物插画与背景装饰在功能和响应式验收完成后加入。

### 5.5 ASAMS 页面框架

#### 5.5.1 桌面布局

桌面端采用与参考界面一致的应用框架：顶部全宽 Header、左侧角色导航、中央工作区，以及只在需要时出现的右侧筛选面板。

| 区域 | 规格 | ASAMS 内容 |
|---|---|---|
| Top Header | 高度约 56 px，页面顶部固定或 sticky，1 px 下边框，轻阴影 | 预留 Logo、系统名称、全局搜索、Notifications、My Profile、主题切换和 Sign Out |
| Left Navigation | sticky，宽度 `clamp(180px, 18vw, 240px)`，可独立滚动 | 当前角色可用功能，按业务组分段，当前菜单使用有边框的高亮背景 |
| Main Content | 弹性宽度，左右内边距桌面约 5%，主要正文最大宽度约 `70em` | 页面标题、面包屑、主要动作、卡片、表格、详情或表单 |
| Right Filter Panel | 仅列表与工作队列页显示，建议宽 260 至 320 px，sticky | Sort、Status、Species、Date、Assigned To、Include 与 Exclude 条件 |

三栏同时显示时，中央工作区不得小于 560 px。空间不足时优先收起右侧筛选面板，再将左侧导航改为抽屉。

#### 5.5.2 不同页面类型

| 页面类型 | 页面结构 | 主要呈现方式 |
|---|---|---|
| Sign In、Sign Up | 简化 Header，不显示角色导航 | 居中表单卡片，背景可在最终阶段加入低干扰动物插画 |
| Landing Screen | Header + Left Navigation + Main Content | Administration Functions 与 User Functions 分组卡片，不显示右侧筛选栏 |
| Animals、Adoption Listings、Applications、Work Queues | 完整三栏 | 中央为结果卡片或表格，右侧为 Sort and Filter |
| Animal、Application、Adoption Detail | Header + Left Navigation + Main Content | 顶部摘要卡片，下方使用 tabs、时间线和关联记录，不显示固定筛选栏 |
| Create、Edit、Assessment、Agreement 表单 | Header + Left Navigation + Main Content | 最大宽度 `70em` 的分区表单，长流程使用步骤提示和 sticky action bar |
| User Administration、System Administration | Header + Left Navigation + Main Content | 紧凑表格、筛选器、详情抽屉或独立详情页 |

#### 5.5.3 响应式规则

| 断点 | 行为 |
|---|---|
| `>= 1200 px` | 显示桌面框架。适用时同时显示左右两侧栏。 |
| `768 至 1199 px` | 左侧导航收为菜单按钮和抽屉。右侧筛选器收为可展开面板。中央内容占满可用宽度。 |
| `< 768 px` | Header 只保留 Logo 或 ASAMS 文字、Notifications、菜单与主题按钮。卡片改为单列。表格使用横向滚动或移动端字段摘要，不压缩至不可读。 |

移动端触控目标最小 44 x 44 px。抽屉、筛选器和对话框打开后必须锁定背景滚动，并可通过 Escape、关闭按钮及返回操作退出。

### 5.6 参考界面到 ASAMS 组件的映射

| 参考界面元素 | ASAMS 对应组件 | 使用示例 |
|---|---|---|
| AO3 顶部导航 | `AppHeader` | 全局搜索、通知、个人资料、主题切换和退出 |
| AO3 Dashboard | `RoleSidebar` | Animal Intake、Medical Work Queue、Adoption Applications 等角色入口 |
| AO3 Work Blurb | `RecordCard` | Animal、Application、Council Transfer、Medical Task 摘要卡片 |
| AO3 Sort and Filter | `FilterPanel` | 动物、领养申请、医疗队列和审计日志筛选 |
| AO3 Tags | `StatusChip` 与 `AttributeChip` | Current、Under Treatment、Dog、Desexed、Check Pending |
| AO3 Bookmark actions | `CardActions` | View、Edit、Assign、Approve、Reject、Archive |
| AO3 Meta and Stats | `RecordMeta` | Shelter ID、申请编号、日期、负责人、检查完成数 |

该映射只转换信息架构与视觉语言，不复制原网站的业务含义。

### 5.7 设计令牌

#### 5.7.1 通用令牌

| 类别 | 规格 |
|---|---|
| Font | `Figtree, Bitter, Helvetica, "Trebuchet MS", "Lucida Sans", Arial, sans-serif`。无法加载 Figtree 时使用系统字体回退。 |
| Base text | 桌面 16 px，行高 1.4 至 1.5，正文权重 400，标签权重 600，标题权重 700。 |
| Spacing | 使用 4、8、12、16、24、32、48 px 的统一间距阶梯。 |
| Radius | 输入框、按钮和卡片统一 12 px。普通状态标签可使用 `0 15px 15px` 的参考造型。圆形图标按钮使用 50%。 |
| Border | 默认 1 px 实线边框。通过边框、背景和文字共同表达层级。 |
| Card padding | 紧凑卡片 12 px，标准卡片 16 px，复杂详情卡片 24 px。 |
| Motion | hover 与展开过渡 120 至 180 ms。启用 `prefers-reduced-motion` 时关闭非必要动画。 |

#### 5.7.2 浅色与深色主题

| 语义令牌 | ASAMS Dawn | ASAMS Moon Cool | 主要用途 |
|---|---|---|---|
| `--color-page` | `#FAF4ED` | `#232136` | 页面与左侧导航背景 |
| `--color-surface` | `#FFFAF5` | `#2A273F` | Header、卡片、输入框、菜单 |
| `--color-surface-active` | `#FFF7F2` | `#34304F` | 当前菜单、选中行、展开区域 |
| `--color-text` | `#575279` | `#E0DEF4` | 主要文字 |
| `--color-text-muted` | `#797593` | `#908CAA` | 次要说明、时间和辅助信息 |
| `--color-border` | `#E7D3CB` | `#3F3857` | Header、卡片、表单和分隔线 |
| `--color-border-strong` | `#D7BFB6` | `#463E61` | focus、active、弹窗和重要分组 |
| `--color-primary` | `#EB6F92` | `#9CCFD8` | 主要操作、链接和重点提示 |
| `--color-secondary` | `#3E8FB0` | `#C4A7E7` | 次要操作、已访问链接、信息状态 |
| `--color-rose` | `#EA9A97` | `#9CCFD8` | 关联标签和渐变起点 |
| `--color-gold` | `#F6C177` | `#C4A7E7` | 等待、留置和注意状态 |
| `--color-danger` | `#EB6F92` | `#EB6F92` | 拒绝、锁定、失败和危险操作 |
| `--color-focus` | `#3E8FB0` | `#C4A7E7` | 键盘 focus ring |

浅色卡片建议使用柔和阴影 `0 2px 8px rgba(200,182,173,0.20)`。深色卡片建议使用 `0 8px 28px rgba(20,18,32,0.35)`。阴影不得代替边框，确保高对比模式下仍能识别组件边界。

### 5.8 组件与交互规格

#### 5.8.1 Header 与导航

- Header 左侧保留 180 x 32 px 的 Logo 安全区。Logo 未完成前显示文本 `ASAMS`，不得让占位图影响布局。
- 全局搜索支持 Shelter ID、Animal Name、Microchip Number 和 Application ID。搜索框为圆角长条，桌面宽 260 至 360 px。
- Header 右侧图标必须带 tooltip 和可访问名称，不得只显示含义不明的图形。
- 左侧导航按角色自动生成。功能组之间使用细分隔线。hover 使用渐变或浅色填充，current 状态同时显示背景、边框和字重变化。
- 左侧导航不得因为 Logo 或背景插画变化而移动。

#### 5.8.2 RecordCard 与列表

- `RecordCard` 使用 1 px 边框、12 px 圆角和轻阴影。标题、关键状态、日期和主操作位于首行。
- Animal card 桌面端左侧显示 4:3 缩略图，中央显示 name、species、breed、age、Shelter ID 和简短描述，底部显示状态及属性标签，右侧放 View 或角色允许的主操作。
- Application card 显示 Application ID、Adopter、Animal、submissionDate、三项检查完成度、applicationStatus 和 assigned staff。
- 每张卡片只突出一个 primary action。次要操作进入按钮组或 overflow menu，避免操作区拥挤。
- 表格与卡片视图可按页面需求选择，但同一页面切换主题时信息顺序不得变化。

#### 5.8.3 标签与状态

所有 chip 必须显示文字。颜色用于加强区分，不能成为唯一信息载体。

| 语义 | 适用状态 | 颜色方向 |
|---|---|---|
| Success or available | Available For Adoption、Current、Medical Clearance Issued、Fit For Release | Foam 或 blue，配合勾选图标 |
| In progress | Under Assessment、Application In Progress、Awaiting Release、inFollowUpPeriod | Iris 或 secondary，配合进度图标 |
| Caution or waiting | On Statutory Hold、Pre-Listing、Pending Check、Desexing Scheduled | Gold，配合时钟或提醒图标 |
| Attention | Under Treatment、In Behaviour Program、Locked、Rejected | Rose 或 danger，配合医疗、警告或锁定图标 |
| Complete | Adopted、Rehomed、Reclaimed By Owner | Primary 或 blue，配合完成图标 |
| Neutral | Archived、Removed、Unsuitable For Adoption | Muted surface，配合 archive 或 minus 图标 |

颜色组合必须在各自主题下通过 WCAG AA 对比度检查。若参考色作为纯色背景无法达到要求，应改为浅色 tint 背景加深色文字，而不是牺牲可读性。

#### 5.8.4 表单、筛选和反馈

- 输入框、select、textarea、日期选择器和搜索框使用 12 px 圆角、1 px 边框及清晰 focus ring。
- 表单按 Intake、Identity、Medical、Behaviour、Placement 等业务分区，不使用一张无限延伸的大表单。
- 右侧 FilterPanel 的每组条件可折叠，当前条件以可移除 chip 显示，并提供 `Clear all`。
- 主要按钮使用 primary 颜色或渐变。次要按钮使用 surface、边框和正文色。危险按钮使用 danger 色，并要求确认。
- 成功、提醒、注意和错误消息使用带图标的 tinted alert。错误摘要必须链接到对应字段。
- loading 使用 skeleton 或进度指示。empty state 提供原因和下一步。Access Denied 明确说明权限不足并提供返回 Landing Screen 的按钮。
- 危险操作的确认对话框不得默认聚焦永久删除。Soft Delete、Archive 和 Reject 必须说明影响范围。

### 5.9 主题切换与可访问性

- 首次访问读取 `prefers-color-scheme`。无法读取时默认使用 ASAMS Dawn。
- Header 提供 Dawn、Moon Cool 和 System 三种主题选择。用户手动选择后保存至账户偏好，未登录时保存至 local storage。
- 主题切换不得刷新页面，不得改变字段值、滚动位置、筛选条件或当前工作流步骤。
- 两个主题均须支持键盘操作、清晰 focus、200% 文字缩放、alt text、表单 label 和状态文字。
- 颜色、图标和插画不得遮盖或弱化医疗、权限、错误及警告信息。
- 动物照片保持原始比例，使用 `object-fit: cover` 生成缩略图。详情页提供完整图像或可访问说明。

### 5.10 Logo、动物插画与背景资源计划

视觉资产采用后置策略，确保美化不会阻塞核心功能开发。

| 阶段 | 资产处理 |
|---|---|
| 功能开发阶段 | Header 使用 `ASAMS` 文本标志。图标使用统一的开源线性图标库。卡片使用真实测试照片或中性占位图。 |
| 响应式与主题验收阶段 | 固定 Logo 安全区、插画容器和浅色/深色资源接口，但不加入最终装饰。验证布局在无装饰资源时已完整可用。 |
| 最终视觉润色阶段 | 替换为用户设计的 ASAMS Logo。加入用户绘制的小动物、爪印或植物插画，并为两个主题准备必要的透明背景版本。 |

最终背景插画必须放在独立装饰层，设置 `pointer-events: none`，不得拦截点击。建议使用 SVG 或透明 WebP，控制文件大小和不透明度，并避开正文、表单、状态标签和操作按钮。纯装饰图片使用空 alt。具有业务含义的动物照片必须提供有效 alt。任何最终资产加入后，都要重新完成桌面、平板、手机、Dawn 和 Moon Cool 的视觉回归测试。

### 5.11 UI 验收标准

1. 所有登录后页面复用同一套 `AppHeader`、`RoleSidebar`、页面标题和反馈组件。
2. Animals、Adoption Listings、Applications 与至少一个 Work Queue 在桌面端呈现完整三栏结构。
3. ASAMS Dawn 与 ASAMS Moon Cool 均覆盖登录、Landing、列表、详情、表单、对话框、loading、empty、error 和 Access Denied 状态。
4. 主题切换立即生效并持久化。两个主题下均无不可读文字、消失边框或只靠颜色表达的状态。
5. 768 px 以下不出现被固定侧栏挤压的内容。菜单、筛选器、表格和主操作可以通过键盘及触控完成。
6. 页面不得出现 AO3 名称、图标、示例数据或外部图片依赖。
7. Logo 和插画缺失时系统仍满足所有功能、布局和可访问性要求。最终资产只作为最后一轮视觉增强。

## 6. 功能需求

### 6.1 Authentication and Landing Screen

#### FR-AUTH-01 注册与登录 P0

- Sign Up 创建 Person 和 Adopter 资料，并自动创建 Active Adopter 账户。
- 邮箱必须唯一并符合有效格式。
- 登录成功更新 `lastLoginAt` 并进入 Landing Screen。
- 登录失败增加 `failedLoginAttempts`。第 6 次失败锁定账户。
- Inactive 或 Locked 账户显示明确原因，不进入系统。

#### FR-AUTH-02 角色化 Landing Screen P0

验收标准：

1. 至少四种角色登录后看到不同入口。
2. Administrator 可同时看到 Administration Functions 与 Staff User Functions。
3. 无权限入口完全隐藏。
4. 所有功能均可返回 Landing Screen。
5. 直接访问受限路由仍被拒绝。

### 6.2 User Administration

#### FR-UA-01 用户列表与详情 P0

Administrator 可查看、创建和更新其他用户。列表显示 Title、Name、Current Role 和 User Status。详情页额外显示 Sign Up Date Time、Last Login、Role Updated By and At、Status Updated By and At，以及 Lock 状态。

#### FR-UA-02 角色与状态维护 P0

验收标准：

1. 只有 Administrator 可打开 User Administration。
2. Role 可设为 Veterinarian、Animal Control Officer、Staff、Administrator 或 Adopter。
3. Status 可设为 Active 或 Inactive，Locked 通过独立的 Unlock 操作处理。
4. 每次角色或状态变化写入操作者、时间、旧值和新值。
5. 系统阻止出现第二个 Active Administrator。
6. Administrator 转移必须通过确认对话框，并自动将旧 Administrator 变为 Staff。
7. 当前 Administrator 无法被设为 Inactive。

### 6.3 System Administration

#### FR-SA-01 下拉选项维护 P0

Administrator 可对以下类别执行 Read、Create、Update 和 Soft Delete：

- Title
- User Role
- Species
- Breed and Description
- Medication
- Temperament
- Sex
- Intake Source
- Application Status
- Check Type and Outcome
- Payment Method
- Follow Up Type
- Document Type

每个选项包含 `category`、`value`、`description`、`speciesId`（Breed 使用）、`isRetired`、`createdAt`、`updatedAt`。被 Soft Delete 的选项不再出现在新记录的下拉列表中，历史记录继续显示原值。Administrator 和关键系统状态标记为 `systemLocked`，不得停用。

#### FR-SA-02 规则配置 P1

Administrator 可配置 Statutory Holding Period 天数、到期提醒提前天数、允许的附件类型、最大附件大小和默认 Adoption Agreement 条款版本。所有配置变化写入 AuditLog。

### 6.4 Council Transfer 与正式入库

#### FR-INT-01 Council Transfer Submission P0

Council Animal Control Officer 可创建转移提交，填写来源、到达情况、发现地点、提交时间、动物初步描述，并上传 seizure notice、complaint history、found-animal report 或其他 council paperwork。

验收标准：

1. Council Officer 只能查看和更新本人尚未提交的记录。
2. 提交后记录只读，并显示 Submitted、Accepted 或 Returned for Information 状态。
3. Council Officer 无法查看无关动物、领养人、行为评估或医疗记录。
4. Staff 接受转移后，相关资料链接到正式 IntakeRecord。

#### FR-INT-02 Create Intake Record P0

只有 Shelter Staff Member 或 Administrator 可创建正式 IntakeRecord。必填字段为：

- `arrivalCircumstance`
- `arrivalDateTime`
- `intakeSource`
- `surrenderingPartyName` 或 council transfer reference
- `species`
- `estimatedAge` 或 `dateOfBirth`
- `sex`
- `coatColour`
- `coatMarkings`

系统自动生成唯一 `intakeId` 和 `animalId`。资料未完整时不得 Finalise Intake。

#### FR-INT-03 Animal Profile 初始化 P0

Finalise Intake 时系统创建 Animal、纵向 MedicalRecord 和初始状态记录：

- `currentStatus = Under Assessment`
- `listingStatus = Not Fit`
- `enteredAt = current timestamp`
- `lastModifiedAt = current timestamp`

Staff 必须至少上传一张动物照片，之后才能完成入库。若 intake source 为 Council Transfer，必须存在至少一份 council supporting document。

#### FR-INT-04 并行评估与 Review Adoption Fitness P0

完成正式入库后，系统同时创建 Microchip Check、Temperament Assessment 和 Health Assessment 三项任务。三项任务可以由相应角色按任意顺序处理，但只有三条路径均达到可继续状态后，才允许执行 Review Adoption Fitness。该页面汇总三项结果，并记录 Shelter Staff Member 与 Veterinarian 的共同确认。若存在未结束的 Statutory Hold、未完成的健康检查或未完成的行为评估，系统必须列出阻塞项。

### 6.5 Animal Profile 与照片

#### FR-AN-01 Animal Profile P0

Animal Profile 显示以下信息：

| 分组 | 字段 |
|---|---|
| Identity | Name、animalId、species、breed、breedDescription、sex、dateOfBirth、calculatedAge、estimatedAge、coatColour、coatMarkings、microchipNumber |
| Adoption | adoptionFee、temperaments、generalDescription、selectedListingPhoto、listingStatus、statusUpdatedAt、adopter details when available |
| Lifecycle | currentStatus、enteredAt、lastModifiedAt、intake source、current owner or adopter link |
| Subscreens | Photos、Medical History、Behavioural Assessment、Proposed Adopter Suitability |

当 `dateOfBirth` 已知时，Age 必须由系统计算，不允许手工维护。DOB 未知时显示 `estimatedAge`。

#### FR-AN-02 Photos P0

每张 Photo 记录 `photoId`、`animalId`、`file`、`dateTaken`、`takenBy`、`useOnAdoptionListing`、`altText` 和 `uploadedAt`。同一动物至少有一张、最多一张照片可被标记为主要公开图片。Adopter 只能看到被批准用于 Adoption Listing 的照片。

### 6.6 Microchip 与 Statutory Hold

#### FR-MC-01 Scan Microchip P0

Staff 在系统中输入实体扫描器读取的 microchip number。系统创建不可删除的 MicrochipLookup 记录，并调用模拟 National Pet Registry。

模拟服务至少支持四个结果：Owner Match、No Match、No Chip 和 Timeout。

#### FR-MC-02 Owner Match 与法定留置 P0

若 Owner Match：

1. 系统将 registered owner contact details 链接到 IntakeRecord。
2. 根据 intake date 和配置天数计算 hold start 与 hold end。
3. `currentStatus` 更新为 On Statutory Hold。
4. 系统在到期前生成 Staff reminder。
5. ownerReclaimed 后记录 Record Owner Reclamation，状态进入 Reclaimed By Owner，`listingStatus` 更新为 Removed，完成 custody transfer 后归档为 ReturnedToOwner。
6. 到期仍无人认领时，holdPeriodExpired 将状态返回 Under Assessment。

若 No Match 或 No Chip，系统记录结果但不创建 hold。若 Timeout，保留失败记录并提供 Retry，8 秒后给出清晰提示。

### 6.7 Medical and Veterinary Management

#### FR-MED-01 Health Assessment P0

Veterinarian 可创建和最终确认 Health Assessment。记录包括 examination observations、sample test results、diagnosed conditions、body condition、urgent treatment requirements、assessment date 和 veterinarian。

Staff 可读取完整 Medical History，但不能创建、编辑或最终确认医疗内容。Council Officer 与 Adopter 不得看到内部医疗记录。

#### FR-MED-02 Treatment and Recovery P0

- 当 fitness review 或 health assessment 标记 treatment required 时，`currentStatus = Under Treatment`。
- Veterinarian 可追加多条 treatment event、medication、dose、date 和 outcome。
- 每次 recovery reassessment 必须链接原始 MedicalRecord。
- further treatment required 时继续循环。
- intake pathway 的 recovery completed 返回 Under Assessment。
- pre-release pathway 的 treatment completed 返回 Awaiting Release。

#### FR-MED-03 Vaccination、Desexing 与 Medical Clearance P0

Veterinarian 可：

- 记录 vaccine type、administration date、dose or chip ID 和 next booster due date。
- 创建 desexing schedule，记录 scheduled date 与当前状态。
- 签发 Medical Clearance。

疫苗处理和绝育安排可以并行完成。系统只有在必需疫苗完成且绝育已经完成或排期后，才允许 `issueMedicalClearance()`。签发者必须为 Veterinarian。

当 Medical Clearance 已签发、Statutory Hold 已解决且最新 Behavioural Assessment 为 suitable 时，系统将 `listingStatus` 更新为 Pre-Listing，并创建 Staff 的 Publish Adoption Profile 任务。

### 6.8 Behaviour Assessment Management

#### FR-BEH-01 Temperament Assessment P0

Shelter Staff Member 可记录：

- handlingResponse
- reactionToStrangers
- foodBehaviour
- interactionWithOtherAnimals
- socialisationScore
- observations
- recommendations
- assessmentDate
- assessor
- followUpRequired
- reassessmentDate

结果必须选择 Suitable for Adoption、Requires Behaviour Modification 或 Unsuitable for Public Adoption。

#### FR-BEH-02 Behaviour Program 与复评 P0

- Requires Behaviour Modification 自动创建 BehaviourProgram，并将 `currentStatus` 更新为 In Behaviour Program。
- 完成项目后可追加 reassessment，原记录不得覆盖。
- Suitable after Program 返回 Under Assessment，并重新执行 Review Adoption Fitness。
- Permanently Unsuitable 将 `currentStatus` 更新为 Unsuitable For Adoption，`listingStatus` 更新为 Removed，随后归档为 Archived。
- 最新行为结果不合格时，系统必须阻止 Publish Adoption Profile。
- Veterinarian 可读取 Behavioural Assessment，但不能修改。

### 6.9 Adoption Listing

#### FR-LIST-01 Publish Adoption Profile P0

只有 Staff 或 Administrator 可执行发布。发布前必须同时满足：

1. Medical Clearance 已签发。
2. 最新 Behavioural Assessment 为 Suitable for Adoption。
3. 不存在未结束的 Statutory Hold。
4. 已填写 adoptionFee、generalDescription、breed、sex、temperament。
5. 已选择带 altText 的公开照片。

发布成功后：

- `currentStatus = Available For Adoption`
- `listingStatus = Current`
- `statusUpdatedAt = current timestamp`

#### FR-LIST-02 Browse and Filter P0

Adoption Listings 只显示 `listingStatus = Current` 且符合公开条件的动物。支持按 Species and Breed、Sex、Temperament 筛选，并支持姓名或 shelter ID 搜索。卡片显示公开照片、Name、Species、Breed、Sex、Age、Temperament、Adoption Fee 和 General Description。

内部 Medical History、Behaviour Risks、Owner History、Council Records、Internal Assessments 和完整 microchip number 不得出现在公开页面。

### 6.10 Adopter Profile 与 Adoption Application

#### FR-ADP-01 Adopter Profile P0

Adopter 可维护自己的资料：

- Person 基础信息与 residentialAddress
- householdType
- home ownership or rental status
- landlordPermission，适用时上传证明
- adults and children in household
- hasExistingPets 与 existingPetDetails
- secure fencing or indoor environment details
- typical hours animal would be alone
- preferredSpecies
- referee name、relationship、phone、email
- consent to store and contact referee

Staff 只在处理该用户申请时查看这些资料。系统提交申请时保存快照，后续修改 Profile 不得改变已提交版本。

#### FR-APP-01 Submit Adoption Application P0

Adopter 从 Adoption Listing 选择一个目标 Animal。只有 `currentStatus = Available For Adoption`、`listingStatus = Current` 且 `acceptingApplications = true` 的动物可申请。

表单收集并验证：

- adopter profile snapshot
- target animal
- motivationStatement
- household information
- existing pets
- landlord permission when applicable
- referee contact and consent
- supporting documents

提交后系统生成唯一 `applicationId`、`submissionDate` 和只读快照。缺少必填字段时不得提交，并高亮全部错误。Adopter 只能查看和修改自己的 Draft，提交后只能查看状态及面向申请人的通知。

### 6.11 Application Assessment

#### FR-CHK-01 三项 SuitabilityCheck P0

每个已提交的 AdoptionApplication 必须自动建立三条 SuitabilityCheck：

1. Reference Check
2. Home Suitability Check
3. Pet Compatibility Check

每条记录包含 `checkId`、`checkType`、`outcome`、`checkNotes`、`conductedDate` 和 `completedBy`。Outcome 为 Pending、Pass、Concern 或 Fail。Staff 可分别完成三项检查，系统在三项均完成前禁止 Decide Application Outcome。

#### FR-CHK-02 Approve or Reject P0

- 三项全部 Pass 时，Staff 可 Approve Application。
- 任一项 Concern 或 Fail 时，Staff 必须填写 rejection reason，系统允许 Reject Application。
- 系统为结果生成 Notification，Adopter 只看到结果与适当说明，不看到内部检查笔记。
- Reject 后 Application 变为 Rejected，Animal 保持或返回 Available For Adoption。
- Approve 后 `Animal.currentStatus = Application In Progress`，并停止接收新的申请。
- 对同一 Animal 的其他未决定申请标记为 On Hold。若当前申请失败，可恢复处理。

### 6.12 Meet and Greet

#### FR-MG-01 Schedule and Conduct Meet and Greet P0

只有 Approved Application 可安排 Meet and Greet。Staff 创建可选时段，Adopter 可选择或确认其中一个时段。记录日期、时间、地点、participants、staff notes 和 outcome。

- Adopter 可查看预约并记录出席状态。
- Compatible 进入协议和付款阶段。
- Incompatible 关闭申请，写明原因，执行 Return Animal to Available Pool，并将 `currentStatus` 恢复为 Available For Adoption。

### 6.13 Agreement、Payment 与 Finalisation

#### FR-AGR-01 Adoption Agreement P0

Staff 根据当前条款模板生成 AdoptionAgreement。记录 adoptionConditions、returnPolicyPeriod、agreementVersion、generatedAt、isSigned 和 signedDate。Adopter 可在线签署。签署后协议不可编辑，只能查看或生成新版本并重新签署。Agreement 签署和 Payment 处理可以并行完成，系统不得强制两者的先后顺序。

#### FR-PAY-01 Adoption Payment P0

Adopter 可发起模拟付款，Staff 可记录或验证付款结果。AdoptionPayment 记录 amount、paymentDate、paymentMethod、paymentStatus、receiptNumber 和 paymentId。成功后可生成 receipt。Veterinarian 无付款处理权限。

#### FR-FIN-01 Finalise Adoption Record P0

只有 Staff 或 Administrator 可 finalise。系统必须同时验证：

- Meet and Greet outcome = Compatible
- AdoptionAgreement isSigned = true
- AdoptionPayment paymentStatus = Cleared

成功后：

- Application 标记为 Finalised。
- `listingStatus = Adopted`，动物从公开列表移除。
- `currentStatus = Awaiting Release`。
- adopterId 写入 Animal。
- 创建 Pre-Release Check 任务。

### 6.14 Pre-Release、Release 与 Follow Up

#### FR-REL-01 Conduct Pre-Release Check P0

只有 Veterinarian 可完成放行前检查。记录日期、fitness result、health findings、medication guidance 和 care instructions。

- Health Concern 将 `currentStatus` 更新为 Under Treatment，并进入治疗循环。
- Treatment Completed 将状态返回 Awaiting Release，并要求再次检查。
- Fit for Release 允许 Staff Release Animal to Adopter。

#### FR-REL-02 Release and Follow Up P0

放行时 Staff 确认 care instructions 已提供，并记录 releaseDate 和 receivingAdopter。随后：

- `currentStatus = inFollowUpPeriod`
- 创建 FollowUpVisit，包含 targetDate、followUpType（Phone Call 或 Home Visit）、assignedStaff、status 和 outcome。
- Staff 完成回访并记录 welfare outcome 后，`currentStatus = Rehomed`。

### 6.15 Notifications、Audit 与 Records

#### FR-AUD-01 Immutable AuditLog P1

每次 Create、Update、Soft Delete、status transition、login failure、permission denial、role transfer、payment verification 和 document generation 都写入 AuditLog。记录 `auditId`、`userId`、`timestamp`、`action`、`entityType`、`entityId`、`oldValue`、`newValue` 和 `result`。应用界面不提供修改或删除 AuditLog 的功能。

#### FR-NOT-01 Notifications P1

系统为以下事件生成 Notification：

- Statutory Hold approaching end date
- Behaviour reassessment due
- Vaccine booster due
- Desexing appointment due
- Application decision
- Meet and Greet scheduled
- Pre-Release Check required
- Follow Up Visit due
- Backup job failure

#### FR-REC-01 Archive、Search 与 Export P1

授权 Staff 可搜索 Archived 记录，但不可修改。Administrator 可导出 AuditLog、intake summary、medical clearance、adoption agreement 和 adoption statistics。永久删除必须经过两步确认并记录审计信息，原型默认不提供永久删除按钮。

## 7. 状态模型与业务规则

### 7.1 Animal.currentStatus

`currentStatus` 使用 A1 State Machine Diagram 的名称。

| 当前状态 | 进入条件 | 主要责任角色 | 允许的下一状态 |
|---|---|---|---|
| Under Assessment | animalReceived / createIntakeRecord | Staff、Vet | On Statutory Hold、Under Treatment、In Behaviour Program、Available For Adoption |
| On Statutory Hold | microchipMatched and owner identified | Staff | Reclaimed By Owner、Under Assessment |
| Reclaimed By Owner | ownerReclaimed | Staff、Council | ReturnedToOwner |
| Under Treatment | health concern or treatment required | Veterinarian | Under Assessment、Awaiting Release |
| In Behaviour Program | modification required | Staff | Under Assessment、Unsuitable For Adoption |
| Unsuitable For Adoption | permanently unsuitable | Staff | Archived |
| Available For Adoption | Medical Clearance、behaviour suitable、Staff publish | Staff | Application In Progress |
| Application In Progress | application approved | Staff | Available For Adoption、Awaiting Release |
| Awaiting Release | agreement signed、payment cleared、record finalised | Staff、Vet | Under Treatment、inFollowUpPeriod |
| inFollowUpPeriod | animal released to adopter | Staff | Rehomed |

Named final states are `ReturnedToOwner`、`Archived` and `Rehomed`。

### 7.2 listingStatus

| listingStatus | 业务含义 | 谁可触发 | 公开显示 |
|---|---|---|---|
| Not Fit | 默认值，尚未满足公开条件 | 系统 | 否 |
| Pre-Listing | Vet 已完成医疗放行，等待 Staff 发布 | 系统由 Medical Clearance 触发 | 否 |
| Current | Staff 已发布 | Staff、Administrator | 是，但 Application In Progress 时停止新申请 |
| Adopted | Adoption Record 已 finalise | Staff、Administrator | 否 |
| Removed | 被认领、永久不适合领养、死亡或 Staff 合规移除 | Staff、Administrator | 否 |

### 7.3 关键业务规则

| Rule ID | 规则 |
|---|---|
| BR-001 | 只有 Staff 或 Administrator 可创建正式 IntakeRecord。 |
| BR-002 | Council Officer 只能创建 Council Transfer Submission，并只可查看本人提交记录。 |
| BR-003 | 动物初始 `currentStatus = Under Assessment`，初始 `listingStatus = Not Fit`。 |
| BR-004 | Statutory Hold 未结束时，动物不得进入公开发布。 |
| BR-005 | 只有 Veterinarian 可编辑医疗记录和签发 Medical Clearance。 |
| BR-006 | 最新行为结果不合格时，动物不得发布。 |
| BR-007 | 只有 Staff 可从 Pre-Listing 发布为 Current，以及更新为 Adopted 或 Removed。Administrator 继承 Staff 权限。 |
| BR-008 | 只有 Current 且 Available For Adoption 的动物可接收申请。 |
| BR-009 | 三项 SuitabilityCheck 未全部完成时不得决定申请结果。 |
| BR-010 | 只有全部检查 Pass 才可批准。Concern 或 Fail 必须记录拒绝原因。 |
| BR-011 | Agreement 未签署或 Payment 未 Cleared 时不得 Finalise Adoption Record。 |
| BR-012 | Pre-Release Check 未通过时不得 Release Animal to Adopter。 |
| BR-013 | 已提交申请、已签协议、医疗记录、检查结果、microchip lookup 和 AuditLog 不得在普通界面删除。 |
| BR-014 | 每次状态变化必须写入 StatusHistory 与 AuditLog。 |
| BR-015 | 页面显示权限和数据库行级权限必须一致。 |
| BR-016 | Microchip Check、Temperament Assessment 和 Health Assessment 可并行处理，但进入 Review Adoption Fitness 前必须全部达到可继续状态。 |
| BR-017 | AdoptionAgreement 和 AdoptionPayment 可并行完成，但 Finalise Adoption Record 必须等待二者全部完成。 |

## 8. 数据模型

### 8.1 A1 核心类与关系

| 类 | 关键关系 |
|---|---|
| Person | Adopter、StaffMember、Veterinarian 的通用个人信息父类。 |
| Adopter | 1 个 Adopter 可拥有 0..* 个 AdoptionApplication。 |
| StaffMember | 1 个 StaffMember 可创建 0..* 个 IntakeRecord。 |
| Veterinarian | 1 个 Veterinarian 可负责 0..* 个 MedicalRecord。 |
| IntakeRecord | 每个正式 IntakeRecord 对应 1 个 Animal。 |
| Animal | 1 个 Animal 可关联 0..* 个 AdoptionApplication、1 个纵向 MedicalRecord 和 0..* 个 BehaviouralAssessment。 |
| AdoptionApplication | 每个 Application 精确包含 3 个 SuitabilityCheck，并最多对应 1 个 AdoptionAgreement。 |
| AdoptionAgreement | 每个已进入签约阶段的 Agreement 对应 1 个 AdoptionPayment。 |

### 8.2 核心实体字段

#### UserAccount

`userId`、`personId`、`email`、`authProvider`、`role`、`status`、`failedLoginAttempts`、`lockedAt`、`signUpAt`、`lastLoginAt`、`roleUpdatedBy`、`roleUpdatedAt`、`statusUpdatedBy`、`statusUpdatedAt`。

#### Person

`personId`、`titleOptionId`、`firstName`、`lastName`、`contactNumber`、`emailAddress`。

#### StaffMember

`personId`、`canApproveAdoptions`、`contactExtension`、`department`、`isBehaviourTrained`、`roleTitle`。

#### Veterinarian

`personId`、`clinicLocation`、`consultationHours`、`isAvailable`、`registrationNumber`、`specialisation`。

#### Adopter

`personId`、`residentialAddress`、`householdType`、`hasExistingPets`、`existingPetDetails`、`landlordPermission`、`preferredSpecies`、`environmentDetails`、`refereeDetails`、`refereeConsentAt`。

#### Animal

`animalId`、`name`、`species`、`breedOptionId`、`dateOfBirth`、`estimatedAge`、`dateOfDeath`、`sex`、`coatColour`、`coatMarkings`、`microchipNumber`、`adoptionFee`、`generalDescription`、`currentStatus`、`listingStatus`、`acceptingApplications`、`statusUpdatedAt`、`enteredAt`、`lastModifiedAt`、`adopterId`。

#### IntakeRecord

`intakeId`、`animalId`、`createdByStaffId`、`councilTransferSubmissionId`、`arrivalCircumstance`、`arrivalDateTime`、`intakeSource`、`councilPaperworkReference`、`surrenderingPartyName`、`finalisedAt`。

#### MedicalRecord

`recordId`、`animalId`、`responsibleVeterinarianId`、`assessmentDate`、`bodyCondition`、`vaccinationStatus`、`desexingStatus`、`clearanceStatus`、`clearanceIssuedAt`、`clearanceIssuedBy`。

#### BehaviouralAssessment

`assessmentId`、`animalId`、`assessmentDate`、`assessorId`、`handlingResponse`、`reactionToStrangers`、`foodBehaviour`、`interactionWithOtherAnimals`、`socialisationScore`、`requiresBehaviourProgram`、`outcome`、`recommendations`。

#### AdoptionApplication

`applicationId`、`adopterId`、`animalId`、`applicationStatus`、`motivationStatement`、`profileSnapshot`、`submissionDate`、`decisionDate`、`decisionBy`、`rejectionReason`。

#### SuitabilityCheck

`checkId`、`applicationId`、`checkType`、`checkNotes`、`conductedDate`、`completedBy`、`outcome`。

#### AdoptionAgreement

`agreementId`、`applicationId`、`adoptionConditions`、`returnPolicyPeriod`、`agreementVersion`、`isSigned`、`signedDate`。

#### AdoptionPayment

`paymentId`、`agreementId`、`amount`、`paymentDate`、`paymentMethod`、`paymentStatus`、`receiptNumber`。

### 8.3 实现支持实体

这些实体补足 A2 表单、审计和重复记录要求，不替换 A1 类图中的核心类。

| 实体 | 用途 |
|---|---|
| CouncilTransferSubmission | Council Officer 的转移提交和本人可见范围 |
| DocumentAttachment | seizure notice、complaint history、landlord approval 等附件 |
| Photo | 多张动物照片及公开图片标记 |
| MicrochipLookup | 查询结果、时间、匹配状态、失败原因 |
| RegisteredOwner | 匹配到的原饲主联系方式 |
| StatutoryHold | 留置开始、结束、提醒和认领结果 |
| MedicalEvent | Health Assessment、Treatment、Vaccination、Desexing、Pre-Release Check 的多次事件 |
| MedicationAdministration | medication、dose、chip ID、date |
| BehaviourProgram | 行为改造计划和复评安排 |
| MeetAndGreet | 预约、出席和 compatibility outcome |
| FollowUpVisit | 回访类型、日期、责任人和结果 |
| Notification | 面向用户或员工的状态提醒 |
| AuditLog | 不可变操作记录 |
| StatusHistory | Animal 与 Application 的状态变化历史 |
| DropdownOption | 可维护的下拉选项和 Soft Delete |
| SystemSetting | Holding Period、提醒天数、条款版本等配置 |
| BackupRun and RecoveryTest | 原型中的备份状态与恢复测试证据 |

### 8.4 数据完整性约束

- Email、intakeId、animalId、applicationId、agreementId、paymentId 和 receiptNumber 必须唯一。
- AdoptionApplication 必须关联一个 Adopter 和一个 Animal。
- 每个 AdoptionApplication 必须恰好有三种不同 checkType 的 SuitabilityCheck。
- 每个 Animal 只有一个主要公开 Photo。
- 一个 Animal 同时最多有一个 Approved 或 Application In Progress 的 AdoptionApplication。
- signed AdoptionAgreement、cleared AdoptionPayment 和 finalised AdoptionApplication 不可直接修改。
- 所有日期时间统一保存为 UTC，并按 `Australia/Brisbane` 时区显示。

## 9. 页面、操作与字段权限矩阵

| 模块或数据 | Administrator | Shelter Staff Member | Veterinarian | Council Officer | Adopter |
|---|---|---|---|---|---|
| User Administration | 全部 | 无入口 | 无入口 | 无入口 | 无入口 |
| System Administration | 全部 | 无入口 | 无入口 | 无入口 | 无入口 |
| Audit and Retention | 查看、导出、配置 | 无入口 | 无入口 | 无入口 | 无入口 |
| Council Transfer | 查看全部、接受 | 查看全部、接受 | 无入口 | 创建并查看本人 | 无入口 |
| Formal IntakeRecord | 创建、编辑、查看 | 创建、编辑、查看 | 入库后只读 | 仅本人转移状态摘要 | 无入口 |
| Animal General Profile | 全部 Staff 操作 | 创建、编辑、发布 | 查看 | 仅本人转移摘要 | 仅公开字段 |
| Photos | 上传、选择公开图 | 上传、选择公开图 | 查看 | 无 | 仅公开图 |
| Microchip and Hold | 创建、更新、查看 | 创建、更新、查看 | 只读 | 仅本人转移状态摘要 | 无 |
| MedicalRecord | 只读 | 只读 | 创建、编辑、finalise | 无 | 无内部记录 |
| BehaviouralAssessment | 创建、编辑、查看 | 创建、编辑、查看 | 只读 | 无 | 无 |
| Adoption Listing | 发布、撤下、查看 | 发布、撤下、查看 | 查看 | 查看公开信息 | 查看、筛选 |
| Adopter Profile | 处理申请时查看 | 处理申请时查看 | 无 | 无 | 仅本人创建和编辑 |
| AdoptionApplication | 查看、处理 | 查看、处理 | 相关记录只读 | 无 | 创建并查看本人 |
| SuitabilityCheck | 创建、编辑 | 创建、编辑 | 只读摘要 | 无 | 仅结果状态 |
| MeetAndGreet | 安排、记录 | 安排、记录 | 无 | 无 | 查看、出席 |
| AdoptionAgreement | 生成、验证 | 生成、验证 | 只读 | 无 | 查看、签署 |
| AdoptionPayment | 记录、验证、收据 | 记录、验证、收据 | 无 | 无 | 发起模拟付款、看收据 |
| Pre-Release Check | 只读 | 只读并执行 release | 创建、finalise | 无 | 仅 care instructions |
| FollowUpVisit | 安排、完成 | 安排、完成 | 只读 | 无 | 查看本人安排 |

### 9.1 Adopter 公开字段

Adopter 可见：Name、Species、Breed、Age、Sex、Adoption Fee、Temperament、General Description、Approved Photos 和公开申请状态。

Adopter 不可见：Medical History、Behaviour Risks、Owner History、Council Records、Statutory Hold 细节、Internal Assessment Notes、其他申请人资料、完整 microchip number、Staff Notes 和 AuditLog。

## 10. 非功能需求

### 10.1 Security NFUS1

- 强制实施角色权限与行级数据权限。
- 医疗内容仅 Veterinarian 可编辑。
- Adopter 只能访问本人资料和申请。
- 所有写操作与拒绝访问写入不可变 AuditLog。
- 6 次连续登录失败锁定账户。
- 只有 Administrator 可改变角色权限。

原型验收：使用五个演示账户逐一验证菜单、页面、按钮和直接 URL 访问。

### 10.2 Data Retention NFUS2

- IntakeRecord、MedicalRecord 和 AdoptionApplication 在动物离开系统后保留至少 7 年。
- 到期记录先标记 Archived，不自动 hard delete。
- Archived 记录仅授权人员可检索，且只读。
- AuditLog 至少保留 7 年并不可修改。
- Administrator 可查看 approaching end-of-retention 报告。
- 永久删除需要两步确认并写入 AuditLog。

原型验收：使用缩短的演示日期生成一条 approaching-retention 记录，证明归档和报告逻辑。

### 10.3 Performance NFUS3

| 操作 | 目标 |
|---|---|
| 保存 IntakeRecord 或 Medical Assessment | 正常负载下 2 秒内 |
| 以 shelter ID 或 microchip number 搜索 | 1.5 秒内 |
| 加载公开 Adoption Listing | 3 秒内 |
| Staff 并发会话 | 至少 25 个仍可响应 |
| National Pet Registry lookup | 8 秒超时并提供反馈 |
| 生成 12 个月 Adoption Statistics | 10 秒内 |

原型至少记录关键请求耗时，并为 Registry Timeout 提供固定测试情景。

### 10.4 Usability NFUS4

- 核心表单采用一致布局、按钮顺序和术语。
- 必填字段和错误原因清晰可见。
- Statutory Holding Period 与 Behaviour Program 等专业字段提供 tooltip。
- 长表单自动保存 Draft。
- 从 Landing Screen 到 Animal Search 不超过 3 次点击。
- Intake Summary、Medical Clearance 和 Adoption Agreement 可生成标准化 PDF 或打印视图。

### 10.5 Compliance and Privacy NFUS5

- 保存 Statutory Hold 的规则版本、开始日期、结束日期和处理结果。
- 保存 Adopter 对本人资料和 referee contact 的同意时间。
- Adoption Agreement 使用带版本号的条款模板。
- 绕过 Medical Clearance、Behaviour Assessment 或 Hold 的发布尝试必须被阻止并记录。
- AuditLog 可导出为 CSV。
- Holding Period 天数可由 Administrator 配置。

### 10.6 Accessibility NFUS6

公开页面目标为 WCAG 2.1 AA：

- 所有有意义的图片有 alt text。
- 表单可完全使用键盘操作。
- 可见焦点清晰。
- 正文与背景满足最低对比度。
- 输入框有可读 label，错误信息可被 screen reader 读取。
- 页面放大或调整文字大小时不隐藏字段或破坏布局。

### 10.7 Backup and Recovery NFUS7

生产目标为每日完整备份、每 4 小时增量备份、异地保存、失败告警、30 日 point-in-time recovery 和季度恢复测试。原型提供 Backup and Recovery Status 页面，展示最近一次完整备份、最近一次增量备份、下一次计划、失败状态和 Recovery Test Log。数据可为模拟，但字段和状态必须完整。

## 11. 校验、错误和空状态

| 情景 | 系统行为 |
|---|---|
| 必填字段缺失 | 阻止提交，聚焦第一个错误，并列出全部缺失字段 |
| 日期不合理 | 阻止未来 DOB、早于 intake 的 assessment 或早于当前日期的 schedule |
| 重复 ID 或 email | 阻止保存并说明冲突字段 |
| 未获授权 | 返回 Access Denied，隐藏敏感数据并写入 AuditLog |
| Registry Timeout | 8 秒结束加载，保存 Timeout 结果并显示 Retry |
| 上传失败 | 保留表单 Draft，显示支持的文件类型和大小限制 |
| 业务条件未满足 | 禁用或阻止动作，并逐项说明未满足条件 |
| 无列表数据 | 显示说明和允许的下一步，不显示空白页面 |
| 并发修改 | 提示记录已更新，要求刷新后重试，不覆盖较新数据 |

## 12. Seed Data 与测试场景

### 12.1 Animal 测试记录

| 动物 | Species | currentStatus | listingStatus | 主要测试情景 |
|---|---|---|---|---|
| Luna | Cat | Available For Adoption | Current | 公开列表与成功申请 |
| Max | Dog | Under Assessment | Not Fit | 新入库与 No Chip |
| Bella | Dog | On Statutory Hold | Not Fit | Owner Match 与 hold reminder |
| Milo | Cat | Under Treatment | Not Fit | Treatment recovery loop |
| Coco | Bird | In Behaviour Program | Not Fit | Behaviour reassessment loop |
| Ruby | Reptile | Under Assessment | Pre-Listing | Vet 已放行，等待 Staff 发布 |
| Charlie | Dog | Application In Progress | Current | 停止新申请与 incompatible 回退 |
| Daisy | Cat | Awaiting Release | Adopted | Pre-Release Check 与治疗回路 |
| Rocky | Dog | Unsuitable For Adoption | Removed | Archive 路径 |
| Oliver | Dog | inFollowUpPeriod | Adopted | Follow Up 完成后 Rehomed |

### 12.2 Registry 模拟数据

| Microchip Number | 返回结果 |
|---|---|
| 985141000111111 | Owner Match，返回 Jordan Smith 联系方式 |
| 985141000222222 | No Match |
| 985141000999999 | Timeout |
| 空值 | No Chip |

### 12.3 Breed Seed Data

每个 Species 至少提供 10 条带简短描述的 Breed 或 Type：

| Species | Breed or Type |
|---|---|
| Cat | Maine Coon、Siamese、Ragdoll、British Shorthair、Persian、Bengal、Sphynx、Burmese、Russian Blue、Abyssinian |
| Dog | Labrador Retriever、Golden Retriever、German Shepherd、Border Collie、Beagle、Poodle、French Bulldog、Staffordshire Bull Terrier、Cavalier King Charles Spaniel、Australian Cattle Dog |
| Bird | Budgerigar、Cockatiel、Lovebird、Canary、Zebra Finch、African Grey Parrot、Eclectus Parrot、Indian Ringneck、Sulphur-crested Cockatoo、Rainbow Lorikeet |
| Reptile | Bearded Dragon、Blue-tongued Skink、Leopard Gecko、Crested Gecko、Corn Snake、Children's Python、Eastern Long-necked Turtle、Murray River Turtle、Centralian Carpet Python、Ackie Monitor |

每条记录必须包含 `species`、`name`、`description` 和 `isRetired`，不得只保存名称。

### 12.4 Temperament Seed Data

至少建立以下 20 项：Calm、Friendly、Affectionate、Playful、Energetic、Gentle、Curious、Independent、Shy、Timid、Confident、Social、Reserved、Vocal、Quiet、Protective、Patient、Alert、Trainable、Reactive。

## 13. 四分钟演示路径

演示必须像向 prospective buyer 展示产品价值，同时证明四类 Persona 与 Administrator 的权限差异。

| 时间 | 演示内容 | 证明的要求 |
|---|---|---|
| 0:00-0:25 | 登录 Administrator，展示两组 Landing Screen 入口 | 角色化首页、Admin 与 Staff 叠加权限 |
| 0:25-0:45 | 快速展示 User Administration 和 Soft Delete 后历史值仍保留 | A2 Administration Functions |
| 0:45-1:05 | 切换 Council Officer，提交 Council Transfer 并上传文件 | Council 专属范围 |
| 1:05-1:40 | 切换 Staff，接受转移、创建 IntakeRecord、自动生成 ID、录入照片和 microchip | FUS1、FUS2、数据关系 |
| 1:40-2:05 | 切换 Veterinarian，记录 assessment、vaccination、desexing 和 clearance | FUS3、医疗权限和状态门控 |
| 2:05-2:25 | 切换 Staff，完成 Behavioural Assessment 并发布 Current listing | FUS4、Pre-Listing 到 Current |
| 2:25-2:55 | 切换 Adopter，筛选动物、更新 Profile、提交完整申请 | A2 customer-facing features、FUS5 |
| 2:55-3:25 | 切换 Staff，展示三项检查、批准与通知、Meet and Greet | FUS6、三条关系和业务规则 |
| 3:25-3:50 | 展示签约、付款、finalise 与 Pre-Release gate | FUS7、协议与付款条件 |
| 3:50-4:00 | 展示 AuditLog、状态历史和 Follow Up | 高级功能、专业完整性 |

若现场操作耗时，应预先准备每个阶段的数据，并只现场创建一只动物。这样既满足 A2 的创建演示要求，也能在 4 分钟内覆盖完整流程。

## 14. 需求追踪矩阵

| 来源 | PRD 实现位置 | UML 证据 |
|---|---|---|
| A2 Landing Screen | 5.1-5.3、6.1 | Use Case Diagram 的角色边界 |
| A2 User Administration | 6.2 | A2 明确验收标准 |
| A2 System Administration | 6.3 | A2 Soft Delete 规则 |
| A2 Animal Profile | 6.5、8.2 | Class Diagram 的 Animal、MedicalRecord、BehaviouralAssessment |
| A2 Adoption Listing | 6.9 | Use Case Diagram 的 Browse Adoption Listings |
| A2 Animal Intake | 6.4 | Activity Diagram 1、Sequence Diagram 1 |
| A2 Adoption Request | 6.10 | Activity Diagram 2、Sequence Diagram 2 |
| A2 Adopter Profile | 6.10 | Class Diagram 的 Adopter |
| A2 四类 Persona | 4、9 | Use Case Diagram actor generalisation |
| A2 Test Data | 12 | 两条 Activity Diagram 的成功和失败分支 |
| FUS1 | 6.4、6.5 | Create Intake Record、IntakeRecord、Animal |
| FUS2 | 6.6 | Scan Microchip、Query National Pet Registry、State Diagram hold path |
| FUS3 | 6.7 | MedicalRecord、Sequence Diagram 1、Under Treatment |
| FUS4 | 6.8 | BehaviouralAssessment、In Behaviour Program |
| FUS5 | 6.10 | Adopter、AdoptionApplication |
| FUS6 | 6.11 | 3 SuitabilityCheck composition、Activity Diagram 2 fork and join |
| FUS7 | 6.13-6.14 | AdoptionAgreement、AdoptionPayment、Awaiting Release、inFollowUpPeriod |
| NFUS1 Security | 4、9、10.1 | Actor permissions |
| NFUS2 Retention | 6.15、10.2 | Archived final state |
| NFUS3 Performance | 10.3 | 外部 registry timeout flow |
| NFUS4 Usability | 5、10.4、11 | A2 Landing and screen expectations |
| NFUS5 Compliance | 6.6、6.15、10.5 | Statutory Hold and AuditLog flow |
| NFUS6 Accessibility | 5.3-5.4、10.6 | Public listing and application screens |
| NFUS7 Backup and Recovery | 10.7 | System Administration prototype evidence |

## 15. UML 名称映射

### 15.1 Use Case 名称

界面动作、工作流或测试用例应与 A1 Use Case Diagram 保持以下名称对应：

| 流程 | Use Case 名称 |
|---|---|
| Intake and owner | Attach Council Transfer Documentation、Create Intake Record、Scan Microchip、Query National Pet Registry、Contact Registered Owner |
| Medical and fitness | Conduct Health Assessment、Administer Treatment、Administer Vaccination、Schedule Desexing、Issue Medical Clearance、Review Adoption Fitness、Update Animal Status |
| Behaviour | Conduct Temperament Assessment、Refer to Behaviour Program |
| Application assessment | Browse Adoption Listings、Submit Adoption Application、Conduct Reference Check、Conduct Home Suitability Check、Assess Pet Compatibility、Decide Application Outcome、Notify Applicant |
| Placement | Conduct Meet And Greet、Return Animal to Available Pool、Sign Adoption Agreement、Process Adoption Payment、Finalise Adoption Record |
| Release and follow up | Conduct Pre-Release Check、Return Animal to Veterinary Care、Release Animal to Adopter、Schedule Follow Up Visit |

### 15.2 Class 与 Sequence 操作名称

以下名称来自 A1 Class Diagram 和 Sequence Diagrams，应作为服务动作、按钮动作或工作流名称保留：

| 类或角色 | 操作名称 |
|---|---|
| Person | createProfile、deactivateProfile、getFullName、updateContactDetails、validateContactDetails |
| Adopter | attendMeetAndGreet、browseAdoptionListings、payAdoptionFee、signAdoptionAgreement、submitAdoptionApplication |
| StaffMember | conductTemperamentAssessment、createIntakeRecord、finaliseAdoptionRecord、notifyApplicant、provideCareInstructions、scanMicrochip、scheduleFollowUpVisit、updateAnimalStatus |
| Veterinarian | administerTreatment、administerVaccination、conductHealthAssessment、conductPreReleaseCheck、issueMedicalClearance、provideCareInstruction、scheduleDesexing |
| IntakeRecord | assignShelterId、attachCouncilPaperwork、createIntakeRecord、getIntakeSummary、updateIntakeDetails |
| Animal | archiveAnimalRecord、createAnimalProfile、getMedicalHistory、isAvailableForAdoption、updateStatus |
| MedicalRecord | addVaccination、getTreatmentHistory、issueClearance、recordMedicalFindings、scheduleDesexing |
| BehaviouralAssessment | calculateSocialisationScore、flagForBehaviourProgram、getAssessmentOutcome、reassessAnimal、recordAssessment |
| AdoptionApplication | approveApplication、evaluateCheckResults、recordCheckOutcome、rejectApplication、submitApplication |
| SuitabilityCheck | contactReferee、getCheckSummary、initiateCheck、isCheckComplete、recordOutcome |
| AdoptionAgreement | addCondition、generateAgreement、getAgreementTerms、recordSignature、verifyAgreementComplete |
| AdoptionPayment | generateReceipt、getPaymentDetails、processPayment、refundPayment、verifyPaymentCleared |

## 16. Definition of Done

原型只有在以下条件全部满足后才可用于最终录屏：

- 所有 P0 页面可打开，无 dead link、空按钮或只显示静态占位内容的核心功能。
- 五个角色账户均通过菜单权限、页面权限和行级权限测试。
- User Administration 的唯一 Administrator、Active 限制和转移确认有效。
- Soft Delete 不破坏历史记录。
- Animal Profile 包含 A2 要求的全部字段、照片、医疗和行为子页面。
- 两条 Activity Diagram 主流程及主要失败分支可以通过界面完成。
- 两组并行流程按 UML 运作。入库后的三项评估全部完成后才进入 fitness review，签约与付款全部完成后才 finalise。
- Animal currentStatus 与 listingStatus 按第 7 节同步，非法跳转被阻止。
- AdoptionApplication 精确包含三项 SuitabilityCheck。
- 签约与付款未完成时无法 finalise，Pre-Release Check 未通过时无法 release。
- 所有核心写操作产生 AuditLog 和 StatusHistory。
- 公开页面不泄露医疗、行为风险、owner、council 或其他 adopter 信息。
- Breed 每类至少 10 项，Temperament 至少 20 项，测试数据覆盖所有关键状态。
- 必填校验、错误、成功、loading、empty 和 Access Denied 状态均有清晰界面。
- 公开页面通过键盘、alt text、对比度和文字缩放的基础可访问性检查。
- 所有页面使用第 5 节定义的 ASAMS 组件与设计令牌，未出现与角色或页面无关的 AO3 名称、图标和示例内容。
- ASAMS Dawn 与 ASAMS Moon Cool 可即时切换并持久化。桌面、平板和手机布局均通过视觉与交互检查。
- Animals、Adoption Listings、Applications 与一个 Work Queue 已验证三栏桌面布局，以及平板和手机的导航、筛选收起行为。
- 自有 Logo 和动物插画只在核心功能、失败路径、主题和响应式验收通过后加入。移除所有装饰资源时系统仍可完整使用。
- 4 分钟演示路径经过计时彩排，并保留 30 秒以内的操作缓冲。

## 17. 开发顺序

建议按以下顺序构建。先建立可复用的界面框架，但将最终视觉资产放到最后，避免功能与数据关系因装饰设计返工：

1. UserAccount、Person、角色权限与 Landing Screen。
2. DropdownOption、SystemSetting 和 User Administration。
3. Animal、IntakeRecord、Photo 与 CouncilTransferSubmission。
4. MicrochipLookup、StatutoryHold、MedicalRecord 与 BehaviouralAssessment。
5. currentStatus、listingStatus、状态门控和 AuditLog。
6. Adoption Listing、Adopter Profile 与 AdoptionApplication。
7. 三项 SuitabilityCheck、MeetAndGreet、Agreement 和 Payment。
8. Pre-Release、Release、FollowUpVisit、Notifications 和导出。
9. 将全部页面统一到 AppHeader、RoleSidebar、RecordCard、FilterPanel、表单和反馈组件，并完成 Dawn 与 Moon Cool 主题覆盖。
10. 完成平板与手机适配、键盘操作、对比度和 200% 文字缩放检查。
11. Seed Data、权限测试、失败路径和 4 分钟演示彩排。
12. 加入最终 ASAMS Logo、用户绘制的动物插画与背景装饰，完成两套主题和三个断点的最终视觉回归。
