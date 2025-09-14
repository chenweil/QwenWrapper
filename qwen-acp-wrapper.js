#!/opt/homebrew/bin/node
/**
 * QwenWrapper: Qwen ACP Wrapper for Zed Editor Integration
 *
 * Security-hardened wrapper that safely spawns Qwen Code process
 * with proper error handling, health monitoring, and resource management.
 *
 * @author Qwen Code ACP Integration
 * @version 2.0
 * @security Hardened against path traversal, injection, and resource leak attacks
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { Transform } = require("stream");

// Configuration constants
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds for graceful shutdown
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds for health checks
const PROCESS_TIMEOUT = 300000; // 5 minutes for process timeout
const MAX_STDIN_LOG_SIZE = 1024; // Max 1KB for stdin logging
const VALID_LOG_LEVELS = ['dev', 'serve', 'info', 'warn', 'error'];

// Global state variables (moved to top for better scope management)
let isLogFileClosed = false;
let child = null;
let healthCheckInterval = null;
let isShuttingDown = false;
let logFile = null;

// Parse command line arguments for log level
const args = process.argv.slice(2);
let logLevel = "serve"; // Default log level
let qwenArgs = [];

// Process arguments with better validation

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--log-level") {
    if (i + 1 < args.length) {
      const level = args[i + 1];
      if (VALID_LOG_LEVELS.includes(level)) {
        logLevel = level;
        i++; // Skip next argument
      } else {
        console.error(`Invalid log level: ${level}. Valid levels: ${VALID_LOG_LEVELS.join(', ')}`);
        process.exit(1);
      }
    } else {
      // If --log-level is the last argument, show error
      console.error("Missing log level value for --log-level option");
      process.exit(1);
    }
  } else {
    // Collect qwen arguments
    qwenArgs.push(args[i]);
  }
}

// Filter out empty arguments
qwenArgs = qwenArgs.filter((arg) => arg !== "" && arg.trim() !== "");

/**
 * Validates that a file path is safe and doesn't contain directory traversal attempts
 * @param {string} p - The path to validate
 * @returns {boolean} - True if the path is safe (no ../ traversals), false otherwise
 */
function isSafePath(p) {
  return !p.includes('..') && path.normalize(p) === p;
}

/**
 * Checks if a file is executable
 * @param {string} filePath - Path to the file to check
 * @returns {boolean} - True if file exists, is a file, and has execute permissions
 */
function isExecutable(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() && (stats.mode & parseInt('111', 8)) !== 0;
  } catch (error) {
    return false;
  }
}

/**
 * Searches for the qwen binary in PATH with security checks
 * Validates each PATH entry, checks file existence and execute permissions
 * @returns {string|null} - Full path to qwen binary if found, null otherwise
 */
function findQwenPath() {
  const paths = process.env.PATH.split(path.delimiter); // Use path.delimiter for cross-platform compatibility

  for (const p of paths) {
    try {
      // Validate the path is safe
      if (!isSafePath(p)) {
        log(`Skipping unsafe PATH entry: ${p}`, "warn");
        continue;
      }

      const fullPath = path.join(p, "qwen");

      // Check if file exists and is executable
      if (fs.existsSync(fullPath) && isExecutable(fullPath)) {
        log(`Found executable qwen at: ${fullPath}`, "info");
        return fullPath;
      }
    } catch (error) {
      log(`Error checking PATH entry ${p}: ${error.message}`, "warn");
      continue;
    }
  }

  // If not found in PATH, return null to indicate error
  return null;
}

/**
 * Determines the appropriate log file path
 * Check environment variable QWEN_ACP_LOG_PATH first, then tries home directory,
 * finally falls back to /tmp. Creates directories as needed.
 * @returns {string} - Path to use for log file
 */
function getLogFilePath() {
  const defaultLogPath = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.qwen-acp-debug.log');

  // Try environment variable first
  const envLogPath = process.env.QWEN_ACP_LOG_PATH;
  if (envLogPath) {
    const dir = path.dirname(envLogPath);
    try {
      // Ensure directory exists
      fs.mkdirSync(dir, { recursive: true });
      return envLogPath;
    } catch (error) {
      if (logFile && !isLogFileClosed) {
        logFile.write(`[ERROR] Failed to use env log path ${envLogPath}, falling back to default: ${error.message}\n`);
      } else {
        console.error(`Failed to use env log path ${envLogPath}, falling back to default: ${error.message}`);
      }
    }
  }

  // Try to use home directory
  try {
    const homeDir = path.dirname(defaultLogPath);
    fs.mkdirSync(homeDir, { recursive: true });
    return defaultLogPath;
  } catch (error) {
    if (logFile && !isLogFileClosed) {
      logFile.write(`[ERROR] Failed to create log directory, using /tmp: ${error.message}\n`);
    } else {
      console.error(`Failed to create log directory, using /tmp: ${error.message}`);
    }
    return '/tmp/qwen-acp-debug.log';
  }
}

