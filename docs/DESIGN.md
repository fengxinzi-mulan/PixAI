# PixAI 设计方案

## 目标

PixAI v1 是一个简约白色风格的桌面图片生成工具，重点覆盖：

- OpenAI-compatible 图片生成接口。
- 应用内多会话生成，每个会话独立草稿、参数和任务状态。
- 所有会话共享本地历史库。
- 可配置服务地址、API Key 和默认模型。
- Windows 优先打包交付。

## 架构

- 主进程负责窗口创建、IPC、设置、图片生成请求、文件保存、SQLite 写入和历史查询。
- 预加载脚本只暴露白名单 API，不开放 Node.js、文件系统或数据库访问。
- 渲染进程负责会话式 UI、参数编辑、生成流展示、历史检索和设置弹窗。

关键模块：

- `src/main/index.ts`：窗口、协议和 IPC 注册。
- `src/main/database.ts`：SQLite 会话、生成轮次、图片历史。
- `src/main/image-service.ts`：OpenAI-compatible 请求和图片保存。
- `src/renderer/src/App.tsx`：会话式界面。
- `src/renderer/src/store/app-store.ts`：Zustand 状态。

## 会话模型

当前 UI 采用 ChatGPT 式应用内会话，而不是多个 Electron 系统窗口：

- 左侧栏：新建对话、会话列表、全局历史、设置。
- 中间：当前会话的多轮生成记录。
- 右侧：当前会话的模型、尺寸、质量、数量参数。
- 底部：当前会话 prompt 输入框和生成按钮。
- 会话列表中的删除按钮会删除该会话和生成轮次关联，但共享图片历史记录保留。

每个会话持久保存：

- 标题。
- prompt 草稿。
- 模型。
- 尺寸。
- 质量。
- 数量。
- 创建和更新时间。

每次生成保存为一个 run，run 下关联本次生成产生的图片历史记录。多个会话共享同一个 `image_history` 表。

## IPC 接口

当前 IPC 通道：

```text
settings:get
settings:update
image:generate
history:list
history:delete
history:favorite
conversation:list
conversation:create
conversation:update
conversation:delete
conversation:runs
window:new-generator
```

`window:new-generator` 保留为兼容别名，行为是创建应用内新会话，不再创建新的 `BrowserWindow`。

## 图片生成请求

默认 endpoint：

```text
${baseURL}/v1/images/generations
```

默认模型：

```text
gpt-image-2
```

请求参数：

- `prompt`
- `model`
- `size`
- `quality`
- `n`

响应保存策略：

- 若响应包含 `b64_json`，直接保存为本地 PNG。
- 若响应只包含 `url`，主进程下载图片并保存到本地。
- 若两者都没有，当前 run 和共享历史都记录失败。
- 生成请求不强制添加 DALL-E 专属 `response_format` 参数，保持 GPT Image 和第三方兼容服务的兼容性。

## 尺寸策略

不提供自由尺寸输入。UI 提供 1K、2K、4K 分组预设：

- 1K：`1024x1024`、`1536x1024`、`1024x1536`
- 2K：`2048x2048`、`2560x1440`、`1440x2560`、`2048x1152`、`1152x2048`
- 4K：`4096x4096`、`3840x2160`、`2160x3840`

如果兼容服务不支持某尺寸，失败信息会写入当前会话和全局历史。

## 数据模型

SQLite 表：

- `conversations`：应用内会话和草稿参数。
- `generation_runs`：每次点击生成形成的轮次。
- `image_history`：共享图片历史元数据。

图片文件保存在应用数据目录下的 `images/` 文件夹，数据库只保存元数据和本地路径。

图片工具箱能力：

- 预览：打开大图弹窗。
- 缩放：预览弹窗内支持放大和缩小。
- 复制：主进程读取本地图片并写入系统剪贴板。
- 下载：主进程弹出保存对话框，把本地图片复制到用户选择的位置。

失败记录同时保存短摘要和详细调试信息：

- `error_message`：用于卡片和提示的短错误摘要。
- `error_details`：用于调试的结构化详情，包含阶段、HTTP 状态、响应体截断、请求参数摘要和异常 stack。
- 详细信息限制长度，避免超大响应拖慢 SQLite 和 UI。

## 安全设计

- `contextIsolation: true`
- `nodeIntegration: false`
- API Key 不写入日志。
- API Key、Authorization header 不写入 `error_details`。
- 优先使用 Electron `safeStorage` 加密 API Key。
- 如果当前平台无法加密，则降级写入本地设置文件，并在 UI 中提示。
- 本地图片通过 `pixai-image://` 协议展示。
- 删除文件前校验目标路径位于应用 `images/` 目录下。
