<template>
  <div class="app-shell">
    <main class="app-main" :class="{ 'no-tabbar': hideTabbar }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <van-tabbar
      v-if="!hideTabbar"
      route
      fixed
      safe-area-inset-bottom
      active-color="#16a34a"
      inactive-color="#94a3b8"
    >
      <van-tabbar-item replace to="/home" icon="wap-home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/questions" icon="notes-o">错题</van-tabbar-item>
      <van-tabbar-item replace to="/papers" icon="description-o">试卷</van-tabbar-item>
      <van-tabbar-item replace to="/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStudentStore } from '@/stores/student';

const route = useRoute();
const studentStore = useStudentStore();

const hideTabbar = computed(() =>
  ['upload-confirm', 'question-edit'].includes(String(route.name)),
);

onMounted(() => {
  void studentStore.loadSubjects();
});

watch(
  () => studentStore.currentStudentId,
  () => {
    void studentStore.loadSubjects(true);
  },
);
</script>
