import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/AppLayout.vue'),
      children: [
        { path: '', redirect: '/home' },
        { path: 'home', name: 'home', component: () => import('@/views/HomeView.vue') },
        { path: 'upload', name: 'upload', component: () => import('@/views/UploadView.vue') },
        {
          path: 'upload/confirm/:jobId',
          name: 'upload-confirm',
          component: () => import('@/views/ConfirmView.vue'),
        },
        {
          path: 'questions',
          name: 'questions',
          component: () => import('@/views/QuestionsView.vue'),
        },
        {
          path: 'questions/new',
          name: 'question-new',
          component: () => import('@/views/QuestionEditView.vue'),
        },
        {
          path: 'questions/:id',
          name: 'question-detail',
          component: () => import('@/views/QuestionDetailView.vue'),
        },
        {
          path: 'questions/:id/edit',
          name: 'question-edit',
          component: () => import('@/views/QuestionEditView.vue'),
        },
        { path: 'review', name: 'review', component: () => import('@/views/ReviewView.vue') },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/KnowledgeView.vue'),
        },
        { path: 'papers', name: 'papers', component: () => import('@/views/PapersView.vue') },
        {
          path: 'papers/new',
          name: 'paper-new',
          component: () => import('@/views/PaperCreateView.vue'),
        },
        {
          path: 'papers/:id',
          name: 'paper-detail',
          component: () => import('@/views/PaperDetailView.vue'),
        },
        { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) await auth.bootstrap();
  if (!to.meta.public && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && auth.isLoggedIn) {
    return { name: 'home' };
  }
  return true;
});

export default router;
