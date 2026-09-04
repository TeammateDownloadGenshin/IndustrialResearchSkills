# IndustrialResearchSkills

面向医疗健康、医药生物和上市公司研究的显式调用 Codex 插件。
An explicit-only Codex plugin for evidence-led healthcare, biomedical, industry, and equity research.

它不是“一键生成研报”的提示词合集，而是一套把以下对象连接起来的研究工作流：

- 研究问题、投资假设与反方验证；
- 公司公告、监管文件、临床注册、论文和交易文件；
- 财务模型、管线表、竞品表、市场空间与估值；
- 研报正文、图表、Claim–Evidence Map和可审计底稿；
- Word、Excel、PPT、PDF的交付前质检。

核心原则：**重要结论必须能回到时点有效的原始证据；事实、计算、假设、解释和情景必须分开。**

## 1. 调用方式

本插件默认不会自动运行。请从 Codex 的 `/` 菜单选择，或在任务中显式输入：

```text
$industrial-research-skills
```

禁用隐式调用的配置位于
[`agents/openai.yaml`](skills/industrial-research-skills/agents/openai.yaml)：

```yaml
policy:
  allow_implicit_invocation: false
```

显式调用只授权当前任务需要的研究和文件产出，不自动授权付费访问、登录态、API Key、交易、对外发布或发送消息。

## 2. 能力地图

| 研究任务 | 使用模块 | 主要产物 |
|---|---|---|
| 从零撰写公司深度研报 | `research-workflows` + `analyst-workbench` | 研究框架、正文、图表、预测、估值、催化剂、风险 |
| 创新药、器械及医疗服务研究 | 加载 `biomed-research` | 管线表、机制链、竞品表、临床评价、rNPV |
| 产业链和技术专题 | `research-workflows` | 产业链图、市场空间、竞争格局、公司映射 |
| 财报点评和跨国药企对比 | `analyst-workbench` | 单季拆分、产品财务、变化解释、管理层表述 |
| 更新已有A股财务底稿 | `sheet_update` | 新期间XLSX、公式、公告截图和更新记录 |
| 为PDF/DOCX研报联网找证据 | `evidence` | 左侧研报区块、右侧证据截图和链接的审计型XLSX |
| 盘点本地资料和底稿 | `workspace-curation` | 文件清单、重复组、版本状态、陈旧证据和清理建议 |
| 图表及交付物质检 | `analyst-workbench` | 数据/公式复核、来源注释、渲染和视觉检查 |
| 来源和引用审查 | `source-policy` | 来源分级、证据强度、时点检查、冲突记录 |
| 研究逻辑反方审查 | `research-workflows` | 可证伪条件、敏感假设、反方证据和未决问题 |

## 3. 从零完成一篇完整研报

推荐流程：

```text
项目盘点
→ 定义研究范围和数据截止日
→ 建立目录、问题树与证据计划
→ 公司/行业/生物医学研究
→ 更新或搭建财务底稿
→ 管线、竞品、市场空间与估值
→ 正文和可复算图表
→ 联网证据底稿
→ 反方审查
→ Word/PDF交付质检
```

### 3.1 立项

先明确：

- 研究对象、地区和业务边界；
- 研报要支持的判断；
- 数据截止日、预测期间和估值日期；
- 报告币种、单位和可比公司；
- 最终交付格式；
- 最关键、最需要证伪的假设。

产物应包括目录、问题树、资料需求表和初始来源台账，而不是直接堆叠长文。

### 3.2 公司和行业研究

可覆盖：

- 公司沿革、股权结构、管理层与资本配置；
- 商业模式、产品结构、客户和供应商；
- 收入的量、价、结构及利润率驱动；
- 产业链、竞争单元、市场空间和壁垒；
- 产能、库存、现金流、营运资本和资本开支；
- 盈利预测、DCF、可比公司、SOTP或资产价值；
- 催化剂、风险、反方证据和未决问题。

市场空间应同时进行自上而下和自下而上的校验，并披露基准年、汇率、纳入边界及不确定性。

### 3.3 医药和生物科技附加层

医药项目额外记录：

- 资产、成药形式、靶点/机制、权益区域和合作方；
- 适应症、标志物、治疗线数及患者人群；
- 临床阶段、试验编号、设计、对照、终点、入组人数；
- 数据截止日、随访成熟度、疗效、安全性和下一里程碑；
- CMC、生产、伴随诊断、入组、监管和融资约束；
- 首付款、里程碑、分成、选择权和地域权益；
- 分资产rNPV的概率、时间、价格、渗透率、成本和稀释假设。

不得把不同适应症或队列压缩成一个临床阶段。跨试验比较必须先对齐人群、既往治疗、对照、终点定义、随访及数据成熟度。

RNA表达、蛋白表达、膜定位、共表达、内吞能力和药物敏感性是不同证据命题，不能互相替代。

### 3.4 完成标准

完整研报至少应交付：

