<template>
  <router-view />
</template>

<script setup lang="ts">
import { watchEffect } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const themeColors: Record<'home' | 'questions' | 'papers' | 'profile', string> = {
  home: '#527f76',
  questions: '#a86151',
  papers: '#6d6ba6',
  profile: '#617488',
};

function resolveTheme(name: unknown): 'home' | 'questions' | 'papers' | 'profile' {
  const key = String(name ?? '');
  if (['papers', 'paper-new', 'paper-detail'].includes(key)) return 'papers';
  if (key === 'profile') return 'profile';
  if (['questions', 'question-detail', 'question-edit', 'upload', 'knowledge'].includes(key)) {
    return 'questions';
  }
  return 'home';
}

watchEffect(() => {
  const theme = resolveTheme(route.name);
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColors[theme]);
});
</script>