const qwenPath = findQwenPath();
const logFilePath = getLogFilePath();

try {
  logFile = fs.createWriteStream(logFilePath, { flags: 'a' });
  logFile.on('error', (error) => {
    process.stderr.write(`[ERROR] Log file error: ${error.message}\n`);
    isLogFileClosed = true;
  });
} catch (error) {
  process.stderr.write(`[ERROR] Failed to create log file ${logFilePath}: ${error.message}\n`);
  // Create a dummy log file that implements WriteStream interface
  logFile = {
    write: () => true,
    end: (cb) => { if (cb) cb(); },
    destroy: () => {},
    destroyed: false,
    on: () => {},
    emit: () => {},
    once: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    setMaxListeners: () => {},
    getMaxListeners: () => 10
  };
}

log(`Logging to: ${logFilePath}`, "info");

/**
 * Sanitizes log messages by removing sensitive information
 * Removes passwords, tokens, API keys, and authorization headers
 * @param {string|*} message - Message to sanitize
 * @returns {string} - Sanitized message string
 */
function sanitizeLog(message) {
  if (typeof message !== 'string') {
    message = String(message);
  }
  // Remove common sensitive patterns
  return message
    .replace(/(password|token|key|secret|api_key|access_token)=\S+/gi, '$1=***')
    .replace(/(Authorization|Bearer)\s+\S+/gi, '$1 ***')
    .replace(/"(password|token|key|secret|api_key|access_token)"\s*:\s*"[^"]*"/gi, '"$1":"***"');
}

/**
 * Enhanced logging function with level-based filtering and error handling
 * Supports different log levels: dev, serve, info, warn, error
 * Always writes to file, conditionally outputs to stderr based on level
 * @param {string} message - Message to log
 * @param {string} [level="info"] - Log level (dev, serve, info, warn, error, fatal)
 */
function log(message, level = "info") {
  const timestamp = new Date().toISOString();
  const sanitizedMessage = sanitizeLog(message);

  // Determine if we should output this message based on log level
  const shouldOutput =
    logLevel === "dev" || // dev outputs everything
    (logLevel === "serve" && (level === "error" || level === "fatal")); // serve only outputs errors and fatals

  if (shouldOutput) {
    try {
      process.stderr.write(`[${timestamp}] [Qwen ACP Wrapper] [${level.toUpperCase()}] ${sanitizedMessage}\n`);
    } catch (error) {
      // Fallback to console if stderr fails
      console.error(`[${timestamp}] [Qwen ACP Wrapper] [${level.toUpperCase()}] ${sanitizedMessage}`);
    }
  }

  // Always write to log file (if not closed)
  if (!isLogFileClosed && logFile && !logFile.destroyed) {
    try {
      logFile.write(`[${timestamp}] [${level.toUpperCase()}] ${sanitizedMessage}\n`);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }
}

log(`Starting with args: ${JSON.stringify(qwenArgs)}`, "info");

// Check if qwen path was found
if (!qwenPath) {
  log("ERROR: Qwen binary not found in PATH", "fatal");
  process.exit(1);
}

log(`Using qwen binary at: ${qwenPath}`, "info");

// Validate qwen path is safe
if (!isSafePath(qwenPath)) {
  log(`ERROR: Unsafe qwen path detected: ${qwenPath}`, "fatal");
  cleanup();
  process.exit(1);
}

// Check if qwen exists
if (!fs.existsSync(qwenPath)) {
  log(`ERROR: Qwen binary not found at ${qwenPath}`, "fatal");
  cleanup();
  process.exit(1);
}

// Spawn qwen with ACP mode
const finalQwenArgs = ["--experimental-acp"].concat(qwenArgs);
log(`Spawning qwen with args: ${JSON.stringify(finalQwenArgs)}`, "info");

/**
 * Performs health check on child process
 * Verifies the process is still alive and responsive
 * Exits the wrapper if the child process has died
 */
function performHealthCheck() {
  if (isShuttingDown || !child || child.killed) {
    log('Health check: Child process is terminated', 'error');
    cleanup();
    process.exit(1);
  }

  try {
    // Check if we can send signal (process is alive)
    process.kill(child.pid, 0);
  } catch (error) {
    log(`Health check failed: Child process appears dead (PID: ${child.pid})`, 'error');
    cleanup();
    process.exit(1);
  }
}

/**
 * Cleans up all resources and terminates child process gracefully
 * Stops health checks, closes log file, terminates child process
 * Sets isShuttingDown flag to prevent multiple cleanup calls
 */
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('Cleaning up resources...', 'info');

  // Stop health checks
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Close log file
  if (logFile && !logFile.destroyed && logFile !== console) {
    try {
      logFile.end();
      isLogFileClosed = true;
    } catch (error) {
      console.error(`Error closing log file: ${error.message}`);
    }
  }

  // Kill child process if still alive
  if (child && !child.killed) {
    try {
      child.kill('SIGTERM');
      // Give it grace period to terminate
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, SHUTDOWN_TIMEOUT);
    } catch (error) {
      console.error(`Error killing child process: ${error.message}`);
    }
  }
}