- 结论先行的正文；
- 财务预测和估值敏感性；
- 管线、竞品、催化剂和风险表；
- 每张图的源数据、公式或绘图代码；
- 来源台账；
- Claim–Evidence Map；
- 反方证据和未解决事项；
- 经过渲染检查的最终文件。

## 4. 更新财务数据

仓库中的 [`sheet_update`](sheet_update/SKILL.md) 用于把**已有A股XLSX底稿**滚动至：

- `YYYYQ1`
- `YYYYH1`
- `YYYYQ3`
- `YYYYFY`

标准流程：

1. 检查并渲染原始工作簿；
2. 识别sheet结构、期间、单位和公式；
3. 获取交易所、巨潮资讯、定期报告或公司IR正式文件；
4. 校验证券主体、合并口径和报告期；
5. 提取合并资产负债表、利润表和现金流量表；
6. 建立更新manifest；
7. 生成新的工作簿，不覆盖原文件；
8. 检查变动sheet、公式、图表和证据截图；
9. 输出差异说明和未解决映射。

会计语义：

- 利润表和现金流量表的单季值可以由累计值相减；
- 资产负债表是期末时点值，不能通过相减取得；
- 报告口径、单位、重述和合并范围不一致时必须先调节；
- 不可靠的映射留空并记录，不猜数或硬填；
- 推导数据必须使用公式或保留透明计算。

`sheet_update` 不是从零搭建所有公司的通用模型器。港股、美股、首次建模或特殊业务结构应使用 `analyst-workbench` 单独设计底稿。

示例：

```text
$industrial-research-skills

将“公司2025FY财务底稿.xlsx”更新至2026H1。
只使用交易所、巨潮资讯、公司半年报和IR材料；
保留公式、格式和历史期间，不覆盖原文件；
在更新sheet下方附公告证据截图和链接，并列出未解决项。
```

## 5. 为某篇研报寻找联网底稿

仓库中的 [`evidence`](evidence/SKILL.md) 接受PDF或DOCX研报，输出可审计的XLSX证据工作簿。

流程：

1. 渲染并检查原研报；
2. 按语义拆分文字、表格和图表区块；
3. 提取各区块的重要事实主张；
4. 按研报截止日搜索时点有效的公开资料；
5. 捕获支持段落、页面或PDF证据；
6. 评估覆盖程度；
7. 构建并渲染XLSX；
8. 保留无法充分证明的事项。

典型布局：

- 左侧：研报原始区块截图；
- 右侧：证据截图、来源名称、日期和可点击URL；
- 证据等级：`direct`、`derived`、`partial`、`context`；
- 未充分支持的主张：`unresolved`。

券商报告、搜索摘要、社交媒体和AI摘要只能作为线索或有署名的观点，不能用一篇研报证明另一篇研报。

示例：

```text
$industrial-research-skills

为“公司深度报告.docx”制作联网证据底稿。
逐段核对财务数字、临床结果、管线阶段、合作条款和市场空间；
左侧保留研报截图，右侧放公开证据截图和可点击URL；
只使用报告截止日前已经公开的资料。
```

## 6. 在本地资料库寻找已有底稿

`workspace-curation` 用于扫描用户指定的研究目录，区分：

1. 官方和原始来源；
2. 财务模型及计算底稿；
3. 分析笔记和Claim–Evidence Map；
4. 当前交付稿；
5. 渲染预览和可复现脚本；
6. 临时、重复、过期和浏览器profile文件。

默认只读。移动、重命名、归档或删除必须由用户明确授权并先核对目标。

推荐目录：

```text
company-or-theme/
  00_scope/
  01_sources/raw/
  01_sources/ledger/
  02_workpapers/
  03_analysis/
  04_deliverables/
  05_qa/
  90_archive/
  99_temp/
```

同一官方来源在项目内保留一个规范副本，通过台账引用；原始资料保持不可变，截图、裁剪和渲染件放入QA或证据输出目录。

## 7. 来源和证据规则

来源优先级：

1. 监管机构、交易所、政府、法院、临床注册和官方标签；
2. 公司公告、IR资料、正式协议和试验方案；
3. 同行评议的原始研究、标准机构、原始数据库、专利和行业协会；
4. 必要时使用可靠新闻补充尚无更强来源的时效背景。

每份重要资料应记录：

- 文件标题和URL；
- 发布日期和访问日期；
- 报告期、临床数据截止日或统计时点；
- 相关页码或章节；
- `current / historical / superseded / needs_refresh`状态；
- 证据强度及与具体主张的映射。

出现冲突时，先核对范围、期间、单位、币种、合并口径、修订状态、患者人群、终点和数据截止日；保留被拒值和选择理由。

## 8. 图表和交付要求

每张图必须保留：

- 原始数据；
- 计算公式或绘图代码；
- cohort/样本定义；
- 统计量、变换及缺失值处理；
- 单位和数据截止日；
- 来源注释；
- 局限性；
- 可编辑或可复算版本。

