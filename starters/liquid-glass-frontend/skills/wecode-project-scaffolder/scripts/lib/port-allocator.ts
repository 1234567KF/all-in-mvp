// SSH + 端口分配器（沉淀自实战部署经验）
//
// 权威数据源在测试机 `/home/wecode/port-registry.json`（团队共享，单文件）。
// 单次 SSH 完成整个分配事务，避免 read → compute → write 的竞态：
//   1. ensurePasswordlessLogin() 保证到测试机的免密链路（三段降级链）
//   2. 通过 `bash -s` 把内嵌的 bash 脚本从 stdin 送入远端
//   3. 远端脚本用 `flock` 加互斥锁，再用 `python3` 执行：
//        读 registry → 扫 `ss -tlnH` LISTEN → 挑段内空闲 → 原子写回
//   4. 结果 JSON 从 stdout 回传本地
//
// SSH 免密降级链：
//   A) BatchMode=yes 试当前 key 免密    → 成功即返
//   B) 生成 ~/.ssh/id_ed25519（若无）    → 用 sshpass/expect 密码登录 ssh-copy-id
//   C) 二次 BatchMode=yes 验证成功       → 后续所有操作走 key
//
// 注意：本模块不再维护本地 registry 缓存。远端 SSH 不可达即分配失败（合理，
// 因为部署本身依赖远端）。想手动补/改：`ssh test-server 'vi /home/wecode/port-registry.json'`。

import { execFileSync, spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

import { TEST_SERVER } from "./test-server"

const REMOTE_REGISTRY = "/home/wecode/port-registry.json"
const REMOTE_LOCK = "/home/wecode/port-registry.json.lock"

export interface AllocationEntry {
  project: string
  port: number
  allocatedAt: string
  source: "manual" | "skill"
}

// ─── SSH connectivity ────────────────────────────────────────────────────────

function sshBaseArgs(): string[] {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=5",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-p",
    String(TEST_SERVER.port),
    `${TEST_SERVER.user}@${TEST_SERVER.host}`,
  ]
}

/** 试当前 key 是否可以免密登录测试机 */
function tryPasswordlessLogin(): boolean {
  const res = spawnSync("ssh", [...sshBaseArgs(), "true"], {
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf-8",
  })
  return res.status === 0
}

function hasCommand(cmd: string): boolean {
  const res = spawnSync("command", ["-v", cmd], { shell: true, stdio: "ignore" })
  return res.status === 0
}

function ensureLocalKey(): string {
  const keyPath = path.join(os.homedir(), ".ssh", "id_ed25519")
  const pubPath = keyPath + ".pub"
  if (fs.existsSync(pubPath)) return pubPath
  console.log("🔑 未检测到 ~/.ssh/id_ed25519.pub，生成新的 ed25519 key（无密码短语）...")
  fs.mkdirSync(path.dirname(keyPath), { recursive: true })
  execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-f", keyPath, "-q"], {
    stdio: "inherit",
  })
  return pubPath
}

function copyPubKeyViaSshpass(): boolean {
  if (!hasCommand("sshpass")) return false
  const res = spawnSync(
    "sshpass",
    [
      "-p",
      TEST_SERVER.password,
      "ssh-copy-id",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-p",
      String(TEST_SERVER.port),
      `${TEST_SERVER.user}@${TEST_SERVER.host}`,
    ],
    { stdio: "inherit" }
  )
  return res.status === 0
}

function copyPubKeyViaExpect(): boolean {
  if (!hasCommand("expect")) return false
  const script = `
set timeout 30
spawn ssh-copy-id -o StrictHostKeyChecking=accept-new -p ${TEST_SERVER.port} ${TEST_SERVER.user}@${TEST_SERVER.host}
expect {
  -re "(password|Password):" { send "${TEST_SERVER.password}\\r"; exp_continue }
  -re "already exist" { exit 0 }
  eof
}
`
  const res = spawnSync("expect", ["-c", script], { stdio: "inherit" })
  return res.status === 0
}

