#!/usr/bin/env node
// PostToolUse Hook 脚本 - 自动捕获工具调用
// 被 Qoder PostToolUse hook 调用，从 transcript/env 提取工具调用信息并写入事件
// 失败时静默退出，不阻塞 Agent 工作

const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const LOCK_DIR = path.join(os.homedir(), ".qoder", "pipeline-monitor");

// 解析工具来源: 尝试多个环境变量
function getToolSource() {
  // Qoder/Claude Code 可能的 env var 命名
  const transcriptPath =
    process.env.TRANSCRIPT_PATH ||
    process.env.QODER_TRANSCRIPT_PATH ||
    process.env.CLAUDE_TRANSCRIPT_PATH ||
    "";
  const toolInput =
    process.env.TOOL_INPUT || process.env.QODER_TOOL_INPUT || "";
  const toolName =
    process.env.TOOL_NAME || process.env.QODER_TOOL_NAME || "";
  return { transcriptPath, toolInput, toolName };
}

// 从 transcript JSONL 末尾解析最近一次工具调用
function parseTranscript(transcriptPath) {
  try {
    const content = fs.readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    // 读最后 3 行（找最近的工具调用）
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
      try {
        const msg = JSON.parse(lines[i]);
        const content = msg.message?.content || [];
        for (const block of content) {
          if (block.type === "tool_use" || block.type === "tool_result") {
            return {
              toolName: block.name || block.tool_use?.name || "",
              toolInput: block.input || block.tool_use?.input || {},
              source: "transcript",
            };
          }
        }
        // 检查 source > content (Qoder 格式)
        if (msg.source?.type === "tool" && msg.source?.id) {
          const toolId = msg.source.id;
          const toolMsg = msg.message?.content?.[0];
          if (toolMsg?.type === "tool_result") {
            return {
              toolName: toolMsg.tool_use_id || toolId,
              toolInput: toolMsg.content || {},
              source: "transcript",
            };
          }
        }
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}

// 从 run_in_terminal 命令中提取关键信息
function extractRunCommand(input) {
  if (!input) return "";
  const cmd =
    (typeof input === "string" ? input : input.command || "") || "";
  // 截取前 120 字符，不要泄露参数
  return cmd.length > 120 ? cmd.slice(0, 120) + "..." : cmd;
}

// 将工具调用映射为 EventType
function classifyTool(name, input) {
  const nameLower = (name || "").toLowerCase();
  const inputStr =
    typeof input === "string"
      ? input
      : JSON.stringify(input || {}).toLowerCase();

  // FILE_CHANGE 类操作
  if (
    nameLower.includes("write") ||
    nameLower.includes("edit") ||
    nameLower.includes("create_file") ||
    nameLower.includes("search_replace")
  ) {
    const filePath = input?.file_path || input?.filePath || "";
    return {
      eventType: "FILE_CHANGE",
      message: filePath ? `文件修改: ${filePath}` : `工具: ${name}`,
      metadata: { toolName: name, filePath },
    };
  }

  // ERROR
  if (nameLower.includes("error") || inputStr.includes("error")) {
    return {
      eventType: "ERROR",
      message: `工具错误: ${name}`,
      metadata: { toolName: name },
    };
  }

  // TOOL_CALL (默认)
  return {
    eventType: "TOOL_CALL",
    message:
      nameLower === "run_in_terminal"
        ? `命令: ${extractRunCommand(input)}`
        : `工具: ${name}`,
    metadata: { toolName: name },
  };
}

function postEvent(port, pipelineId, event) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ pipelineId, ...event, agentName: "main" });
    const options = {
      hostname: "localhost",
      port,
      path: "/api/events",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = http.request(options, () => resolve(true));
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

async function main() {
  // 1) 读取 session 缓存
  // 使用 cwd 推断 workspace（hook 在 workspace 根目录执行）
  const cwd = process.cwd();
  const workspaceHash = crypto.createHash("md5").update(cwd.toLowerCase()).digest("hex").slice(0, 8);
  const sessionFile = path.join(LOCK_DIR, `session-${workspaceHash}.json`);

  let session;
  try {
    session = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
  } catch {
    // 无活跃 session，跳过
    return;
  }

  // 2) 获取工具调用信息
  const { transcriptPath, toolInput, toolName } = getToolSource();

  let toolInfo;
  if (toolName) {
    // 直接从 env 获取
    let input = {};
    try {
      input = toolInput ? JSON.parse(toolInput) : {};
    } catch {
      input = toolInput || {};
    }
    toolInfo = { toolName, toolInput: input, source: "env" };
  } else if (transcriptPath) {
    // 从 transcript 解析
    toolInfo = parseTranscript(transcriptPath);
  }

  if (!toolInfo) {
    return; // 无可用信息，跳过
  }

  // 3) 分类并发送事件
  const event = classifyTool(toolInfo.toolName, toolInfo.toolInput);
  await postEvent(session.port, session.pipelineId, event);
}

main().catch(() => {
  // 静默失败 - 不阻塞 Agent
});
