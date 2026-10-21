import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Student, Subject } from '@myos/shared';
import { useAuthStore } from './auth';
import { usePaperSelectionStore } from './paperSelection';
import { subjectsApi } from '@/api';

const STORAGE_KEY = 'myos_current_student';

export const useStudentStore = defineStore('student', () => {
  const auth = useAuthStore();
  const selectedId = ref<string>(localStorage.getItem(STORAGE_KEY) ?? '');
  const subjects = ref<Subject[]>([]);
  const loadingSubjects = ref(false);

  const students = computed(() => auth.students);
  const currentStudent = computed<Student | null>(() => {
    return (
      students.value.find((student) => student.id === selectedId.value) ??
      students.value[0] ??
      null
    );
  });
  const currentStudentId = computed(() => currentStudent.value?.id ?? '');

  watch(
    students,
    (list) => {
      if (!list.length) return;
      if (!list.some((student) => student.id === selectedId.value)) {
        selectedId.value = list[0].id;
      }
    },
    { immediate: true },
  );

  watch(selectedId, (value) => {
    if (value) localStorage.setItem(STORAGE_KEY, value);
  });

  function selectStudent(id: string): void {
    if (id !== selectedId.value) {
      usePaperSelectionStore().clear();
    }
    selectedId.value = id;
  }

  async function loadSubjects(force = false): Promise<void> {
    if (subjects.value.length && !force) return;
    loadingSubjects.value = true;
    try {
      const grade = currentStudent.value?.grade;
      const { data } = await subjectsApi.list(grade);
      subjects.value = data;
    } finally {
      loadingSubjects.value = false;
    }
  }

  function subjectById(id?: string | null): Subject | undefined {
    return subjects.value.find((subject) => subject.id === id);
  }

  return {
    selectedId,
    students,
    currentStudent,
    currentStudentId,
    subjects,
    loadingSubjects,
    selectStudent,
    loadSubjects,
    subjectById,
  };
});