/** 保证到测试机的免密链路，走三段降级链 */
export function ensurePasswordlessLogin(): void {
  if (tryPasswordlessLogin()) return

  console.log(
    `🔐 首次连接测试机 ${TEST_SERVER.user}@${TEST_SERVER.host}:${TEST_SERVER.port}，正在配置 ssh 免密...`
  )
  ensureLocalKey()

  let ok = copyPubKeyViaSshpass()
  if (!ok) ok = copyPubKeyViaExpect()

  if (!ok) {
    console.error(
      "\n❌ 未找到 `sshpass` 或 `expect`，无法自动配置 ssh 免密。请任选其一安装：\n" +
        "   macOS:  brew install hudochenkov/sshpass/sshpass\n" +
        "           # 或 expect 通常已内置\n" +
        "   Linux:  apt install sshpass  # 或 yum install sshpass\n" +
        "\n" +
        "或手动运行一次并输入密码 `wecode` 完成 ssh-copy-id：\n" +
        `   ssh-copy-id -p ${TEST_SERVER.port} ${TEST_SERVER.user}@${TEST_SERVER.host}\n`
    )
    throw new Error("SSH 免密配置失败：缺少 sshpass/expect")
  }

  if (!tryPasswordlessLogin()) {
    throw new Error("ssh-copy-id 已执行但免密验证仍失败，请手动排查 ~/.ssh 权限")
  }
  console.log("✓ SSH 免密已就绪")
}

// ─── Remote allocation script ────────────────────────────────────────────────
// 通过 `ssh bash -s -- <args>` 把整个脚本从 stdin 送到远端一次性执行。
// bash 层负责 flock 互斥，python 层负责 JSON 解析 + LISTEN 扫描 + 原子写回。
// 参数顺序（bash "$@" → python sys.argv[1:]）：
//   $1 project      项目名
//   $2 manualPort   手动指定端口或字面量 "AUTO"
//   $3 source       "manual" | "skill"
//   $4 overwrite    "1" | "0"
//   $5 rangeStart   起始端口（含）
//   $6 rangeEnd     终止端口（含）
// 输出：单行 JSON（stdout），成功时 {"port": N, "reused": bool}；失败时 {"error": ...} 写 stderr + 非零 exit。

const REMOTE_PY = `
import sys, json, os, subprocess, datetime, re
proj, mport, source, ovw, rs, re_end = sys.argv[1:7]
rs, re_end = int(rs), int(re_end)
mport = None if mport == 'AUTO' else int(mport)
REG = '/home/wecode/port-registry.json'
if os.path.exists(REG):
    with open(REG) as f:
        reg = json.load(f)
else:
    reg = {'host': '192.168.110.214', 'allocations': []}
if 'allocations' not in reg or not isinstance(reg['allocations'], list):
    reg['allocations'] = []
existing = next((a for a in reg['allocations'] if a.get('project') == proj), None)
if existing and ovw != '1' and mport is None:
    print(json.dumps({'port': existing['port'], 'reused': True}))
    sys.exit(0)
if mport is not None:
    conflict = next((a for a in reg['allocations'] if a.get('port') == mport and a.get('project') != proj), None)
    if conflict:
        sys.stderr.write(json.dumps({'error': '端口 %d 已被项目 %s 占用（remote registry）' % (mport, conflict['project'])}) + '\\n')
        sys.exit(2)
    port = mport
else:
    out = subprocess.check_output(['ss', '-tlnH'], universal_newlines=True)
    listen = set()
    for line in out.splitlines():
        for m in re.finditer(r'[:.](\\d+)\\b', line):
            p = int(m.group(1))
            if 0 < p < 65536:
                listen.add(p)
    used = {a['port'] for a in reg['allocations'] if a.get('project') != proj}
    port = None
    for p in range(rs, re_end + 1):
        if p not in listen and p not in used:
            port = p
            break
    if port is None:
        sys.stderr.write(json.dumps({'error': '端口段 %d-%d 已全部占用' % (rs, re_end)}) + '\\n')
        sys.exit(3)
entry = {
    'project': proj,
    'port': port,
    'allocatedAt': datetime.date.today().isoformat(),
    'source': source,
}
idx = next((i for i, a in enumerate(reg['allocations']) if a.get('project') == proj), -1)
if idx >= 0:
    reg['allocations'][idx] = entry
else:
    reg['allocations'].append(entry)
tmp = REG + '.tmp'
with open(tmp, 'w') as f:
    json.dump(reg, f, indent=2, ensure_ascii=False)
    f.write('\\n')
os.replace(tmp, REG)
os.chmod(REG, 0o644)
print(json.dumps({'port': port, 'reused': False}))
`

