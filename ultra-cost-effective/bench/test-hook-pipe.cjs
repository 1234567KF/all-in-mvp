// test-hook-pipe.cjs — 模拟 Hook → perf-tracker 完整管道
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const PERF_TRACKER = path.join(__dirname, '..', 'helpers', 'perf', 'perf-tracker.cjs');

// 场景 1: 压缩后的 npm test 输出
const event1 = {
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'npm test -- --coverage | node tokenforge.cjs compress output --level aggressive' },
  tool_response: 'x'.repeat(2000),  // 压缩后的 2000 字符输出
  exit_code: 0
};

// 场景 2: 未压缩的普通命令
const event2 = {
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'ls -la' },
  tool_response: Array(20).fill('drwxr-xr-x  user group  4096 Jun 13 10:00  some-directory-name').join('\n'),
  exit_code: 0
};

// 场景 3: 失败的构建
const event3 = {
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'cargo build | node tokenforge.cjs compress output --level medium' },
  tool_response: 'error[E0425]: cannot find value `foo`\n  --> src/main.rs:10:5\n   |\n10 |     foo;\n   |     ^^^ not found',
  exit_code: 1
};

// 场景 4: Qoder 格式
const event4 = {
  event: 'PostToolUse',
  tool: 'Bash',
  input: { command: 'npm test | node tokenforge.cjs compress output --level medium' },
  output: 'PASS\n\nTests: 42 passed\nTime: 3.2s',
  exitCode: 0
};

async function feed(evt) {
  return new Promise((resolve) => {
    const child = spawn('node', [PERF_TRACKER, '--capture'], {
      env: { ...process.env, ULTRA_COST_EFFECTIVE_LEVEL: 'aggressive' },
      stdio: ['pipe', 'inherit', 'inherit']
    });
    child.stdin.write(JSON.stringify(evt));
    child.stdin.end();
    child.on('close', resolve);
  });
}

async function main() {
  process.env.ULTRA_COST_EFFECTIVE_LEVEL = 'aggressive';
  await feed(event1);
  await feed(event2);
  await feed(event3);
  await feed(event4);
  console.log('\n✅ 4 条事件已捕获');
}

main().catch(console.error);
