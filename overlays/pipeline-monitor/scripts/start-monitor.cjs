#!/usr/bin/env node
// Pipeline Monitor Daemon Launcher
// 检查/启动 pipeline-monitor，输出端口号到 stdout

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const DEFAULT_PORT = 3000;
const LOCK_DIR = path.join(os.homedir(), ".qoder", "pipeline-monitor");
const LOCK_FILE = path.join(LOCK_DIR, "port.json");
const MONITOR_DIR = path.resolve(__dirname, "..");

async function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.service === "pipeline-monitor" && json.status === "ok");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function saveLock(port, pid) {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ port, pid, started: new Date().toISOString() }));
}

async function waitForHealth(port, maxAttempts) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkHealth(port)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  // 1) 检查默认端口
  if (await checkHealth(DEFAULT_PORT)) {
    console.log(String(DEFAULT_PORT));
    return;
  }

  // 2) 尝试读取锁文件
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
    if (await checkHealth(lock.port)) {
      console.log(String(lock.port));
      return;
    }
  } catch {}

  // 3) 启动服务器
  const serverProcess = spawn("npx.cmd tsx src/server.ts", [], {
    cwd: MONITOR_DIR,
    env: { ...process.env, PORT: String(DEFAULT_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    windowsHide: true,
    shell: true,
  });
  serverProcess.unref();

  // 收集 stdout 帮助调试
  serverProcess.stdout.on("data", () => {});
  serverProcess.stderr.on("data", () => {});

  // 4) 等待健康检查通过
  const started = await waitForHealth(DEFAULT_PORT, 15);
  if (!started) {
    console.error("start-monitor: server failed to respond within 22s");
    process.exit(1);
  }

  saveLock(DEFAULT_PORT, serverProcess.pid);
  console.log(String(DEFAULT_PORT));
}

main().catch((e) => {
  console.error("start-monitor:", e.message);
  process.exit(1);
});
