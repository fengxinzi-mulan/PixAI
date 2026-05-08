# PixAI 开发进度

更新时间：2026-05-08

## 已完成

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 项目初始化 | 完成 | Electron + React + TypeScript + Vite + Tailwind CSS。 |
| shadcn/ui 基础组件 | 完成 | Button、Input、Textarea、Label、Dialog、Select、ScrollArea、Tabs。 |
| Zustand 状态 | 完成 | 会话、生成流、历史、设置状态集中管理。 |
| 应用内多会话 | 完成 | 新建对话不再打开新 Electron 窗口。 |
| 对话删除 | 完成 | 可从会话列表删除对话，共享历史保留。 |
| 会话持久化 | 完成 | 会话草稿、参数、生成轮次写入 SQLite。 |
| 共享历史库 | 完成 | 所有会话生成结果写入同一历史库。 |
| 主进程 IPC | 完成 | 增加 conversation 系列 IPC，保留 window:new-generator 兼容别名。 |
| 设置管理 | 完成 | 支持 `baseURL`、API Key、默认模型。 |
| 默认模型 | 完成 | 默认模型改为 `gpt-image-2`。 |
| 图片生成请求 | 完成 | 支持 OpenAI-compatible `/v1/images/generations`。 |
| 图片响应兼容 | 完成 | 优先 `b64_json`，兼容 `url` 下载。 |
| 失败调试日志 | 完成 | 失败记录保存短摘要和详细错误详情，UI 可展开查看。 |
| 图片工具箱 | 完成 | 支持预览、复制、放大、缩小、下载。 |
| 尺寸预设 | 完成 | 提供 1K、2K、4K 多比例尺寸。 |
| Windows 打包 | 完成 | `pnpm dist` 可生成 NSIS 安装包。 |

## 已验证

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `pnpm build` | 通过 | TypeScript、主进程、预加载、渲染进程构建成功。 |
| `pnpm exec tsc --noEmit` | 通过 | 日常轻量类型验证。 |

## 当前限制

- 还没有应用图标，打包时使用默认 Electron 图标。
- 还没有自动化单元测试或端到端测试。
- 尚未实现图片编辑、变体、蒙版编辑。
- 尚未实现云同步、账号系统、历史导出。
- Windows 打包当前未配置代码签名证书。
- 2K/4K 尺寸是否可用取决于所连接的 OpenAI-compatible 服务。

## 建议下一步

1. 增加应用图标和安装包品牌资源。
2. 补充主进程服务层单元测试，优先覆盖设置、历史删除、会话迁移、响应解析。
3. 用 Playwright 或 Electron 测试工具补充关键 UI 流程。
4. 增加历史图片打开所在目录、复制 prompt、导出图片等便捷能力。
5. 根据目标发行方式补充 Windows 代码签名配置。
