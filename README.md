# PixAI

PixAI 是一个 Windows 桌面图片生成工作台，使用 Electron、React 和 TypeScript 构建，支持接入 OpenAI-compatible 图片生成接口。

它面向本地化的 AI 绘画工作流：在多会话中管理提示词、参考图和生成参数，将生成结果保存到本地 SQLite 历史库，并提供图库检索、预览、收藏、复制、下载和参数回填。

## 界面截图

| 控制台 | 预览 | 图库 |
| --- | --- | --- |
| ![控制台界面](https://tncache1-f1.v3mh.com/image/2026/05/11/9ea034f922a51ecbdc2f9c8db47b006a.png) | ![预览界面](https://tncache1-f1.v3mh.com/image/2026/05/11/976f85bdb54668c3ecbebf9a052f86b9.png) | ![图库界面](https://tncache1-f1.v3mh.com/image/2026/05/11/1019050da0e76d8d7efcf8a81fb61eea.png) |

## 功能特性

- OpenAI-compatible 接口：配置 `baseURL`、`apiKey`、图片模型和提示词辅助模型。
- 文生图与图生图：支持会话参考图，调用 `/v1/images/generations` 和 `/v1/images/edits`。
- 多会话工作台：每个会话独立保存 prompt 草稿、模型、比例、尺寸、质量、数量和高级参数。
- 并发生成与单图取消：当 `n > 1` 时并发请求，单张完成后立即写入历史并更新工作区。
- 提示词辅助：支持一键生成灵感提示词，并对当前提示词进行丰富和优化。
- 本地图库：支持搜索、排序、筛选、收藏、删除、批量下载、作为参考图图生图和参数回填。
- 图片预览：支持智能缩放、滚轮缩放、拖拽平移、左右切换、复制、下载和系统全屏。
- 本地持久化：使用 SQLite 保存会话、生成轮次和图片历史，生成图片保存到本地文件夹。
- 桌面体验：支持白天/黑夜主题、可收起设置面板、可拖拽调整会话栏宽度。

## 技术栈

- Electron 34
- Electron Vite
- React 19
- TypeScript 5
- Zustand
- better-sqlite3
- Vitest
- electron-builder

## 环境要求

- Windows 10 或更高版本，支持 x64 与 ia32 安装包
- Node.js 22 或兼容版本
- pnpm 10
- 可用的 OpenAI-compatible API Key

项目声明的包管理器为：

```text
pnpm@10.26.2
```

## 快速开始

安装依赖：

```powershell
pnpm install
```

启动开发环境：

```powershell
pnpm dev
```

`pnpm dev` 会先按当前系统架构重建本地原生依赖，避免在切换过 x64 / ia32 打包后出现模块架构不匹配。

打开应用后，在右侧设置面板填写：

- `baseURL`：默认 `https://api.openai.com`
- `apiKey`：图片生成服务的 API Key
- 默认图片模型：默认 `gpt-image-2`
- 提示词辅助模型：默认 `gpt-5.4-mini`

## 常用脚本

```powershell
pnpm dev      # 启动 Electron + Vite 开发环境
pnpm test     # 运行单元测试
pnpm build    # TypeScript 检查并构建主进程、preload 和 renderer
pnpm preview  # 预览已构建应用
pnpm dist     # 构建 Windows 安装包
```

Windows 安装包输出到：

```text
dist/
```

安装包文件名会包含架构后缀，例如：

```text
PixAI Setup 1.0.0-x64.exe
PixAI Setup 1.0.0-ia32.exe
```

## 发布 Releases

GitHub Releases 由 `.github/workflows/release.yml` 自动完成。

1. 更新 `package.json` 里的版本号。
2. 创建并推送 tag：

```powershell
git tag v1.0.1
git push origin v1.0.1
```

也可以在 GitHub Actions 页面手动运行 workflow，并填写 `tag`。

workflow 会自动：

- 运行测试和构建检查
- 分别打包 `x64` 和 `ia32` 安装包
- 将安装包和 blockmap 上传到对应 GitHub Release

生成的 Release 资产包含：

```text
PixAI Setup <version>-x64.exe
PixAI Setup <version>-ia32.exe
```

## 本地数据

开发环境下，数据保存在项目根目录的 `data/` 目录；打包安装后，数据保存在安装目录下的 `data/` 目录。

```text
data/
├─ settings.json
├─ pixai.sqlite
├─ images/
└─ reference-images/
```

- `settings.json`：服务配置和 API Key 存储状态。
- `pixai.sqlite`：会话、生成轮次、图片历史和参考图索引。
- `images/`：生成后的图片文件。
- `reference-images/`：导入或从历史复制出的参考图文件。

API Key 会优先使用 Electron `safeStorage` 加密保存；当系统不支持加密时，会降级保存到本地设置文件，应用会在界面中提示该状态。

## 项目结构

```text
src/
├─ main/          # Electron 主进程、IPC、SQLite、设置、图片请求、文件处理
├─ preload/       # 安全暴露给 renderer 的 window.pixai API
├─ renderer/      # React 前端界面
└─ shared/        # 主进程、preload、renderer 共享类型与工具

docs/             # 设计方案与实现总结
data/             # 开发环境本地数据，未纳入版本控制
out/              # 构建输出
dist/             # 安装包输出
```

## 接口配置

PixAI 默认按 OpenAI-compatible 规范请求：

```text
POST {baseURL}/v1/images/generations
POST {baseURL}/v1/images/edits
POST {baseURL}/v1/responses
```

图片生成请求由当前会话参数决定，包括 prompt、模型、尺寸、质量、输出格式、背景、审核等级、流式参数和参考图。提示词辅助功能使用 `/v1/responses`。

## 测试与质量

运行全部测试：

```powershell
pnpm test
```

运行构建检查：

```powershell
pnpm build
```

当前测试覆盖了图片参数构造、生成进度、取消逻辑、错误详情、设置存储、历史筛选、工作区摘要、预览元数据和批量下载等核心逻辑。

## 文档

- [设计方案](docs/设计方案.md)
- [实现总结](docs/实现总结.md)

## 贡献

欢迎通过 Issue 或 Pull Request 反馈问题和改进建议。

建议在提交前运行：

```powershell
pnpm test
pnpm build
```

提交 PR 时请说明：

- 变更目的
- 主要实现方式
- 测试结果
- 可能影响的数据或配置

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)。

你可以将本项目用于个人学习、研究、实验和非商业二次开发。未经 PixAI 明确书面授权，不得将本项目或其衍生作品用于商业用途。

该许可证包含非商业限制，因此本项目属于 source-available 软件，不属于 OSI 定义下的开源软件。如需商业授权，请联系项目作者。
