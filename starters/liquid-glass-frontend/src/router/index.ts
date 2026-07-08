/**
 * Liquid Glass 前端脚手架 — 路由配置
 *
 * 布局结构:
 *   /              → AppLayout (侧边栏) → HomePage
 *   /dashboard     → AppLayout (侧边栏) → DashboardView
 *   /components    → AppLayout (侧边栏) → ComponentsView
 *   /login         → 独立页面 (居中卡片)
 *   /*             → NotFoundView
 *
 * 添加新页面: 在 children 数组中追加路由即可。
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomePage.vue'),
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'components',
          name: 'components',
          component: () => import('@/views/ComponentsView.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

export default router
