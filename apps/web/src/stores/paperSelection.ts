import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export const usePaperSelectionStore = defineStore('paperSelection', () => {
  const ids = ref<string[]>([]);

  const count = computed(() => ids.value.length);

  function set(next: string[]): void {
    ids.value = Array.from(new Set(next));
  }

  function add(next: string[]): void {
    ids.value = Array.from(new Set([...ids.value, ...next]));
  }

  function toggle(id: string): void {
    ids.value = ids.value.includes(id)
      ? ids.value.filter((item) => item !== id)
      : [...ids.value, id];
  }

  function remove(id: string): void {
    ids.value = ids.value.filter((item) => item !== id);
  }

  function clear(): void {
    ids.value = [];
  }

  return { ids, count, set, add, toggle, remove, clear };
});
