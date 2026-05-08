# 调试与构建教程

## 环境要求

- Node.js 20 或更高版本。
- pnpm 可直接调用。
- Windows 优先。

当前验证环境：

- Node.js `v24.12.0`
- pnpm `10.11.0`
- Windows 11

## 安装依赖

```powershell
pnpm install
```

安装完成后，`postinstall` 会运行：

```powershell
electron-builder install-app-deps
```

这个步骤会按 Electron ABI 重建 `better-sqlite3`。

## 启动开发模式

```powershell
pnpm dev
```

成功后会看到 renderer dev server：

```text
http://localhost:5173/
```

Electron 窗口会自动启动。

## 生产构建

日常小改动优先使用 TypeScript 轻量验证：

```powershell
pnpm exec tsc --noEmit
```

涉及 Vite/Electron 构建、产物或打包配置时再运行完整构建：

```powershell
pnpm build
```

该命令会执行：

```text
tsc --noEmit
electron-vite build
```

输出目录：

- `out/main`
- `out/preload`
- `out/renderer`

## Windows 安装包

```powershell
pnpm dist
```

输出文件：

```text
dist/PixAI Setup 0.1.0.exe
dist/win-unpacked/PixAI.exe
```

## API 调试流程

1. 启动应用。
2. 打开设置。
3. 填写 `Base URL`，例如 `https://api.openai.com`。
4. 填写 API Key。
5. 填写默认模型，例如 `gpt-image-2`。
6. 新建或选择一个对话。
7. 选择 1K、2K 或 4K 尺寸预设。
8. 输入 prompt 并点击生成。

生成成功后：

- 当前对话会显示本次生成轮次和图片。
- 图片卡片可预览、复制、放大、缩小和下载保存。
- 图片文件写入 Electron `userData/images/`。
- 会话、生成轮次和历史元数据写入 Electron `userData/pixai.sqlite`。
- UI 通过 `pixai-image://{id}` 展示本地图片。

生成失败后：

- 当前对话展示错误信息。
- 全局历史保留失败状态、prompt、模型、尺寸、质量和错误信息。
- 失败卡片可展开查看详细调试日志，包括失败阶段、HTTP 状态、响应体截断、请求参数摘要和异常 stack。
- 详细日志不会包含 API Key 或 Authorization header。

## 本地数据位置

Electron 数据目录由以下 API 决定：

```ts
app.getPath('userData')
```

常见 Windows 路径类似：

```text
C:\Users\<User>\AppData\Roaming\PixAI
```

主要文件：

- `settings.json`
- `pixai.sqlite`
- `images/`

需要重置本地数据时，关闭应用后删除该目录下对应文件即可。

## 常见问题

### dev 报 Electron uninstall

现象：

```text
Error: Electron uninstall
```

原因通常是 pnpm 忽略了 Electron 安装脚本，导致 Electron 二进制未下载。

处理：

```powershell
pnpm rebuild electron esbuild
```

如果仍失败，可直接运行 Electron 安装脚本：

```powershell
node node_modules\electron\install.js
```

### 不要普通 rebuild better-sqlite3

在 Node.js 24 环境下，普通 rebuild `better-sqlite3` 可能需要本机 Visual Studio C++ 工具链。本项目的策略是：

- pnpm 层显式忽略 `better-sqlite3` 的普通安装脚本。
- 由 `electron-builder install-app-deps` 按 Electron ABI 重建。

因此通常只需要：

```powershell
pnpm install
```

### dist 首次下载慢

首次运行 `pnpm dist` 时，electron-builder 可能下载 Electron、NSIS 和 NSIS resources。这些文件来自 GitHub，网络不稳定时可能需要重试。

### winCodeSign 解压权限问题

普通 Windows 用户可能没有创建符号链接权限，导致 `winCodeSign` 解压失败。当前配置已关闭：

```json
"signAndEditExecutable": false
```

这可以避免未配置签名证书时的打包阻塞。正式发布如需签名，需要重新配置证书和签名流程。

## 清理构建产物

PowerShell：

```powershell
Remove-Item -Recurse -Force out, dist
```

然后重新构建：

```powershell
pnpm build
pnpm dist
```
