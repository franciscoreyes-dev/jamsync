<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const reason = computed(() => (route.query.reason as string) ?? 'UNKNOWN_ERROR');
</script>

<template>
  <div>{{ reason }}</div>
</template>
