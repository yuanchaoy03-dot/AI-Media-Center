<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SourceIcon from '../components/media-source/SourceIcon.vue'
import { getOwnedSources } from '../services/ownedSourceService'
import '../assets/media-source.css'

// 真实接口页面目前有加载中、失败、空列表三种状态，模板按 status 切换显示内容。
const status = ref<'loading' | 'error' | 'empty'>('loading')
const error = ref('')
const notice = ref('')
let controller: AbortController | undefined
async function load() {
  // 每次重试先取消上一轮请求；只有当前请求未被取消时，才更新成功或失败状态。
  controller?.abort()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  error.value = ''
  try {
    // 页面负责显示状态，service 负责取数据；signal 会一直传到 Axios。
    await getOwnedSources(current.signal)
    if (!current.signal.aborted) status.value = 'empty'
  } catch (reason) {
    if (current.signal.aborted) return
    status.value = 'error'
    error.value = reason instanceof Error ? reason.message : '来源加载失败，请重试。'
  }
}
function addSource() { notice.value = '添加媒体来源功能尚未开放。' }
// onMounted 在页面挂载后加载数据；onBeforeUnmount 在离开页面前取消尚未完成的请求。
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="media-source-ui source-page" lang="zh-CN">
    <header class="page-heading"><h1 class="page-title">媒体来源</h1><button class="primary-action" @click="addSource"><SourceIcon name="plus" />添加来源</button></header>
    <div class="sources-workspace">
      <section class="sources-section" aria-labelledby="connected-title" :aria-busy="status === 'loading'">
        <h2 id="connected-title" class="section-title">我的来源</h2>
        <div v-if="status === 'loading'" class="source-empty" role="status"><span class="spinner" /><p>正在加载媒体来源…</p></div>
        <div v-else-if="status === 'error'" class="source-empty" role="alert"><h3>暂时无法加载来源</h3><p>{{ error }}</p><button class="primary-action" @click="load">重试</button></div>
        <div v-else class="source-empty"><span class="empty-icon"><SourceIcon name="hard-drives" /></span><h3>还没有媒体来源</h3><p>添加 WebDAV 媒体来源，开始建立你的个人片库。支持 AList、NAS WebDAV、Nextcloud 等标准 WebDAV 服务。</p><button class="primary-action" @click="addSource">添加媒体来源</button></div>
      </section>
      <section v-if="status === 'empty'" class="sources-section"><div class="section-heading-row"><h2 class="section-title">最近入库</h2><RouterLink class="section-action" to="/library">查看全部<SourceIcon name="caret-right" /></RouterLink></div><p class="source-note">添加来源并扫描后，影片会出现在这里。</p></section>
      <p v-if="notice" class="source-note" role="status">{{ notice }}</p>
    </div>
  </section>
</template>
