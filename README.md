# PixAI

PixAI 是一个 OpenAI-compatible 图片生成桌面程序。当前版本使用 Electron + React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand + SQLite/better-sqlite3 + Drizzle ORM + electron-builder 实现。

## 当前能力

- 配置 OpenAI-compatible `baseURL`、`apiKey`、默认模型。
- 默认模型为 `gpt-image-2`。
- 调用 `${baseURL}/v1/images/generations` 生成图片。
- 优先处理 `b64_json`，兼容服务返回 `url` 时由主进程下载后保存本地。
- 支持应用内多会话：每个会话有独立草稿、参数和生成状态。
- 支持删除应用内对话，删除后共享历史记录保留。
- 所有会话共享本地历史库，历史页支持搜索、排序、收藏、删除、重新填充参数。
- 图片工具箱支持预览、复制到剪贴板、放大、缩小、下载保存。
- 支持 1K、2K、4K 多种画幅比例尺寸预设。
- 生成失败会写入失败历史和当前会话，不丢失 prompt 和参数。

## 文档

- [设计方案](docs/DESIGN.md)
- [开发进度](docs/PROGRESS.md)
- [调试与构建教程](docs/DEBUG_BUILD.md)

## 快速开始

```powershell
pnpm install
pnpm dev
```

生产构建：

```powershell
pnpm build
pnpm dist
```

Windows 安装包输出到：

```text
dist/PixAI Setup 0.1.0.exe
```

## 本地数据

应用数据保存在 Electron `app.getPath("userData")` 目录下：

- `settings.json`：服务地址、默认模型、加密后的 API Key 或降级明文 Key。
- `pixai.sqlite`：会话、生成轮次和历史记录元数据。
- `images/`：生成后的本地图片文件。

渲染进程不直接访问文件系统或数据库，只通过预加载脚本暴露的白名单 IPC 调用主进程。
