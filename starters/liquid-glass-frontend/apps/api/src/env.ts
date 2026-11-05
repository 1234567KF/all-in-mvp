export const env = {
  PORT: parseInt(process.env.PORT || "3000"),
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-key",
  /**
   * 演示模式：仅模板自部署 / 测试环境使用。
   * - 启动时幂等补齐 7 条演示通知；
   * - 开放 POST /notifications/dev/{push,reset}。
   * 真实业务项目默认关闭。
   */
  DEMO_MODE: process.env.DEMO_MODE === "true",
} as const

// 生产环境必须配置
if (env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
  throw new Error("[ENV] FRONTEND_URL is required in production")
}

if (env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("[ENV] JWT_SECRET is required in production")
}
