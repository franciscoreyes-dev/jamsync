<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const reason = computed(() => {
  const raw = route.query.reason;
  return typeof raw === 'string' ? raw : 'UNKNOWN_ERROR';
});
</script>

<template>
  <div>{{ reason }}</div>
</template>
