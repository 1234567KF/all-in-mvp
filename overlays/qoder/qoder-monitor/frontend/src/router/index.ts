import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/dashboard/Dashboard.vue'
import SessionList from '../views/sessions/SessionList.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'Dashboard', component: Dashboard },
    { path: '/sessions', name: 'Sessions', component: SessionList },
  ],
})

export default router
