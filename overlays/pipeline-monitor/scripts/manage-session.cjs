#!/usr/bin/env node
// Session 管理脚本
// 每次 all-in-mvp 触发时调用，创建独立 Pipeline 并缓存
// Usage: node manage-session.cjs <workspacePath> <taskName> [mode]
// Output: JSON { pipelineId, sessionName, port }

const http = require("http");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const LOCK_DIR = path.join(os.homedir(), ".qoder", "pipeline-monitor");
const SCRIPT_DIR = __dirname;

// Hash workspace path to short filename
function workspaceHash(p) {
  return crypto.createHash("md5").update(p.toLowerCase()).digest("hex").slice(0, 8);
}

async function postJSON(port, urlPath, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: "localhost",
      port,
      path: urlPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON response: " + data));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function patchJSON(port, urlPath, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: "localhost",
      port,
      path: urlPath,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const workspacePath = args[0] || process.cwd();
  const taskName = args[1] || "Unnamed Task";
  const mode = args[2] || "incremental";

  // 生成唯一 session 名: workspaceName@HHmmss
  const workspaceName = path.basename(workspacePath);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const sessionName = `${workspaceName}@${hh}${mm}${ss}`;

  // 获取端口
  const startResult = spawnSync("node", [path.join(SCRIPT_DIR, "start-monitor.cjs")], {
    cwd: path.join(SCRIPT_DIR, ".."),
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (startResult.status !== 0) {
    console.error("manage-session: failed to start monitor:", startResult.stderr.toString());
    process.exit(1);
  }
  const port = parseInt(startResult.stdout.toString().trim(), 10);
  if (!port || isNaN(port)) {
    console.error("manage-session: invalid port from start-monitor:", startResult.stdout.toString());
    process.exit(1);
  }

  // 创建 Pipeline
  const pipeline = await postJSON(port, "/api/pipelines", {
    name: taskName,
    mode,
    taskDesc: taskName,
    sessionName,
  });

  const pipelineId = pipeline.id;
  if (!pipelineId) {
    console.error("manage-session: failed to create pipeline:", JSON.stringify(pipeline));
    process.exit(1);
  }

  // 记录 PIPELINE_START 事件
  await postJSON(port, "/api/events", {
    pipelineId,
    eventType: "PIPELINE_START",
    agentName: "coordinator",
    stage: "",
    message: `Pipeline 启动: ${taskName}`,
    metadata: { mode, sessionName },
  });

  // 缓存 session
  const h = workspaceHash(workspacePath);
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const sessionFile = path.join(LOCK_DIR, `session-${h}.json`);
  fs.writeFileSync(
    sessionFile,
    JSON.stringify({
      pipelineId,
      sessionName,
      port,
      workspacePath,
      created: new Date().toISOString(),
    })
  );

  // 输出 JSON 到 stdout
  const output = JSON.stringify({ pipelineId, sessionName, port });
  console.log(output);
}

main().catch((e) => {
  console.error("manage-session:", e.message);
  process.exit(1);
});
