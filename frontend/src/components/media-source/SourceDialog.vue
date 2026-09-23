<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { MediaSource } from '../../types/mediaSource'
import { saveSource, testConnectionInput } from '../../services/mediaSourceService'
import SourceIcon from './SourceIcon.vue'
const props = defineProps<{ source?: MediaSource }>()
const emit = defineEmits<{ close: []; saved: [id: string] }>()
const dialog = ref<HTMLDialogElement>()
const form = ref<HTMLFormElement>()
const input = reactive({ name: props.source?.name ?? '', address: props.source?.address ?? '', username: '', password: '' })
const testing = ref(false)
const saving = ref(false)
const success = ref(false)
const feedback = ref('')
let revision = 0
function changed() {
  revision++
  success.value = false
  testing.value = false
  feedback.value = '连接信息已更改，请重新测试。'
}
async function test() {
  if (!form.value?.reportValidity()) return
  if (!input.name.trim()) { feedback.value = '请填写来源名称。'; return }
  const current = ++revision
  testing.value = true
  success.value = false
  feedback.value = '正在连接…'
  try {
    const passed = await testConnectionInput({ ...input })
    if (revision !== current) return
    success.value = passed
    feedback.value = passed ? '连接成功（演示）。尚未扫描；连接结果不代表文件可播放。' : '连接失败（演示）：服务不可达，请检查地址后重试。'
  } catch (error) {
    if (revision === current) feedback.value = error instanceof Error ? error.message : '连接测试失败，请重试。'
  } finally { if (revision === current) testing.value = false }
}
async function save() {
  if (!success.value || saving.value || !form.value?.reportValidity()) return
  const current = ++revision
  saving.value = true
  try {
    const id = await saveSource({ ...input }, props.source?.id)
    if (current !== revision) return
    input.password = ''; input.username = ''
    emit('saved', id)
  } catch (error) { feedback.value = error instanceof Error ? error.message : '保存失败，请重试。' }
  finally { saving.value = false }
}
function close(event?: Event) {
  if (saving.value) { event?.preventDefault(); return }
  revision++
  input.password = ''; input.username = ''
  emit('close')
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => { revision++; input.password = ''; input.username = ''; dialog.value?.close() })
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="media-source-ui source-dialog" aria-labelledby="source-dialog-title" @cancel="close">
      <header class="dialog-header"><span /><h2 id="source-dialog-title">{{ source ? '编辑' : '添加' }} WebDAV 来源</h2><button class="dialog-icon-button" :disabled="saving" aria-label="关闭来源表单" @click="close"><SourceIcon name="x" /></button></header>
      <div class="dialog-body">
        <form ref="form" @submit.prevent="save" @input="changed">
          <div class="form-grid">
            <div class="form-field"><label for="source-name">来源名称</label><input id="source-name" v-model="input.name" :disabled="saving" required maxlength="80" placeholder="例如：AList · 迅雷云盘" autocomplete="off" /></div>
            <div class="form-field"><label for="source-address">WebDAV 地址</label><input id="source-address" v-model="input.address" :disabled="saving" type="url" required placeholder="https://example.com/dav" autocomplete="url" /></div>
            <div class="form-field"><label for="source-username">用户名</label><input id="source-username" v-model="input.username" :disabled="saving" autocomplete="username" /></div>
            <div class="form-field"><label for="source-password">密码 / 凭据</label><input id="source-password" v-model="input.password" :disabled="saving" type="password" autocomplete="current-password" aria-describedby="credential-help" :placeholder="source ? '留空保留已保存的凭据（演示）' : '输入凭据（演示）'" /></div>
            <p id="credential-help" class="form-help">当前仅模拟连接，请勿填写真实凭据。凭据不会保存；编辑时留空的正式行为待接口确认。</p>
            <p class="form-help">先保存连接，再选择存放影片的文件夹。添加来源不会开始扫描。</p>
          </div>
          <p class="connection-feedback" :data-success="success" role="status">{{ feedback }}</p>
          <div class="dialog-actions"><button class="secondary-action" type="button" :disabled="testing || saving" @click="test">{{ testing ? '正在连接…' : success ? '重新测试' : '测试连接' }}</button><button class="primary-action" :disabled="!success || saving" type="submit">{{ saving ? '正在保存…' : source ? '保存更改' : '添加来源' }}</button></div>
        </form>
      </div>
    </dialog>
  </Teleport>
</template>
