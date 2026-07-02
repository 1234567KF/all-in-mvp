/**
 * Liquid Glass 前端脚手架 — 入口
 *
 * 所有 all-in-mvp 生成的前端项目从此文件启动。
 * 添加新路由: 在 routes 数组中加入新条目即可。
 */

import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './index.css'

// ── 路由表 ──
// 新增页面时在此追加 { path, name, component }
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/HomePage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

createApp(App).use(router).mount('#app')