最终XLSX、DOCX、PPTX和PDF应渲染检查，至少核对标签、图例、页码、分页、图表范围、表格换行、超链接和保存后的显示结果。

## 9. 只读MCP服务器

根目录 [`.mcp.json`](.mcp.json) 注册本地 `industrial-research` MCP服务器。服务器基于Python标准库、stdio JSON-RPC，不联网、不执行研究脚本、不接受任意文件路径，也不写入文件。

可用工具：

- `list_research_workflows`
- `get_research_workflow`
- `get_upstream_provenance`

固定工作流资源：

- `analyst-workbench`
- `biomed-research`
- `evidence-workpaper`
- `research-workflows`
- `sheet-update`
- `source-policy`
- `upstream-provenance`
- `workspace-curation`

MCP只负责读取方法说明；联网检索、浏览器捕获、文档生成和文件修改仍由当前Codex任务在用户授权范围内完成。

## 10. 仓库结构

```text
.codex-plugin/plugin.json                 插件manifest
.mcp.json                                只读MCP配置
scripts/mcp_server.py                    固定白名单MCP服务器
skills/industrial-research-skills/       总skill与研究工作流
evidence/                                联网证据底稿模块
sheet_update/                            A股财务底稿更新模块
examples/                                历史可视化示例
SECURITY_AUDIT.md                        安全与依赖审查
THIRD_PARTY_NOTICES.md                   第三方来源和许可证
```

总skill只路由到 `evidence` 和 `sheet_update` 的规范实现，不复制其脚本和schema。

## 11. 运行依赖与安全边界

核心skill和MCP服务器只需要Python标准库，不需要API Key。

可选工作流使用Codex随附的工作区依赖：

- Python：`pdfplumber`、`Pillow`、`pypdf`；
- Node.js：`@oai/artifact-tool`、`sharp`、`playwright`；
- 本地工具：Poppler；需要DOCX转换时使用LibreOffice。

安全边界：

- 不绕过登录、付费墙、CAPTCHA、robots限制或限流；
- 不在未经授权的情况下使用API Key或私人登录态；
- 不把保密研报、患者级数据或重大非公开信息上传到外部服务；
- 不自动执行交易、仓位建议、对外发布或邮件发送；
- 浏览器profile、缓存、渲染输出和生成物不进入Git；
- 原始研报和财务底稿不被覆盖；
- 找不到可靠证据时保留未解决状态。

详见 [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) 和
[`upstream-provenance.md`](skills/industrial-research-skills/references/upstream-provenance.md)。

## 12. 新对话或新模型接手

切换Codex模型或新建对话后，不应依赖旧对话记忆。可直接发送：

```text
$industrial-research-skills

请先完整读取当前仓库的
skills/industrial-research-skills/SKILL.md，
再根据任务路由读取必要的references和底层模块。

工作目录：<填写绝对路径>
研究对象：<公司/行业/产品>
数据截止日：<YYYY-MM-DD>
交付物：<完整研报/财务更新/证据底稿/图表/Word/PPT等>

要求：
1. 优先使用官方和原始来源；
2. 区分事实、计算、假设、解释和情景；
3. 重要结论建立Claim–Evidence Map；
4. 所有图表保留源数据、计算逻辑、单位和截止日；
5. 不覆盖原文件；未解决问题明确列出。
```

然后根据任务追加下面任一指令：

### 完整医药研报

```text
从零完成公司深度研报，覆盖公司概况、行业、产品/管线、
临床与竞品、商业化、财务预测、估值、催化剂和风险，
并输出正文、图表底稿、来源台账和Claim–Evidence Map。
```

### 财务数据更新

```text
将指定A股XLSX底稿更新至目标报告期，只使用官方披露，
保留公式和历史期间，生成新文件并附证据截图及未解决项。
```

### 为研报找联网底稿

```text
将指定PDF/DOCX按语义区块拆分，按报告截止日寻找公开证据，
生成左侧原文截图、右侧证据截图和URL的审计型XLSX。
```

## 13. 验证与维护

发布前至少执行：

```powershell
python skills/industrial-research-skills/scripts/workspace_inventory.py --self-check
node sheet_update/tests/period_rules.mjs
```

并完成：

- skill和插件manifest验证；
- Python及Node语法检查；
- MCP initialize/list/read冒烟测试；
- 最终文档或工作簿渲染检查；
- 敏感信息、绝对路径和大体积生成物扫描。

`examples/` 中的二进制工作簿仅作为历史视觉参考。新的测试优先使用小型生成fixture；不要提交专有研报、官方文件副本、浏览器profile或大型生成工作簿。

## 14. 许可证与第三方说明

仓库采用MIT许可证。第三方方法来源、固定版本、许可证与排除决定见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 和
[`upstream-provenance.md`](skills/industrial-research-skills/references/upstream-provenance.md)。