// bash 层：flock 独占 → 传参给 python heredoc
// - `touch` 保证 lock 文件存在（首次运行）
// - `exec 9> lock` + `flock -x 9`：整段脚本退出前锁不会释放
const REMOTE_BASH = `set -e
touch ${REMOTE_LOCK}
exec 9> ${REMOTE_LOCK}
flock -x 9
python3 - "$@" <<'PYEOF'
${REMOTE_PY}
PYEOF
`

// ─── Allocation ──────────────────────────────────────────────────────────────

export interface AllocateOptions {
  /** 手动指定端口，跳过远端 ss 探测，仅走 registry 冲突检查 */
  manualPort?: number
  /** 分配来源标记，默认 skill */
  source?: "manual" | "skill"
  /** 若 true，即使 registry 已有同名 project 也覆盖（默认 false，直接复用旧值） */
  overwrite?: boolean
}

export interface AllocateResult {
  port: number
  reused: boolean
  /** 便于日志展示的 remote registry 位置标识 */
  registryPath: string
}

/**
 * 为 project 分配一个测试端口（原子事务，走 SSH + 远端 flock）。
 * - 若 registry 已有同名条目且未 overwrite / 未 manualPort → 复用（reused=true）
 * - 否则远端扫 LISTEN 端口，从段内找空闲，写入 registry
 */
export function allocatePort(project: string, opts: AllocateOptions = {}): AllocateResult {
  if (!project || !/^[A-Za-z0-9._-]+$/.test(project)) {
    throw new Error(`非法项目名: ${project}（只允许 A-Z a-z 0-9 . _ -）`)
  }
  ensurePasswordlessLogin()

  const args = [
    project,
    opts.manualPort != null ? String(opts.manualPort) : "AUTO",
    opts.source ?? "skill",
    opts.overwrite ? "1" : "0",
    String(TEST_SERVER.portRangeStart),
    String(TEST_SERVER.portRangeEnd),
  ]

  const res = spawnSync("ssh", [...sshBaseArgs(), "bash", "-s", "--", ...args], {
    input: REMOTE_BASH,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })

  if (res.status !== 0) {
    const stderr = (res.stderr || "").trim()
    // 尝试解析结构化错误
    const jsonMatch = stderr.match(/\{[^{}]*"error"[^{}]*\}/)
    if (jsonMatch) {
      try {
        const err = JSON.parse(jsonMatch[0]) as { error: string }
        throw new Error(err.error)
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected token") throw e
      }
    }
    throw new Error(`远端分配失败 (exit ${res.status ?? "?"}): ${stderr || "no stderr"}`)
  }

  const stdout = (res.stdout || "").trim()
  const lines = stdout.split("\n").filter(Boolean)
  const jsonLine = lines[lines.length - 1] || ""
  let parsed: { port: number; reused: boolean }
  try {
    parsed = JSON.parse(jsonLine)
  } catch {
    throw new Error(`无法解析远端输出: ${stdout}`)
  }

  return {
    port: parsed.port,
    reused: parsed.reused,
    registryPath: `${TEST_SERVER.user}@${TEST_SERVER.host}:${REMOTE_REGISTRY}`,
  }
}

// ─── CLI 入口（便于手工调试与初始化）────────────────────────────────────────
// 用法：
//   bun run scripts/lib/port-allocator.ts probe            # 自动分配
//   bun run scripts/lib/port-allocator.ts probe --port 11099
//   bun run scripts/lib/port-allocator.ts demo-app --port 11080 --source manual --overwrite
if (import.meta.main) {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    console.error(
      "Usage: port-allocator.ts <project> [--port N] [--source manual|skill] [--overwrite]"
    )
    process.exit(1)
  }
  const project = argv[0]
  const portFlag = argv.indexOf("--port")
  const sourceFlag = argv.indexOf("--source")
  const overwrite = argv.includes("--overwrite")
  const opts: AllocateOptions = { overwrite }
  if (portFlag >= 0) opts.manualPort = parseInt(argv[portFlag + 1], 10)
  if (sourceFlag >= 0) opts.source = argv[sourceFlag + 1] as "manual" | "skill"
  const result = allocatePort(project, opts)
  console.log(
    `✓ ${project} → ${result.port}${result.reused ? " (reused)" : ""} (registry: ${result.registryPath})`
  )
}
