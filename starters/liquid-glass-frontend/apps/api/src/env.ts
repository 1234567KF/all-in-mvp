export const env = {
  PORT: parseInt(process.env.PORT || "3000"),
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-key",
} as const

// 生产环境必须配置
if (env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
  throw new Error("[ENV] FRONTEND_URL is required in production")
}

if (env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("[ENV] JWT_SECRET is required in production")
}
