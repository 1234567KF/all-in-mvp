<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

const API_BASE = "/api";

// State
const pipeline = ref(null);
const events = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const stats = ref(null);
const stageDurations = ref([]);
const agentActivities = ref([]);
const agentTasks = ref([]);
const selectedAgentTasks = ref(null);
const autoRefresh = ref(true);
const loading = ref(false);
let timer = null;

// View mode & pipeline list
const viewMode = ref("list");       // 'list' | 'detail'
const pipelines = ref([]);           // Pipeline list items
const selectedPipelineId = ref(""); // Currently viewed pipeline

// Filters
const filterStage = ref("");
const filterAgent = ref("");
const filterEventType = ref("");
const filterSearch = ref("");
const selectedEvent = ref(null);

// Status display helpers
const statusLabel = (s) => ({ RUNNING: "运行中", DONE: "已完成", FAILED: "失败", CANCELLED: "已取消" })[s] || s;
const statusBadgeStyle = (s) => {
  const colors = { RUNNING: "#3fb950", DONE: "#58a6ff", FAILED: "#f85149", CANCELLED: "#8b949e" };
  const c = colors[s] || "#8b949e";
  return { background: c + "22", color: c, border: "1px solid " + c + "44", padding: "2px 10px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 };
};

// Computed
const statusColor = computed(() => {
  const map = { RUNNING: "#3fb950", DONE: "#58a6ff", FAILED: "#f85149", CANCELLED: "#8b949e" };
  return map[pipeline.value?.status] || "#8b949e";
});

const eventTypeLabel = computed(() => {
  const map = {
    PIPELINE_START: "流水线启动", PIPELINE_END: "流水线结束",
    STAGE_START: "阶段开始", STAGE_END: "阶段结束",
    AGENT_SPAWN: "Agent 启动", AGENT_DONE: "Agent 完成", AGENT_BLOCKED: "Agent 阻塞",
    FILE_CHANGE: "文件变更", TOOL_CALL: "工具调用",
    ERROR: "错误", GATE_CHECK: "门禁检查", GRILL_ROUND: "拷问审查",
    AGENT_TASK_PLAN: "任务规划", AGENT_TASK_RESULT: "任务结果",
  };
  return map;
});

const eventTypeIcon = computed(() => {
  const map = {
    PIPELINE_START: "▶", PIPELINE_END: "⏹",
    STAGE_START: "▷", STAGE_END: "◁",
    AGENT_SPAWN: "🤖", AGENT_DONE: "✅", AGENT_BLOCKED: "🚫",
    FILE_CHANGE: "📄", TOOL_CALL: "🔧",
    ERROR: "❌", GATE_CHECK: "🚦", GRILL_ROUND: "🔄",
    AGENT_TASK_PLAN: "📋", AGENT_TASK_RESULT: "✅",
  };
  return map;
});

// API calls
async function fetchPipelines() {
  try {
    const res = await fetch(`${API_BASE}/pipelines`);
    if (res.ok) pipelines.value = await res.json();
  } catch (e) { /* ignore */ }
}

async function fetchPipeline(id) {
  try {
    const res = await fetch(`${API_BASE}/pipelines/${id || "current"}`);
    if (res.ok) {
      const newPipeline = await res.json();
      // 仅在状态变化时更新 status 颜色指示，避免不必要的重渲染
      if (!pipeline.value || pipeline.value.status !== newPipeline.status || pipeline.value.id !== newPipeline.id) {
        pipeline.value = newPipeline;
      }
    }
  } catch (e) { /* ignore */ }
}

function selectPipeline(id) {
  selectedPipelineId.value = id;
  viewMode.value = "detail";
  resetFilters();
  refreshAll();
}

function goBack() {
  viewMode.value = "list";
  pipeline.value = null;
  events.value = [];
  total.value = 0;
  stats.value = null;
  stageDurations.value = [];
  agentActivities.value = [];
  selectedPipelineId.value = "";
  fetchPipelines();
}

function resetFilters() {
  filterStage.value = "";
  filterAgent.value = "";
  filterEventType.value = "";
  filterSearch.value = "";
  page.value = 1;
}

async function fetchEvents() {
  const pid = selectedPipelineId.value || pipeline.value?.id;
  if (!pid) return;
  try {
    const params = new URLSearchParams({ pipeline_id: pid, page: page.value, pageSize: pageSize.value });
    if (filterStage.value) params.set("stage", filterStage.value);
    if (filterAgent.value) params.set("agent_name", filterAgent.value);
    if (filterEventType.value) params.set("event_type", filterEventType.value);
    if (filterSearch.value) params.set("search", filterSearch.value);
    const res = await fetch(`${API_BASE}/events?${params}`);
    if (res.ok) {
      const data = await res.json();
      // 仅在数据真正变化时才更新，避免时间线闪烁
      if (data.total !== total.value || data.data.length !== events.value.length) {
        events.value = data.data;
        total.value = data.total;
      }
    }
  } catch (e) { /* ignore */ }
}

async function fetchAgentTasks() {
  const pid = selectedPipelineId.value || pipeline.value?.id;
  if (!pid) return;
  try {
    const res = await fetch(`${API_BASE}/stats/agent-tasks?pipeline_id=${pid}`);
    if (res.ok) agentTasks.value = await res.json();
  } catch (e) { /* ignore */ }
}

async function fetchStats() {
  const pid = selectedPipelineId.value || pipeline.value?.id;
  if (!pid) return;
  try {
    const [overview, durations, activities] = await Promise.all([
      fetch(`${API_BASE}/stats/overview?pipeline_id=${pid}`).then(r => r.json()),
      fetch(`${API_BASE}/stats/stage-duration?pipeline_id=${pid}`).then(r => r.json()),
      fetch(`${API_BASE}/stats/agent-activity?pipeline_id=${pid}`).then(r => r.json()),
    ]);
    stats.value = overview;
    stageDurations.value = durations;
    agentActivities.value = activities;
  } catch (e) { /* ignore */ }
}

async function refreshAll(showLoading = true) {
  if (showLoading) loading.value = true;
  await fetchPipeline(selectedPipelineId.value || undefined);
  if (pipeline.value) {
    await Promise.all([fetchEvents(), fetchStats(), fetchAgentTasks()]);
  }
  if (showLoading) loading.value = false;
}

function startAutoRefresh() {
  timer = setInterval(() => {
    if (autoRefresh.value && pipeline.value?.status === "RUNNING") {
      refreshAll(false);
    }
  }, 3000);
}

function onFilterChange() {
  page.value = 1;
  fetchEvents();
}

onMounted(async () => {
  await fetchPipelines();
  // 如果有 pipeline 数据，默认选中第一个
  if (pipelines.value.length > 0) {
    selectPipeline(pipelines.value[0].id);
  }
  startAutoRefresh();
});

onUnmounted(() => clearInterval(timer));

// Helper: get accent color for event row (left border)
function getEventAccent(evt) {
  const m = evt.metadata || {};
  // Stage 转换
  if (evt.eventType === "STAGE_START") return "3px solid #58a6ff";
  if (evt.eventType === "STAGE_END") return "3px solid #3fb950";
  // Pipeline 生命周期
  if (evt.eventType === "PIPELINE_START") return "3px solid #a371f7";
  if (evt.eventType === "PIPELINE_END") return "3px solid #3fb950";
  // Agent 生命周期
  if (evt.eventType === "AGENT_SPAWN") return "3px solid #79c0ff";
  if (evt.eventType === "AGENT_DONE") return "3px solid #3fb950";
  if (evt.eventType === "AGENT_BLOCKED") return "3px solid #f85149";
  // 门禁/审查
  if (evt.eventType === "GATE_CHECK") return m.result === "PASS" ? "3px solid #3fb950" : "3px solid #f85149";
  if (evt.eventType === "GRILL_ROUND") return "3px solid #d29922";
  // 错误
  if (evt.eventType === "ERROR") return "3px solid #f85149";
  // 产物变更
  if (evt.eventType === "FILE_CHANGE") return "3px solid #a5d6ff";
  return "3px solid transparent";
}

// Stage 颜色映射
function stageColor(stage) {
  const map = { Stage1: "#58a6ff", Stage2: "#d29922", Stage3: "#3fb950", Stage4: "#a371f7", Stage5: "#f778ba" };
  return map[stage] || "#8b949e";
}

// Helper: format date
function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN");
}

