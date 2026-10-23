<template>
  <div class="app-shell">
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <van-tabbar route fixed safe-area-inset-bottom>
      <van-tabbar-item replace to="/home" icon="wap-home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/questions" icon="notes-o">错题</van-tabbar-item>
      <van-tabbar-item replace to="/papers" icon="description-o">试卷</van-tabbar-item>
      <van-tabbar-item replace to="/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useStudentStore } from '@/stores/student';

const studentStore = useStudentStore();

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
