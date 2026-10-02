<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { MediaSource, SourceConnectionInput } from '../../types/mediaSource'
import { ApiError } from '../../services/http'
import SourceIcon from './SourceIcon.vue'
// 父页面传 source 就是编辑，不传就是新增；操作显式注入，saved 交回父页刷新或跳转。
const props = defineProps<{
  source?: MediaSource
  preview?: boolean
  testConnection: (input: SourceConnectionInput, signal: AbortSignal) => Promise<boolean>
  saveConnection: (
    input: SourceConnectionInput,
    signal: AbortSignal,
    id?: string,
  ) => Promise<string>
}>()
const emit = defineEmits<{ close: []; saved: [id: string] }>()
// 这里的 ref 保存模板中 ref="dialog" 的真实 DOM 元素，挂载前还没有值。
const dialog = ref<HTMLDialogElement>()
const form = ref<HTMLFormElement>()
// input 是弹窗自己的表单草稿，输入时不会直接改父页面的来源对象。
const input = reactive({
  name: props.source?.name ?? '',
  address: props.source?.address ?? '',
  username: '',
  password: '',
})
const testing = ref(false)
const saving = ref(false)
const success = ref(false)
const feedback = ref('')
// revision 记录表单版本；改输入或关闭弹窗时加一，让旧连接测试结果失效。
let revision = 0
let controller: AbortController | undefined
function changed() {
  revision++
  controller?.abort()
  success.value = false
  testing.value = false
  feedback.value = '连接信息已更改，请重新测试。'
}
async function test() {
  if (!form.value?.reportValidity()) return
  if (!input.name.trim()) {
    feedback.value = '请填写来源名称。'
    return
  }
  const current = ++revision
  controller?.abort()
  const request = new AbortController()
  controller = request
  testing.value = true
  success.value = false
  feedback.value = '正在连接…'
  try {
    // {...input} 复制本次测试的输入；等待期间即使继续编辑，测试仍使用发起时的内容。
    const passed = await props.testConnection({ ...input }, request.signal)
    if (revision !== current || request.signal.aborted) return
    success.value = passed
    feedback.value = passed
      ? props.preview
        ? '连接成功（演示）。尚未扫描；连接结果不代表文件可播放。'
        : '连接测试成功。添加来源不会自动开始扫描。'
      : props.preview
        ? '连接失败（演示）：服务不可达，请检查地址后重试。'
        : '连接测试失败，请检查连接信息后重试。'
  } catch (error) {
    if (
      revision === current &&
      !request.signal.aborted &&
      !(error instanceof ApiError && error.code === 'STALE_REQUEST')
    ) {
      success.value = false
      feedback.value = error instanceof Error ? error.message : '连接测试失败，请重试。'
    }
  } finally {
    if (revision === current) testing.value = false
  }
}
// 只有当前输入通过连接测试才允许保存；正式服务端保存时仍会重新测试连接。
async function save() {
  if (!success.value || saving.value || !form.value?.reportValidity()) return
  const current = ++revision
  controller?.abort()
  const request = new AbortController()
  controller = request
  saving.value = true
  try {
    const id = await props.saveConnection({ ...input }, request.signal, props.source?.id)
    if (current !== revision || request.signal.aborted) return
    input.password = ''
    input.username = ''
    emit('saved', id)
  } catch (error) {
    if (
      current !== revision ||
      request.signal.aborted ||
      (error instanceof ApiError && error.code === 'STALE_REQUEST')
    )
      return
    success.value = false
    feedback.value = error instanceof Error ? error.message : '保存失败，请重试。'
  } finally {
    if (current === revision) saving.value = false
  }
}
function close(event?: Event) {
  if (saving.value) {
    event?.preventDefault()
    return
  }
  revision++
  controller?.abort()
  input.password = ''
  input.username = ''
  emit('close')
}
// 挂载后 DOM 才可用，调用原生 dialog 打开弹窗；卸载时关闭它并清掉凭据。
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => {
  revision++
  controller?.abort()
  input.password = ''
  input.username = ''
  dialog.value?.close()
})
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="media-source-ui source-dialog"
      aria-labelledby="source-dialog-title"
      @cancel="close"
    >
      <header class="dialog-header">
        <span />
        <h2 id="source-dialog-title">{{ source ? '编辑' : '添加' }} WebDAV 来源</h2>
        <button
          class="dialog-icon-button"
          :disabled="saving"
          aria-label="关闭来源表单"
          @click="close"
        >
          <SourceIcon name="x" />
        </button>
      </header>
      <div class="dialog-body">
        <form ref="form" @submit.prevent="save" @input="changed">
          <div class="form-grid">
            <div class="form-field">
              <label for="source-name">来源名称</label
              ><input
                id="source-name"
                v-model="input.name"
                :disabled="saving"
                required
                maxlength="80"
                placeholder="例如：AList · 迅雷云盘"
                autocomplete="off"
              />
            </div>
            <div class="form-field">
              <label for="source-address">WebDAV 地址</label
              ><input
                id="source-address"
                v-model="input.address"
                :disabled="saving"
                type="url"
                required
                maxlength="2048"
                placeholder="https://example.com/dav"
                autocomplete="url"
              />
            </div>
            <div class="form-field">
              <label for="source-username">用户名</label
              ><input
                id="source-username"
                v-model="input.username"
                :disabled="saving"
                maxlength="256"
                autocomplete="username"
              />
            </div>
            <div class="form-field">
              <label for="source-password">密码 / 凭据</label
              ><input
                id="source-password"
                v-model="input.password"
                :disabled="saving"
                type="password"
                maxlength="1024"
                autocomplete="current-password"
                aria-describedby="credential-help"
                :placeholder="
                  preview
                    ? source
                      ? '留空保留已保存的凭据（演示）'
                      : '输入凭据（演示）'
                    : '输入 WebDAV 密码或凭据'
                "
              />
            </div>
            <p v-if="preview" id="credential-help" class="form-help">
              当前仅模拟连接，请勿填写真实凭据。凭据不会保存；编辑时留空的正式行为待接口确认。
            </p>
            <p v-else id="credential-help" class="form-help">
              凭据由服务器加密保存，仅用于访问你的 WebDAV。连接测试不会保存来源。
            </p>
            <p class="form-help">先保存连接，再选择影片文件夹。添加来源不会开始扫描。</p>
          </div>
          <p class="connection-feedback" :data-success="success" role="status">{{ feedback }}</p>
          <div class="dialog-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="testing || saving"
              @click="test"
            >
              {{ testing ? '正在连接…' : success ? '重新测试' : '测试连接' }}</button
            ><button class="primary-action" :disabled="!success || saving" type="submit">
              {{ saving ? '正在保存…' : source ? '保存更改' : '添加来源' }}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  </Teleport>
</template>