// Helper: duration
function fmtDuration(ms) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
</script>

<template>
  <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h1 style="font-size: 24px; font-weight: 600;">🔍 Pipeline Monitor</h1>
      <div style="display: flex; align-items: center; gap: 12px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px;">
          <input type="checkbox" v-model="autoRefresh" style="accent-color: #3fb950;" />
          自动刷新 (3s)
        </label>
<button @click="refreshAll" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;">🔄 刷新</button>
      </div>
    </div>

    <!-- Pipeline List View -->
    <div v-if="viewMode === 'list'">
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        <div v-for="p in pipelines" :key="p.id" @click="selectPipeline(p.id)"
             style="background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 18px; cursor: pointer; transition: border-color 0.2s, transform 0.15s;"
             @mouseenter="e => { e.currentTarget.style.borderColor = '#58a6ff'; e.currentTarget.style.transform = 'translateY(-2px)'; }"
             @mouseleave="e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.transform = ''; }">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="font-size: 15px; font-weight: 600; color: #e6edf3;">{{ p.name }}</div>
            <span :style="statusBadgeStyle(p.status)">{{ statusLabel(p.status) }}</span>
          </div>
          <div style="display: flex; gap: 20px; font-size: 12px; color: #8b949e; margin-bottom: 8px;">
            <span>📋 {{ p.eventCount }} 事件</span>
            <span>📌 {{ p.mode }}</span>
            <span v-if="p.sessionName" style="color: #484f58;">🔗 {{ p.sessionName }}</span>
          </div>
          <div style="font-size: 11px; color: #484f58;">
            创建：{{ fmtDate(p.createdAt) }}
            <span v-if="p.status !== 'RUNNING'" style="margin-left: 12px;">完成：{{ fmtDate(p.updatedAt) }}</span>
          </div>
        </div>
      </div>
      <div v-if="pipelines.length === 0" style="text-align: center; padding: 60px 20px; color: #8b949e;">
        <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
        <div style="font-size: 16px;">暂无流水线记录</div>
        <div style="font-size: 13px; margin-top: 4px;">触发 /all-in-mvp 命令后将自动出现</div>
      </div>
    </div>

    <!-- Pipeline Detail View -->
    <div v-if="viewMode === 'detail'">
      <!-- Back button -->
      <div style="margin-bottom: 16px;">
        <button @click="goBack" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;">← 返回列表</button>
      </div>

    <!-- Pipeline Status -->
    <div v-if="pipeline" style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; gap: 40px; align-items: center;">
      <div>
        <div style="font-size: 12px; color: #8b949e; margin-bottom: 4px;">Pipeline</div>
        <div style="font-size: 16px; font-weight: 600;">{{ pipeline.name }}</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #8b949e; margin-bottom: 4px;">Status</div>
        <span :style="{ background: statusColor + '22', color: statusColor, padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, border: '1px solid ' + statusColor + '44' }">{{ pipeline.status }}</span>
      </div>
      <div>
        <div style="font-size: 12px; color: #8b949e; margin-bottom: 4px;">Mode</div>
        <div style="font-size: 14px;">{{ pipeline.mode }}</div>
      </div>
      <div v-if="pipeline.sessionName">
        <div style="font-size: 12px; color: #8b949e; margin-bottom: 4px;">Session</div>
        <div style="font-size: 13px; color: #8b949e;">{{ pipeline.sessionName }}</div>
      </div>
      <div v-if="stats">
        <div style="font-size: 12px; color: #8b949e; margin-bottom: 4px;">Events</div>
        <div style="font-size: 20px; font-weight: 600; color: #58a6ff;">{{ stats.totalEvents }}</div>
      </div>
    </div>
    <div v-else style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 40px; text-align: center; margin-bottom: 20px; color: #8b949e;">
      <div style="font-size: 40px; margin-bottom: 12px;">📭</div>
      <div style="font-size: 16px;">无运行中的流水线</div>
      <div style="font-size: 13px; margin-top: 4px;">触发 /all-in-mvp 命令后将自动出现</div>
    </div>

    <!-- Filters -->
    <div v-if="pipeline" style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
      <select v-model="filterStage" @change="onFilterChange" style="background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 10px; border-radius: 6px; font-size: 13px;">
        <option value="">全部 Stage</option>
        <option value="Stage1">Stage1</option>
        <option value="Stage2">Stage2</option>
        <option value="Stage3">Stage3</option>
        <option value="Stage4">Stage4</option>
        <option value="Stage5">Stage5</option>
      </select>
      <input v-model="filterAgent" @input="onFilterChange" placeholder="Agent 名称..." style="background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 10px; border-radius: 6px; font-size: 13px; width: 160px;" />
      <select v-model="filterEventType" @change="onFilterChange" style="background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 10px; border-radius: 6px; font-size: 13px;">
        <option value="">全部类型</option>
        <option v-for="(label, key) in eventTypeLabel" :key="key" :value="key">{{ label }}</option>
      </select>
      <input v-model="filterSearch" @input="onFilterChange" placeholder="搜索关键词..." style="background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 10px; border-radius: 6px; font-size: 13px; width: 200px;" />
    </div>

    <!-- Timeline + Stats Layout -->
    <div v-if="pipeline" style="display: grid; grid-template-columns: 1fr 360px; gap: 20px;">
      <!-- Left: Timeline -->
      <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden;">
        <div style="padding: 12px 16px; border-bottom: 1px solid #30363d; font-size: 14px; font-weight: 600;">
          📋 事件时间线 <span style="color: #8b949e; font-weight: 400;">({{ total }})</span>
        </div>
        <div v-if="loading" style="padding: 20px; text-align: center; color: #8b949e;">加载中...</div>
        <div v-else-if="events.length === 0" style="padding: 40px; text-align: center; color: #8b949e;">
          <div style="font-size: 30px; margin-bottom: 8px;">📋</div>
          <div>暂无事件</div>
        </div>
        <div v-else style="max-height: 500px; overflow-y: auto;">
          <div v-for="evt in events" :key="evt.id" @click="selectedEvent = evt"
               :style="{ borderLeft: getEventAccent(evt) }"
               style="padding: 10px 16px; border-bottom: 1px solid #21262d; cursor: pointer; transition: background 0.15s; display: flex; gap: 12px; align-items: flex-start; border-left: 3px solid transparent;"
               @mouseenter="e => e.currentTarget.style.background = '#1c2128'" @mouseleave="e => e.currentTarget.style.background = ''">
            <div style="font-size: 18px; flex-shrink: 0; width: 28px; text-align: center;">{{ eventTypeIcon[evt.eventType] || "📌" }}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 2px; flex-wrap: wrap;">
                <span style="font-size: 13px; font-weight: 600;">{{ eventTypeLabel[evt.eventType] || evt.eventType }}</span>
                <span v-if="evt.agentName" style="background: #1f6feb22; color: #58a6ff; padding: 1px 6px; border-radius: 4px; font-size: 11px;">{{ evt.agentName }}</span>
                <span v-if="evt.stage" :style="{ background: stageColor(evt.stage) + '22', color: stageColor(evt.stage), padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }">{{ evt.stage }}</span>
              </div>
              <div style="font-size: 13px; color: #c9d1d9;">{{ evt.message }}</div>
              <!-- 产物变更摘要 -->
              <div v-if="evt.eventType === 'FILE_CHANGE' && evt.metadata?.file_path" style="margin-top: 3px; display: flex; gap: 4px; align-items: center;">
                <span style="background: #1f6feb11; color: #79c0ff; padding: 1px 8px; border-radius: 4px; font-size: 11px; font-family: monospace;">📄 {{ evt.metadata.file_path }}</span>
                <span v-if="evt.metadata?.operation" style="font-size: 10px; color: #8b949e; background: #21262d; padding: 0 6px; border-radius: 3px;">{{ evt.metadata.operation }}</span>
              </div>
              <!-- Agent 启动摘要 -->
              <div v-else-if="evt.eventType === 'AGENT_SPAWN' && evt.metadata?.subagent" style="margin-top: 3px;">
                <span style="background: #3fb95015; color: #7ee787; padding: 1px 8px; border-radius: 4px; font-size: 11px;">🤖 {{ evt.metadata.subagent }}</span>
              </div>
              <!-- 拷问审查摘要 -->
              <div v-else-if="evt.eventType === 'GRILL_ROUND'" style="margin-top: 3px;">
                <span :style="{ background: (evt.metadata?.result === 'PASS' ? '#3fb950' : '#f85149') + '15', color: evt.metadata?.result === 'PASS' ? '#3fb950' : '#f85149', padding: '1px 8px', borderRadius: '4px', fontSize: '11px' }">🔄 Round {{ evt.metadata?.round }} · {{ evt.metadata?.result }}</span>
              </div>
              <!-- 门禁检查摘要 -->
              <div v-else-if="evt.eventType === 'GATE_CHECK'" style="margin-top: 3px; display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                <span :style="{ background: (evt.metadata?.result === 'PASS' ? '#3fb950' : '#f85149') + '15', color: evt.metadata?.result === 'PASS' ? '#3fb950' : '#f85149', padding: '1px 8px', borderRadius: '4px', fontSize: '11px' }">{{ evt.metadata?.result === 'PASS' ? '✅' : '❌' }} {{ evt.metadata?.result }}</span>
                <span v-for="g in (evt.metadata?.gates || [])" :key="g" style="background: #30363d; color: #8b949e; padding: 1px 6px; border-radius: 4px; font-size: 10px;">{{ g }}</span>
              </div>
              <!-- 状态转换摘要（PIPELINE_END / STAGE_END 显示耗时等） -->
              <div v-else-if="evt.eventType === 'PIPELINE_END' && evt.metadata?.status" style="margin-top: 3px;">
                <span :style="{ background: '#3fb95015', color: '#3fb950', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }">🏁 {{ evt.metadata.status }}</span>
                <span v-if="evt.metadata?.duration" style="margin-left: 6px; font-size: 10px; color: #8b949e;">{{ fmtDuration(evt.metadata.duration) }}</span>
              </div>
              <div style="font-size: 11px; color: #484f58; margin-top: 2px;">#{{ evt.seq }} · {{ fmtDate(evt.timestamp) }}</div>
            </div>
          </div>
        </div>
        <!-- Pagination -->
        <div v-if="total > pageSize" style="padding: 10px 16px; border-top: 1px solid #30363d; display: flex; justify-content: center; gap: 8px;">
          <button @click="page--; fetchEvents()" :disabled="page <= 1" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;" :style="{ opacity: page <= 1 ? 0.4 : 1 }">上一页</button>
          <span style="font-size: 12px; color: #8b949e; padding: 4px 8px;">{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
          <button @click="page++; fetchEvents()" :disabled="page >= Math.ceil(total / pageSize)" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;" :style="{ opacity: page >= Math.ceil(total / pageSize) ? 0.4 : 1 }">下一页</button>
        </div>
      </div>

      <!-- Right: Stats -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Event Type Distribution -->
        <div v-if="stats" style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">📊 事件类型分布</div>
          <div v-for="(count, type) in stats.eventTypeDistribution" :key="type" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 12px; width: 90px; color: #8b949e; text-align: right;">{{ eventTypeLabel[type] || type }}</span>
            <div style="flex: 1; background: #21262d; border-radius: 4px; height: 8px; overflow: hidden;">
              <div :style="{ width: (count / stats.totalEvents * 100) + '%', background: '#58a6ff', height: '100%', borderRadius: '4px' }"></div>
            </div>
            <span style="font-size: 12px; color: #c9d1d9; width: 30px;">{{ count }}</span>
          </div>
        </div>

        <!-- Stage Duration -->
        <div v-if="stageDurations.length" style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">⏱ Stage 耗时</div>
          <div v-for="sd in stageDurations" :key="sd.stage" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px;">
            <span style="color: #8b949e;">{{ sd.stage }}</span>
            <span style="color: #58a6ff; font-weight: 600;">{{ fmtDuration(sd.durationMs) }}</span>
            <span style="color: #484f58; font-size: 11px;">{{ sd.eventCount }} events</span>
          </div>
        </div>

        <!-- Agent Task Progress -->
        <div v-if="agentTasks.length" style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">🎯 Agent 任务进度</div>
          <div v-for="at in agentTasks" :key="at.agentName" @click="selectedAgentTasks = at"
               style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s;"
               @mouseenter="e => e.currentTarget.style.background = '#1c2128'"
               @mouseleave="e => e.currentTarget.style.background = ''">
            <div style="position: relative; width: 36px; height: 36px; flex-shrink: 0;">
              <svg viewBox="0 0 36 36" style="width: 36px; height: 36px; transform: rotate(-90deg);">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#21262d" stroke-width="3"/>
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#58a6ff" stroke-width="3"
                  :stroke-dasharray="97.4"
                  :stroke-dashoffset="97.4 * (1 - (at.completed + at.failed) / Math.max(at.total, 1))"
                  stroke-linecap="round"/>
              </svg>
              <span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #c9d1d9;">{{ at.completed + at.failed }}/{{ at.total }}</span>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 12px; font-weight: 600; color: #e6edf3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ at.agentName }}</div>
              <div style="display: flex; gap: 8px; font-size: 10px; margin-top: 2px;">
                <span style="color: #3fb950;">✓ {{ at.completed }}</span>
                <span v-if="at.failed > 0" style="color: #f85149;">✗ {{ at.failed }}</span>
                <span v-if="at.total - at.completed - at.failed > 0" style="color: #8b949e;">○ {{ at.total - at.completed - at.failed }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Agent Activity -->
        <div v-if="agentActivities.length" style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">🤖 Agent 活跃度</div>
          <div v-for="aa in agentActivities.slice(0, 8)" :key="aa.agentName" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 12px; width: 110px; color: #c9d1d9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ aa.agentName }}</span>
            <div style="flex: 1; background: #21262d; border-radius: 4px; height: 6px; overflow: hidden;">
              <div :style="{ width: (aa.eventCount / (agentActivities[0]?.eventCount || 1) * 100) + '%', background: '#3fb950', height: '100%', borderRadius: '4px' }"></div>
            </div>
            <span style="font-size: 11px; color: #8b949e; width: 50px;">{{ aa.eventCount }} 事件</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Task Detail Modal -->
    <div v-if="selectedAgentTasks" @click.self="selectedAgentTasks = null" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;">
      <div style="background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: 600;">🎯 {{ selectedAgentTasks.agentName }}</div>
          <button @click="selectedAgentTasks = null" style="background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding: 12px; background: #0d1117; border-radius: 8px;">
          <div style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #58a6ff;">{{ selectedAgentTasks.completed + selectedAgentTasks.failed }}/{{ selectedAgentTasks.total }}</div>
            <div style="font-size: 11px; color: #8b949e; margin-top: 2px;">已完成</div>
          </div>
          <div style="flex: 1;">
            <div style="height: 6px; background: #21262d; border-radius: 3px; overflow: hidden;">
              <div :style="{ width: (selectedAgentTasks.total > 0 ? ((selectedAgentTasks.completed + selectedAgentTasks.failed) / selectedAgentTasks.total * 100) : 0) + '%', background: 'linear-gradient(90deg, #3fb950, #58a6ff)', height: '100%', borderRadius: '3px' }"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px;">
              <span style="color: #3fb950;">✓ {{ selectedAgentTasks.completed }} 已完成</span>
              <span v-if="selectedAgentTasks.failed > 0" style="color: #f85149;">✗ {{ selectedAgentTasks.failed }} 失败</span>
              <span style="color: #484f58;">○ {{ selectedAgentTasks.total - selectedAgentTasks.completed - selectedAgentTasks.failed }} 待办</span>
            </div>
          </div>
        </div>
        <div v-if="selectedAgentTasks.tasks.length > 0">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #8b949e;">任务清单</div>
          <div v-for="(task, i) in selectedAgentTasks.tasks" :key="i"
               style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-bottom: 1px solid #21262d; font-size: 13px;">
            <span :style="{
              color: task.status === 'DONE' ? '#3fb950' : task.status === 'FAILED' ? '#f85149' : '#8b949e',
              fontSize: '14px'
            }">{{ task.status === 'DONE' ? '✅' : task.status === 'FAILED' ? '❌' : '⏳' }}</span>
            <span style="flex: 1; color: #c9d1d9;">{{ task.taskName }}</span>
            <span style="font-size: 11px; color: #484f58;">{{ new Date(task.timestamp).toLocaleTimeString('zh-CN') }}</span>
          </div>
        </div>
        <div v-else style="text-align: center; padding: 20px; color: #8b949e; font-size: 13px;">暂无任务记录</div>
      </div>
    </div>

    <!-- Event Detail Modal -->
    <div v-if="selectedEvent" @click.self="selectedEvent = null" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;">
      <div style="background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: 600;">事件详情 #{{ selectedEvent.seq }}</div>
          <button @click="selectedEvent = null" style="background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 10px; font-size: 13px;">
          <div style="color: #8b949e;">类型</div><div>{{ eventTypeLabel[selectedEvent.eventType] || selectedEvent.eventType }}</div>
          <div style="color: #8b949e;">Agent</div><div>{{ selectedEvent.agentName || "—" }}</div>
          <div style="color: #8b949e;">Stage</div><div>{{ selectedEvent.stage || "—" }}</div>
          <div style="color: #8b949e;">时间</div><div>{{ fmtDate(selectedEvent.timestamp) }}</div>
          <div style="color: #8b949e;">消息</div><div>{{ selectedEvent.message }}</div>
          <div style="color: #8b949e;">Pipeline</div><div style="font-family: monospace; font-size: 11px;">{{ selectedEvent.pipelineId }}</div>
          <div style="color: #8b949e;">Event ID</div><div style="font-family: monospace; font-size: 11px;">{{ selectedEvent.id }}</div>
        </div>
        <div v-if="selectedEvent.metadata && Object.keys(selectedEvent.metadata).length" style="margin-top: 16px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #8b949e;">Metadata</div>
          <pre style="background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; font-size: 12px; overflow-x: auto; color: #7ee787;">{{ JSON.stringify(selectedEvent.metadata, null, 2) }}</pre>
        </div>
      </div>
    </div>
    </div> <!-- end detail view -->
  </div>
</template>
