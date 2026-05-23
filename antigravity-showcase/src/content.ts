import { stages, roles, principles, qualityGates, metrics, stats } from './data';

export function renderAll(): void {
  renderHero();
  renderStats();
  renderStages();
  renderRoles();
  renderPrinciples();
  renderQuality();
  renderFooter();
}

function renderHero(): void {
  const hero = document.getElementById('hero');
  if (!hero) return;

  hero.innerHTML = `
    <div class="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div class="mb-6">
        <span class="inline-block px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase bg-ag-blue/10 text-ag-blue border border-ag-blue/20">
          v2.3 最终融合版
        </span>
      </div>
      <h1 class="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-6">
        <span class="bg-gradient-to-r from-ag-blue via-ag-purple to-ag-cyan bg-clip-text text-transparent">
          all-in-mvp
        </span>
      </h1>
      <p class="text-xl md:text-2xl text-gray-400 max-w-2xl mb-4">
        多 Agent 并行开发流水线
      </p>
      <p class="text-sm md:text-base text-gray-500 max-w-xl mb-12">
        从需求对齐到交付的完整多 Agent 并行工程流程。4 个阶段、严格门禁、最大并行度。
      </p>
      <div class="flex gap-4">
        <a href="#stages" class="px-8 py-3 rounded-full bg-gradient-to-r from-ag-blue to-ag-purple text-white font-medium hover:opacity-90 transition-opacity">
          探索流程
        </a>
        <a href="https://github.com" target="_blank" class="px-8 py-3 rounded-full border border-gray-700 text-gray-300 font-medium hover:border-gray-500 transition-colors">
          GitHub
        </a>
      </div>
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
        <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </div>
    </div>
  `;
}

function renderStats(): void {
  const container = document.getElementById('stats');
  if (!container) return;

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
      ${stats.map(stat => `
        <div class="text-center p-6 rounded-2xl bg-ag-card/50 border border-ag-border/50 backdrop-blur-sm">
          <div class="text-3xl md:text-4xl font-bold text-white mb-2">${stat.value}</div>
          <div class="text-sm text-gray-400">${stat.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStages(): void {
  const container = document.getElementById('stages-content');
  if (!container) return;

  container.innerHTML = `
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      ${stages.map((stage, index) => `
        <div class="stage-card group relative p-6 rounded-2xl bg-ag-card/60 border border-ag-border/50 backdrop-blur-sm hover:border-${stage.color}/50 transition-all duration-500 hover:scale-105" data-stage="${index}">
          <div class="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style="background: radial-gradient(circle at 50% 0%, ${stage.color}15, transparent 70%)"></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-4">
              <span class="text-3xl">${stage.icon}</span>
              <span class="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-400">${stage.name}</span>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">${stage.title}</h3>
            <p class="text-sm text-gray-400 mb-4 leading-relaxed">${stage.description}</p>
            <div class="space-y-2">
              ${stage.outputs.map(output => `
                <div class="flex items-center gap-2 text-xs text-gray-500">
                  <div class="w-1 h-1 rounded-full" style="background-color: ${stage.color}"></div>
                  <code class="font-mono">${output}</code>
                </div>
              `).join('')}
            </div>
          </div>
          ${index < stages.length - 1 ? `
            <div class="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
              <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderRoles(): void {
  const container = document.getElementById('roles-content');
  if (!container) return;

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      ${roles.map(role => `
        <div class="role-card group p-4 rounded-xl bg-ag-card/40 border border-ag-border/30 hover:border-${role.color}/40 transition-all duration-300 hover:scale-105 cursor-default">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-2 h-2 rounded-full" style="background-color: ${role.color}"></div>
            <span class="text-xs font-mono text-gray-500">${role.stage}</span>
          </div>
          <h4 class="text-sm font-semibold text-white mb-1">${role.name}</h4>
          <p class="text-xs text-gray-500 mb-2">${role.output}</p>
          <span class="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
            ${role.parallel}
          </span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPrinciples(): void {
  const container = document.getElementById('principles-content');
  if (!container) return;

  container.innerHTML = `
    <div class="grid md:grid-cols-2 gap-8">
      ${principles.map((principle, idx) => `
        <div class="principle-card p-6 rounded-2xl bg-ag-card/40 border border-ag-border/30">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style="background-color: ${principle.type === 'serial' ? '#4f46e520' : '#06b6d420'}; color: ${principle.type === 'serial' ? '#4f46e5' : '#06b6d4'}">
              ${principle.type === 'serial' ? '⟳' : '⇅'}
            </div>
            <h3 class="text-lg font-bold text-white">${principle.title}</h3>
          </div>
          <ul class="space-y-3">
            ${principle.items.map(item => `
              <li class="flex items-start gap-3 text-sm text-gray-400">
                <div class="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style="background-color: ${principle.type === 'serial' ? '#4f46e5' : '#06b6d4'}"></div>
                <span>${item}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

function renderQuality(): void {
  const container = document.getElementById('quality-content');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-8">
      <!-- Quality Gates -->
      <div class="grid md:grid-cols-2 gap-6">
        ${qualityGates.map(gate => `
          <div class="quality-gate p-5 rounded-xl bg-ag-card/40 border border-ag-border/30">
            <h4 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-ag-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              ${gate.stage}
            </h4>
            <ul class="space-y-2">
              ${gate.items.map(item => `
                <li class="flex items-center gap-2 text-xs text-gray-400">
                  <div class="w-1 h-1 rounded-full bg-ag-cyan"></div>
                  ${item}
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>

      <!-- Metrics -->
      <div class="p-6 rounded-2xl bg-ag-card/40 border border-ag-border/30">
        <h3 class="text-lg font-bold text-white mb-6">核心质量指标</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          ${metrics.map(metric => `
            <div class="metric-item text-center">
              <div class="relative w-20 h-20 mx-auto mb-3">
                <svg class="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#1e1e2e" stroke-width="6"></circle>
                  <circle cx="40" cy="40" r="36" fill="none" stroke="url(#gradient-${metric.name.replace(/\s/g, '')})" stroke-width="6"
                    stroke-dasharray="${metric.value * 2.26} 226"
                    stroke-linecap="round"
                    class="metric-circle transition-all duration-1000"
                    style="stroke-dashoffset: 226"
                    data-target="${metric.value * 2.26}"
                  ></circle>
                  <defs>
                    <linearGradient id="gradient-${metric.name.replace(/\s/g, '')}" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style="stop-color:#4f46e5"></stop>
                      <stop offset="100%" style="stop-color:#7c3aed"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-lg font-bold text-white">${metric.value}%</span>
                </div>
              </div>
              <div class="text-sm text-gray-400">${metric.name}</div>
              <div class="text-xs text-gray-600 mt-1">目标: ${metric.target}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderFooter(): void {
  const footer = document.getElementById('footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-12">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xl font-bold bg-gradient-to-r from-ag-blue to-ag-purple bg-clip-text text-transparent">all-in-mvp</span>
          <span class="text-xs text-gray-600">v2.3.0</span>
        </div>
        <div class="flex items-center gap-6 text-sm text-gray-500">
          <a href="#" class="hover:text-white transition-colors">白皮书</a>
          <a href="#" class="hover:text-white transition-colors">文档</a>
          <a href="#" class="hover:text-white transition-colors">GitHub</a>
        </div>
        <div class="text-xs text-gray-700">
          基于 MVP白皮书最终融合版.md 构建
        </div>
      </div>
    </div>
  `;
}
