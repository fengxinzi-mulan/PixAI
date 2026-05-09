# PixAI

PixAI 是一个 Windows 桌面图片生成工具，使用 Electron + React + TypeScript 构建，接入 OpenAI-compatible 图片生成接口。

## 功能

- 配置 `baseURL`、`apiKey` 和默认模型，默认模型为 `gpt-image-2`。
- 调用 `${baseURL}/v1/images/generations` 生成图片。
- 多会话工作台：每个会话独立保存 prompt 草稿、模型、比例、质量和生成数量。
- 多图并发生成：当 `n > 1` 时并发请求，单张图片完成后会立即替换对应占位卡片。
- 单张取消：取消某一张生成中的图片只影响对应请求，取消项会从工作区移除，不写入失败历史。
- 本地 SQLite 历史库：支持搜索、排序、收藏、删除和参数回填。
- 图片预览、智能缩放、左右切换、复制到剪贴板、下载保存。
- 左侧会话区支持拖拽调整宽度，并持久化到本地浏览器存储。
- 白天/黑夜主题与可收起设置面板。

## 开发

```powershell
pnpm install
pnpm dev
```

## 验证与打包

```powershell
pnpm test
pnpm build
pnpm dist
```

Windows 安装包输出到：

```text
dist/PixAI Setup 0.1.0.exe
```

## 本地数据

开发环境下，数据保存在项目根目录的 `data/` 目录；打包安装后，数据保存在安装目录下的 `data/` 目录：

- `settings.json`：服务配置和 API Key 存储信息。
- `pixai.sqlite`：会话、生成轮次和图片历史。
- `images/`：生成后的本地图片文件。
