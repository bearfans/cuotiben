<template>
  <header class="page-header" :class="{ 'page-header--plain': plain }">
    <button v-if="back" class="header-icon" type="button" aria-label="返回" @click="goBack">
      <van-icon name="arrow-left" size="20" />
    </button>
    <div class="header-title">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="header-right">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    back?: boolean;
    plain?: boolean;
  }>(),
  { back: true, plain: false },
);

const router = useRouter();

function goBack(): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/home');
  }
}
</script>

<style scoped>
.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: calc(8px + var(--safe-top)) 16px 8px;
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.page-header--plain {
  background: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: none;
}

.header-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border: 1px solid var(--glass-border-soft);
  border-radius: 50%;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  color: var(--text);
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.header-title {
  flex: 1;
  min-width: 0;
}

.header-title h1 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-title p {
  margin: 1px 0 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
</style>
