<script setup lang="ts">
import icons from '../../assets/source-icons.svg?url&no-inline'
defineProps<{ name: string }>()
</script>
<template><svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><use :href="`${icons}#ph-${name}`" /></svg></template>