try {
  child = spawn(qwenPath, finalQwenArgs, {
    stdio: ["pipe", "pipe", "pipe"], // Use pipe mode for better I/O control
    timeout: PROCESS_TIMEOUT,
  });
} catch (error) {
  log(`Failed to spawn qwen process: ${error.message}`, 'fatal');
  cleanup();
  process.exit(1);
}

log("Spawned qwen ACP process", "info");

// Start health monitoring
healthCheckInterval = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);

// Create a transform stream to log stdin while passing it through (with size limits)
const stdinLogger = new Transform({
  transform(chunk, encoding, callback) {
    try {
      // Limit stdin logging to first MAX_STDIN_LOG_SIZE bytes to prevent log flooding
      const logChunk = chunk.length > MAX_STDIN_LOG_SIZE ?
        chunk.slice(0, MAX_STDIN_LOG_SIZE).toString() + '...[truncated]' :
        chunk.toString();

      if (!isLogFileClosed && logFile && !logFile.destroyed) {
        logFile.write(`[STDIN] ${sanitizeLog(logChunk)}\n`);
      }
      this.push(chunk); // Pass the original data to the child process
      callback();
    } catch (error) {
      log(`Error in stdin logger: ${error.message}`, "error");
      this.push(chunk); // Still pass the data even if logging fails
      callback();
    }
  },
});

// Pipe stdin through the logger to the child process
process.stdin.pipe(stdinLogger).pipe(child.stdin);

// Pipe child's stdout to parent's stdout
child.stdout.pipe(process.stdout);

// Handle stderr from child process
child.stderr.on("data", (data) => {
  try {
    const message = data.toString();
    process.stderr.write(data);

    if (!isLogFileClosed && logFile && !logFile.destroyed) {
      logFile.write(`[STDERR] ${sanitizeLog(message)}\n`);
    }
  } catch (error) {
    console.error(`Error handling stderr: ${error.message}`);
    // Still output the stderr data even if logging fails
    process.stderr.write(data);
  }
});

// Handle child process exit
child.on("exit", (code, signal) => {
  log(`Child process exited with code: ${code}, signal: ${signal}`, "info");
  cleanup();
  if (code !== null) {
    process.exit(code);
  } else {
    // If killed by a signal, exit with a non-zero status code
    process.exit(1);
  }
});

// Handle child process errors
child.on("error", (error) => {
  log(`Child process error: ${error.message}`, "error");
  cleanup();
  process.exit(1);
});

// Enhanced stdin handling with error recovery
// Note: For ACP protocol, we should NOT end child.stdin when parent stdin ends
// as Zed will continue sending JSON-RPC requests to the ACP server
process.stdin.on("end", () => {
  log("STDIN ended by parent - ACP server continuing to run", "info");
  // Keep the child process running for ACP protocol
});

process.stdin.on("error", (error) => {
  log(`STDIN error: ${error.message}`, "error");
  if (child && !child.killed) {
    child.stdin.end();
  }
});

// Enhanced signal handling with cleanup
process.on("SIGTERM", () => {
  if (isShuttingDown) return;
  log("Received SIGTERM, initiating graceful shutdown", "info");
  cleanup();
});

process.on("SIGINT", () => {
  if (isShuttingDown) return;
  log("Received SIGINT, initiating graceful shutdown", "info");
  cleanup();
});

process.on("uncaughtException", (error) => {
  log(`Uncaught exception: ${error.message}`, "fatal");
  if (error.stack) {
    log(error.stack, "fatal");
  }
  cleanup();
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`, "error");
  cleanup();
  process.exit(1);
});

// Handle child stdout end
child.stdout.on("end", () => {
  log("Child stdout ended", "info");
});

// Handle child stdout error
child.stdout.on("error", (error) => {
  log(`Child stdout error: ${error.message}`, "error");
});
