import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { initDB } from "./db/index.js";
import { pipelineRoutes } from "./modules/pipeline/routes.js";
import { eventRoutes, statsRoutes } from "./modules/event/routes.js";

// 初始化数据库
initDB();

const app = new Hono();

// CORS — 允许前端跨域访问
app.use("*", cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// 挂载路由
app.route("/api/pipelines", pipelineRoutes);
app.route("/api/events", eventRoutes);
app.route("/api/stats", statsRoutes);

// 健康检查
app.get("/health", (c) => c.json({ service: "pipeline-monitor", status: "ok" }));

// 启动服务
const port = parseInt(process.env.PORT || "3010");
console.log(`🚀 Pipeline Monitor API running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
