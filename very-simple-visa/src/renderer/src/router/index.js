import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../Home.vue'
import Todo from '../views/Todo.vue'
import Done from '../views/Done.vue'
const routes = [
  {
    path: '/',
    name: 'Home',
    redirect: '/todo',
    component: Home,
    children: [
      {
        path: '/todo',
        name: 'Todo',
        component: Todo
      },
      {
        path: '/done',
        name: 'Done',
        component: Done
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router