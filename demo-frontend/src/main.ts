import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './index.css'

const routes = [
  { path: '/', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/users', name: 'users', component: () => import('./views/UserList.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

createApp(App).use(router).mount('#app')
