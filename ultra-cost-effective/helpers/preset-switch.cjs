#!/usr/bin/env node
/**
 * preset-switch.cjs — UltraCostEffective 预设切换器
 *
 * 在 quick / standard / extreme 三个预设间切换，
 * 更新 ULTRA_COST_EFFECTIVE_LEVEL 和 ULTRA_COST_EFFECTIVE_PRESET 环境变量。
 *
 * 用法:
 *   node preset-switch.cjs [quick|standard|extreme]     # 切换到指定预设
 *   node preset-switch.cjs                               # 循环切换
 *   node preset-switch.cjs status                        # 查看当前预设
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PRESETS = ['quick', 'standard', 'extreme'];
const PRESET_NAMES = {
  quick:    { label: 'Quick (快速)',   layers: 'L1',          savings: '50-70%', level: 'light' },
  standard: { label: 'Standard (标准)', layers: 'L1+L2+L3',   savings: '70-85%', level: 'medium' },
  extreme:  { label: 'Extreme (极致)',  layers: '全七层',      savings: '85-95%', level: 'aggressive' }
};

// 检测预设文件是否存在并匹配当前配置
function detectCurrentPreset() {
  // 1. 环境变量优先
  const envPreset = process.env.ULTRA_COST_EFFECTIVE_PRESET;
  if (envPreset && PRESETS.includes(envPreset)) return envPreset;

  const envLevel = process.env.ULTRA_COST_EFFECTIVE_LEVEL;
  if (envLevel) {
    for (const [name, info] of Object.entries(PRESET_NAMES)) {
      if (info.level === envLevel) return name;
    }
  }

  return 'standard';
}

function switchPreset(target) {
  const current = detectCurrentPreset();
  let next = target;

  if (!next || !PRESETS.includes(next)) {
    // 循环切换
    const idx = PRESETS.indexOf(current);
    next = PRESETS[(idx + 1) % PRESETS.length];
  }

  const info = PRESET_NAMES[next];

  return {
    from: current,
    to: next,
    info,
    env: {
      ULTRA_COST_EFFECTIVE_PRESET: next,
      ULTRA_COST_EFFECTIVE_LEVEL: info.level
    }
  };
}

function showStatus() {
  const current = detectCurrentPreset();
  const info = PRESET_NAMES[current];

  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective 预设状态');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log(`  当前预设: ${info.label}`);
  console.log(`  启用层级: ${info.layers}`);
  console.log(`  预计节省: ${info.savings}`);
  console.log(`  压缩级别: ${info.level}`);
  console.log(`  环境变量:`);
  console.log(`    ULTRA_COST_EFFECTIVE_PRESET=${process.env.ULTRA_COST_EFFECTIVE_PRESET || '(未设置)'}`);
  console.log(`    ULTRA_COST_EFFECTIVE_LEVEL=${process.env.ULTRA_COST_EFFECTIVE_LEVEL || '(未设置)'}`);
  console.log(`    ULTRA_COST_EFFECTIVE_OFF=${process.env.ULTRA_COST_EFFECTIVE_OFF || '(未设置)'}`);
  console.log('');
  console.log('  切换: node preset-switch.cjs [quick|standard|extreme]');
  console.log('═══════════════════════════════════');
}

function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (target === 'status' || target === '-s' || target === '--status') {
    showStatus();
    return;
  }

  const result = switchPreset(target);

  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective 预设切换');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log(`  ${result.from} → ${result.to}`);
  console.log(`  ${result.info.label}`);
  console.log(`  层级: ${result.info.layers}`);
  console.log(`  节省: ${result.info.savings}`);
  console.log(`  级别: ${result.info.level}`);
  console.log('');
  console.log('  请设置以下环境变量后重启平台:');
  console.log(`    export ULTRA_COST_EFFECTIVE_PRESET=${result.env.ULTRA_COST_EFFECTIVE_PRESET}`);
  console.log(`    export ULTRA_COST_EFFECTIVE_LEVEL=${result.env.ULTRA_COST_EFFECTIVE_LEVEL}`);
  console.log('');
  console.log('  或在 .claude/settings.json 的 env 块中设置。');
  console.log('═══════════════════════════════════');
}

if (require.main === module) {
  main();
}

module.exports = { switchPreset, detectCurrentPreset, PRESETS, PRESET_NAMES };
