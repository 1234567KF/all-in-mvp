/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_AUTH_REFRESH_PATH?: string
  /** 构建时间戳，由 CI / 构建脚本注入，缺失时页面回退为“未注入” */
  readonly VITE_BUILD_TIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
