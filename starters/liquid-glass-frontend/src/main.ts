/**
 * Liquid Glass 前端脚手架 — 入口
 *
 * 所有 all-in-mvp 生成的前端项目从此文件启动。
 * 路由配置位于 src/router/index.ts，新增页面在那里添加。
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './index.css'

createApp(App).use(router).mount('#app')
