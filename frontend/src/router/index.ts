import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import HostNewView from '@/views/HostNewView.vue';
import HostView from '@/views/HostView.vue';
import JoinView from '@/views/JoinView.vue';
import GuestView from '@/views/GuestView.vue';
import AuthErrorView from '@/views/AuthErrorView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/host/new', name: 'host-new', component: HostNewView },
    { path: '/host/:id', name: 'host', component: HostView },
    { path: '/join/:code', name: 'join', component: JoinView },
    { path: '/room/:code', name: 'guest', component: GuestView },
    { path: '/auth/error', name: 'auth-error', component: AuthErrorView },
  ],
});
