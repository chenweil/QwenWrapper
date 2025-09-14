# QwenWrapper: QwenCode ACP Integration Project

This project enables the integration of the QwenCode CLI program with the Zed editor via the ACP (Agent Client Protocol), allowing QwenCode to act as an AI assistant agent within Zed for code collaboration and conversational interaction.

## Project Overview

- ✅ Stable ACP communication between Zed and QwenCode
- ✅ Support for English conversation and code generation
- ✅ Comprehensive configuration and troubleshooting guide
- ✅ Detailed debug logging functionality
- ✅ Project has been renamed to QwenWrapper

## Installation and Configuration

### Prerequisites

- Zed Editor (>= 0.1.0)
- Node.js (>= 20.0.0)
- QwenCode CLI (`npm install -g @qwen-code/qwen-code`)

### 1. Install QwenCode

```bash
npm install -g @qwen-code/qwen-code
qwen --version  # Verify successful installation
```

### 2. Download the Wrapper Script

```bash
# Copy the qwen-acp-wrapper.js file from this project to your system
# For example, copy it to your user's home directory
```

### 3. Configure Zed

Add the following to `~/.config/zed/settings.json`:

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

**Important**:
1. Please replace `./qwen-acp-wrapper.js` in the configuration above with the actual path to your wrapper script.
2. The `--log-level` parameter supports two modes:
   - `dev`: Outputs detailed log information (for development and debugging)
   - `serve`: Outputs only error information (recommended for production use)

## Usage

### Starting an Agent Conversation

1. Open the Zed editor
2. Use the shortcut `Cmd+?` (macOS) or `Ctrl+?` (Linux/Windows) to open the Agent panel
3. Click the `+` button in the top-right corner of the panel to create a new conversation
4. Select `qwen-code-acp` from the list of available agents
5. Start conversing with QwenCode!

### Usage Examples

#### Code Generation
```
User: Help me create a JavaScript function to calculate the difference in days between two dates.

QwenCode: Of course! Here is a JavaScript function to calculate the day difference between two dates:

```javascript
function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; // Milliseconds in a day
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);

    const diffDays = Math.round(Math.abs((firstDate - secondDate) / oneDay));
    return diffDays;
}
```
```

#### Code Explanation
```
User: Explain the purpose of this regular expression: `/^\d{4}-\d{2}-\d{2}$/`

QwenCode: This regular expression is used to match date formats (YYYY-MM-DD)...
```

## Technical Architecture

### ACP Communication Flow

```
1. Zed Editor  <-->  ACP Wrapper  <-->  QwenCode CLI

2. Initialization Process:
   Zed -> ACP Wrapper: initialize
   ACP Wrapper -> QwenCode: --experimental-acp
   QwenCode -> ACP Wrapper: initialize response
   ACP Wrapper -> Zed: initialized

3. Conversation Process:
   Zed -> QwenCode: prompt
   QwenCode -> Zed: response
```

### Wrapper Functionality
- **Argument Handling**: Filters empty arguments to ensure correct command format.
- **I/O Forwarding**: Correctly forwards stdin/stdout between Zed and QwenCode.
- **Error Handling**: Captures and logs subprocess errors, providing detailed logs.
- **Debug Logging**: Records all ACP communication to `/tmp/qwen-acp-debug.log`.

## Troubleshooting

### Check Agent Status

```bash
# Check if the QwenCode ACP process is running
ps aux | grep "qwen --experimental-acp" | grep -v grep

# Check Zed processes
ps aux | grep -i zed | head -5
```

### View Debug Logs

```bash
# Monitor ACP communication in real-time
tail -f /tmp/qwen-acp-debug.log

# View recent errors
tail -100 /tmp/qwen-acp-debug.log | grep -E "(ERROR|error)"

# View the full session log
less /tmp/qwen-acp-debug.log
```

### Common Issues and Solutions

#### 1. QwenCode agent does not appear in the list
- Confirm the wrapper script path is correct.
- Check for syntax errors in `zed/settings.json`.
- Restart the Zed editor.

#### 2. Connection Failed
- Check if the wrapper script has execution permissions:
  ```bash
  chmod +x qwen-acp-wrapper.js
  ```
- Ensure Node.js is installed correctly.
- Verify the QwenCode CLI is available.

#### 3. Agent exits immediately after starting
- Check the debug log for error messages.
- Confirm the `--experimental-acp` parameter is passed correctly.
- Try running the wrapper manually:
  ```bash
  echo '''{"jsonrpc":"2.0","id":0,"method":"initialize"}''' | node qwen-acp-wrapper.js
  ```

#### 4. Model Unavailable
- Check your network connection.
- Confirm the ModelScope API address is accessible.
- Check the `language_models` configuration.

### Restarting Services

```bash
# Terminate all QwenCode ACP processes
pkill -f "qwen --experimental-acp"

# Restart Zed
# Relaunch from the Applications folder or via command line: open -a Zed
```

### Approval Mode Configuration

Adjust the `agent.always_allow_tool_actions` setting:

- `false`: Requires confirmation for every tool usage.
- `true`: Automatically allows all tool actions (recommended for development efficiency).
- Can also be overridden at runtime with the `--approval-mode` parameter.

## Development

### Code Structure

```
QwenWrapper/
├── qwen-acp-wrapper.js    # ACP Wrapper Script
├── CLAUDE.md             # Claude Code Development Guide
└── README.md            # This Document
```

### Modifying the Wrapper

To customize the wrapper's behavior, edit `qwen-acp-wrapper.js`:
- Change the log file location.
- Add custom preprocessing logic.
- Adjust the error handling methods.

## Related Resources

- [ACP Protocol Documentation](https://agentclientprotocol.com/overview/introduction)
- [Zed Documentation](https://zed.dev/docs)
- [Qwen Code Documentation](https://qwenlm.github.io/qwen-code-docs/)
- [Zed Agent Integration Guide](https://zed.dev/blog/bring-your-own-agent-to-zed)

## License

This project is licensed under the MIT License.

## Contributing

Issues and Pull Requests are welcome!

## Changelog

### 2025-09-12
- ✅ Fixed empty argument handling issue
- ✅ Optimized I/O pipe forwarding
- ✅ Added detailed debug logging
- ✅ Improved error handling mechanism
- ✅ Verified Chinese dialogue functionality
