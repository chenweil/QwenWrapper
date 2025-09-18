⚠️ 直接接入更方便，项目废弃。⚠️

另外iflow 0.2.23后也可直接接入了。

配置如下 macOS 为例：

```json
"agent_servers": {
    "iflow": {
      "command": "iflow",
      "args": ["--experimental-acp"]
    },
    "qwen": {
      "command": "qwen",
      "args": ["--experimental-acp"]
    }
}
```


# QwenWrapper: QwenCode ACP 集成项目

本项目实现了将 QwenCode CLI 程序通过 ACP (Agent Client Protocol) 协议集成到 Zed 编辑器中，使 QwenCode 能够作为 Zed 的 AI 助手代理进行代码协作和对话交互。


## 项目概述

- ✅ 实现了 Zed 与 QwenCode 的稳定 ACP 协议通信


- ✅ 支持中文对话和代码生成
- ✅ 完整的配置和故障排除指南
- ✅ 详细的调试日志记录功能
- ✅ 项目已更名为 QwenWrapper

## 安装和配置

### 前置要求

- Zed 编辑器 (>= 0.1.0)
- Node.js (>= 20.0.0)
- QwenCode CLI (`npm install -g @qwen-code/qwen-code`)

### 1. 安装 QwenCode

```bash
npm install -g @qwen-code/qwen-code
qwen --version  # 验证安装成功
```

### 2. 下载包装器脚本

```bash
# 将本项目的 qwen-acp-wrapper.js 文件复制到你的系统
# 例如复制到用户主目录下
```

### 3. 配置 Zed

在 `~/.config/zed/settings.json` 中添加以下内容：

```json
{
  ...
  "agent_servers": {
    "qwen-code-acp": {
      "command": "node",
      "args": ["./qwen-acp-wrapper.js", "--log-level", "serve"]
    }
  }
}
```

**重要**:
1. 请将上述配置中的 `./qwen-acp-wrapper.js` 替换为你实际的包装器脚本路径。
2. `--log-level` 参数支持两种模式：
   - `dev`: 输出详细日志信息（开发调试时使用）
   - `serve`: 仅输出错误信息（生产环境推荐使用）

## 使用方法

### 启动 Agent 对话

1. 打开 Zed 编辑器
2. 使用快捷键 `Cmd+?` (macOS) 或 `Ctrl+?` (Linux/Windows) 打开 Agent 面板
3. 点击面板右上角的 `+` 按钮创建新对话
4. 从可用代理列表中选择 `qwen-code-acp`
5. 开始与 QwenCode 进行对话！

### 使用示例

#### 代码生成
```
用户: 帮我创建一个JavaScript函数，用于计算两个日期之间的天数差

QwenCode: 当然可以！以下是一个计算两个日期间天数差的JavaScript函数：

```javascript
function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; // 一天的毫秒数
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);

    const diffDays = Math.round(Math.abs((firstDate - secondDate) / oneDay));
    return diffDays;
}
```
```

#### 代码解释
```
用户: 解释下这个正则表达式的作用：`/^\d{4}-\d{2}-\d{2}$/`

QwenCode: 这个正则表达式用于匹配日期格式（YYYY-MM-DD）...
```

## 技术架构

### ACP 协议通信流程

```
1. Zed Editor  <-->  ACP Wrapper  <-->  QwenCode CLI

2. 初始化过程:
   Zed -> ACP Wrapper: initialize
   ACP Wrapper -> QwenCode: --experimental-acp
   QwenCode -> ACP Wrapper: initialize response
   ACP Wrapper -> Zed: initialized

3. 对话过程:
   Zed -> QwenCode: prompt
   QwenCode -> Zed: response
```

### 包装器功能
- **参数处理**: 过滤空参数，确保正确的命令格式
- **I/O 转发**: 将 stdin/stdout 在 Zed 和 QwenCode 之间正确转发
- **错误处理**: 捕获并记录子进程错误，提供详细的日志
- **调试日志**: 记录所有 ACP 协议通信内容到 `/tmp/qwen-acp-debug.log`

## 故障排除

### 检查代理状态

```bash
# 检查 QwenCode ACP 进程是否运行
ps aux | grep "qwen --experimental-acp" | grep -v grep

# 检查 Zed 进程
ps aux | grep -i zed | head -5
```

### 查看调试日志

```bash
# 实时监控 ACP 通信
 tail -f /tmp/qwen-acp-debug.log

# 查看最近错误
 tail -100 /tmp/qwen-acp-debug.log | grep -E "(ERROR|error)"

# 查看完整会话记录
 less /tmp/qwen-acp-debug.log
```

### 常见问题解决

#### 1. QwenCode 代理未出现在列表中
- 确认包装器脚本路径是否正确
- 检查 Zed settings.json 语法是否有错误
- 重启 Zed 编辑器

#### 2. 连接失败
- 检查包装器脚本是否有执行权限：
  ```bash
  chmod +x qwen-acp-wrapper.js
  ```
- 检查 Node.js 是否正常安装
- 验证 QwenCode CLI 可用

#### 3. 代理启动后立即退出
- 查看调试日志中的错误信息
- 确认 `--experimental-acp` 参数被正确传递
- 尝试手动运行包装器：
  ```bash
  echo '{"jsonrpc":"2.0","id":0,"method":"initialize"}' | node qwen-acp-wrapper.js
  ```

#### 4. 模型不可用
- 检查网络连接
- 确认 ModelScope API 地址可访问
- 检查 language_models 配置

### 重启服务

```bash
# 终止所有 QwenCode ACP 进程
pkill -f "qwen --experimental-acp"

# 重启 Zed
# 从 Applications 文件夹重新启动或命令行：open -a Zed
```


### 审批模式配置

调整 `agent.always_allow_tool_actions` 设置：

- `false`: 每次工具使用都需要确认
- `true`: 自动允许所有工具操作（推荐用于开发效率）
- 也可在运行时通过 `--approval-mode` 参数覆盖

## 开发说明

### 代码结构

```
QwenWrapper/
├── qwen-acp-wrapper.js    # ACP 包装器脚本
├── CLAUDE.md             # Claude Code 开发指导
└── README.md            # 本文档
```

### 修改包装器

如需自定义包装器行为，编辑 `qwen-acp-wrapper.js`：
- 修改日志文件位置
- 添加自定义预处理逻辑
- 调整错误处理方式

## 相关资源

- [ACP 协议文档](https://agentclientprotocol.com/overview/introduction)
- [Zed 文档](https://zed.dev/docs)
- [Qwen Code 文档](https://qwenlm.github.io/qwen-code-docs/)
- [Zed Agent 集成指南](https://zed.dev/blog/bring-your-own-agent-to-zed)

## 许可证

本项目采用 MIT 许可证。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### 2025-09-12
- ✅ 修复空参数处理问题
- ✅ 优化 I/O 管道转发
- ✅ 添加详细调试日志
- ✅ 改进错误处理机制
- ✅ 验证中文对话功能
