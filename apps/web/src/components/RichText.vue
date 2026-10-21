<template>
  <div class="rich-text" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderRichText } from '@/utils/format';

const props = defineProps<{ text?: string | null }>();
const html = computed(() => renderRichText(props.text));
</script>
