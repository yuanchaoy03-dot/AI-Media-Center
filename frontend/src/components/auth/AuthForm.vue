<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import sidebarIcons from '../../assets/sidebar-icons.svg'

// 开发阶段纯装饰素材：不关联影片服务或用户片库，可整体替换为原创认证资产。
const authBackdropItems = [
  '/mock/posters/tmdb-poster-arrival.jpg',
  '/mock/backdrops/tmdb-backdrop-dune.jpg',
  '/mock/posters/tmdb-poster-interstellar.jpg',
  '/mock/posters/tmdb-poster-blade-runner-2049.jpg',
  '/mock/posters/tmdb-poster-whiplash.jpg',
  '/mock/posters/tmdb-poster-inception.jpg',
  '/mock/posters/tmdb-poster-1917.jpg',
]

const props = defineProps<{ mode: 'login' | 'register' }>()
const registering = computed(() => props.mode === 'register')
const username = ref('')
const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const pending = ref(false)
const message = ref('')
const errors = reactive({ username: '', password: '', confirmation: '' })
let previewTimer: ReturnType<typeof setTimeout> | undefined

function clearError(field: keyof typeof errors) {
  errors[field] = ''
  if (field === 'password') errors.confirmation = ''
  message.value = ''
}

function submit() {
  if (pending.value) return
  message.value = ''
  errors.username = username.value.trim() ? '' : '请输入用户名。'
  errors.password = password.value ? '' : '请输入密码。'
  errors.confirmation = registering.value
    ? (!confirmation.value ? '请再次输入密码。' : confirmation.value !== password.value ? '两次输入的密码不一致。' : '')
    : ''
  if (Object.values(errors).some(Boolean)) return

  // UI 阶段只预览提交反馈，不发送、记录或持久化任何凭据，也不创建登录态。
  pending.value = true
  previewTimer = setTimeout(() => {
    pending.value = false
    message.value = registering.value
      ? '注册服务尚未接入，暂时无法创建账号。'
      : '登录服务尚未接入，请稍后再试。'
  }, 400)
}

onBeforeUnmount(() => clearTimeout(previewTimer))
</script>

<template>
  <div class="auth-page" lang="zh-CN">
    <div class="auth-background" aria-hidden="true">
      <div class="auth-collage">
        <img v-for="src in authBackdropItems" :key="src" :src="src" alt="" draggable="false" decoding="async" />
      </div>
    </div>
    <header class="auth-brand">
      <span class="auth-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 256 256"><use :href="`${sidebarIcons}#ph-film-reel-fill`" /></svg>
      </span>
      <span>PERSONAL CINEMA</span>
    </header>

    <section class="auth-content" aria-labelledby="auth-title">
      <div class="auth-heading">
        <p class="auth-eyebrow">你的私人影院</p>
        <h1 id="auth-title">{{ registering ? '创建你的账号' : '欢迎回来' }}</h1>
        <p class="auth-description">{{ registering ? '从自己的收藏开始，建立属于你的片库。' : '登录，回到你的光影世界。' }}</p>
      </div>

      <form novalidate :aria-busy="pending" @submit.prevent="submit">
        <div class="auth-field">
          <label for="auth-username">用户名</label>
          <input id="auth-username" v-model="username" name="username" autocomplete="username"
            autocapitalize="none" :spellcheck="false" placeholder="输入你的用户名" required :readonly="pending"
            :aria-invalid="!!errors.username" :aria-describedby="errors.username ? 'username-error' : undefined"
            @input="clearError('username')" />
          <p v-if="errors.username" id="username-error" class="field-error">{{ errors.username }}</p>
        </div>

        <div class="auth-field">
          <label for="auth-password">密码</label>
          <div class="password-control">
            <input id="auth-password" v-model="password" name="password" :type="showPassword ? 'text' : 'password'"
              :autocomplete="registering ? 'new-password' : 'current-password'" :placeholder="registering ? '设置你的密码' : '输入你的密码'"
              required :readonly="pending" :aria-invalid="!!errors.password"
              :aria-describedby="errors.password ? 'password-error' : undefined" @input="clearError('password')" />
            <button class="password-toggle" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              :aria-pressed="showPassword" @click="showPassword = !showPassword">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                <path v-if="showPassword" d="m4 4 16 16" />
              </svg>
            </button>
          </div>
          <p v-if="errors.password" id="password-error" class="field-error">{{ errors.password }}</p>
        </div>

        <div v-if="registering" class="auth-field">
          <label for="auth-confirmation">确认密码</label>
          <input id="auth-confirmation" v-model="confirmation" name="password-confirmation" :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password" placeholder="再次输入密码" required :readonly="pending"
            :aria-invalid="!!errors.confirmation" :aria-describedby="errors.confirmation ? 'confirmation-error' : undefined"
            @input="clearError('confirmation')" />
          <p v-if="errors.confirmation" id="confirmation-error" class="field-error">{{ errors.confirmation }}</p>
        </div>

        <p v-if="message" class="auth-feedback" role="alert">{{ message }}</p>
        <button class="auth-submit" type="submit" :disabled="pending">
          <span v-if="pending" class="auth-spinner" aria-hidden="true" />
          {{ pending ? (registering ? '正在创建…' : '正在登录…') : (registering ? '创建账号' : '登录') }}
        </button>
        <span class="auth-status" role="status">{{ pending ? '正在提交，请稍候。' : '' }}</span>
      </form>

      <p class="auth-switch">
        {{ registering ? '已有账号？' : '还没有账号？' }}
        <RouterLink :to="{ name: registering ? 'login' : 'register' }">{{ registering ? '登录' : '创建账号' }}<span aria-hidden="true"> ↗</span></RouterLink>
      </p>
      <div class="auth-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
        </svg>
        <p>你的片库，由你拥有。<br /><span>添加自己的媒体来源，开启私人观影体验。</span></p>
      </div>
    </section>
    <footer class="auth-footer">私人收藏 · 自由探索</footer>
  </div>
</template>

<style scoped>
.auth-page { position: relative; isolation: isolate; min-height: 100dvh; display: flex; flex-direction: column; gap: 32px; padding: 32px clamp(20px, 4vw, 64px) 24px; }
.auth-background { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; user-select: none; background: var(--color-background); }
.auth-background::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 48%, rgb(0 0 0 / 8%) 0%, rgb(0 0 0 / 22%) 46%, rgb(0 0 0 / 55%) 100%), linear-gradient(to bottom, rgb(5 5 7 / 28%), rgb(5 5 7 / 46%)); }
.auth-collage { position: absolute; inset: -3%; display: grid; grid-template-columns: 1fr 1.3fr 1.05fr 1.1fr; grid-template-rows: 1fr .45fr 1fr; gap: 16px; filter: brightness(.55) saturate(.88) blur(2px); transform: scale(1.03); }
.auth-collage img { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; border-radius: var(--radius-card); }
.auth-collage img:nth-child(1) { grid-area: 1 / 1 / 3 / 2; }
.auth-collage img:nth-child(2) { grid-area: 1 / 2 / 2 / 4; }
.auth-collage img:nth-child(3) { grid-area: 1 / 4 / 3 / 5; }
.auth-collage img:nth-child(4) { grid-area: 3 / 1 / 4 / 2; }
.auth-collage img:nth-child(5) { grid-area: 2 / 2 / 4 / 3; }
.auth-collage img:nth-child(6) { grid-area: 2 / 3 / 4 / 4; }
.auth-collage img:nth-child(7) { grid-area: 3 / 4 / 4 / 5; }
.auth-brand { display: flex; flex-shrink: 0; align-items: center; gap: 10px; font-size: 11px; font-weight: 650; letter-spacing: 1.8px; text-shadow: 0 2px 10px rgb(0 0 0 / 40%); }
.auth-brand-mark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-xs); background: var(--color-primary); }
.auth-brand-mark svg { width: 19px; height: 19px; fill: var(--color-text-on-primary); }
.auth-content { position: relative; flex-shrink: 0; width: min(420px, calc(100vw - 40px)); margin: auto; padding: 36px 34px; border: 1px solid rgb(255 255 255 / 13%); border-radius: var(--radius-lg); background: rgb(20 20 22 / 94%); box-shadow: 0 24px 64px rgb(0 0 0 / 32%), inset 0 1px 0 rgb(255 255 255 / 10%); animation: auth-enter 260ms var(--motion-ease); }
.auth-content::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(145deg, rgb(255 255 255 / 4.5%), transparent 36%); pointer-events: none; }
.auth-heading { margin-bottom: 26px; }
.auth-eyebrow { margin: 0 0 12px; color: var(--color-text-secondary); font-size: 12px; letter-spacing: 2px; }
h1 { margin: 0; font: var(--type-page); letter-spacing: var(--tracking-title); }
.auth-description { margin: 12px 0 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.7; }
.auth-field { margin-bottom: 20px; }
label { display: block; margin-bottom: 9px; font-size: 13px; font-weight: 500; }
input { width: 100%; min-height: 48px; border: 1px solid rgb(255 255 255 / 9%); border-radius: var(--radius-nav); background: rgb(255 255 255 / 5.5%); color: var(--color-text-primary); padding: 12px 14px; font: 14px/1.5 var(--font-ui); transition: border-color var(--motion-fast) var(--motion-ease), background var(--motion-fast) var(--motion-ease); }
input:focus { background: rgb(255 255 255 / 7.5%); border-color: rgb(255 255 255 / 22%); }
input::placeholder { color: var(--color-text-secondary); opacity: .7; }
input[aria-invalid='true'] { border-color: #de827c; }
input:focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--focus-offset); }
.password-control { position: relative; }
.password-control input { padding-right: 52px; }
button { font: inherit; cursor: pointer; }
.password-toggle { position: absolute; right: 5px; top: 4px; display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--color-text-secondary); }
.password-toggle svg { width: 19px; height: 19px; }
.field-error { margin: 8px 0 0; color: #efa19b; font-size: 12px; line-height: 1.5; }
.auth-feedback { padding: 12px 14px; border: 1px solid rgb(239 161 155 / 20%); border-radius: var(--radius-nav); background: rgb(239 161 155 / 6%); color: #efa19b; font-size: 13px; line-height: 1.6; }
.auth-submit { display: flex; justify-content: center; align-items: center; gap: 9px; width: 100%; min-height: 48px; margin-top: 28px; border: 0; border-radius: var(--radius-nav); background: var(--color-primary); color: var(--color-text-on-primary); font-size: 14px; font-weight: 650; transition: background var(--motion-fast) var(--motion-ease); }
.auth-submit:disabled { opacity: .65; cursor: wait; }
.auth-submit:active:not(:disabled) { background: #c9c9ce; }
.auth-switch { margin: 18px 0 0; text-align: center; color: var(--color-text-secondary); font-size: 13px; }
.auth-switch a { display: inline-block; padding: 8px 4px; color: var(--color-text-primary); text-decoration: none; border-radius: 4px; }
button:focus-visible, a:focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--focus-offset); }
.auth-note { display: flex; justify-content: center; align-items: flex-start; gap: 10px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--color-hairline); color: var(--color-text-secondary); }
.auth-note svg { flex-shrink: 0; width: 16px; height: 16px; margin-top: 3px; }
.auth-note p { margin: 0; font-size: 12px; line-height: 1.9; }
.auth-note span { font-size: 11px; }
.auth-footer { flex-shrink: 0; text-align: center; color: var(--color-text-secondary); font-size: 11px; letter-spacing: 2px; }
.auth-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.auth-spinner { width: 14px; height: 14px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: auth-spin .8s linear infinite; }
@keyframes auth-spin { to { transform: rotate(360deg); } }
@keyframes auth-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .auth-content { background: rgb(18 18 20 / 68%); -webkit-backdrop-filter: blur(22px) saturate(125%); backdrop-filter: blur(22px) saturate(125%); }
}
@media (prefers-reduced-transparency: reduce) {
  .auth-content { background: rgb(20 20 22 / 94%); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
:global(html[data-transparency='reduced']) .auth-content { background: rgb(20 20 22 / 94%); -webkit-backdrop-filter: none; backdrop-filter: none; }
@media (max-width: 640px) {
  .auth-page { padding: 24px 16px 20px; gap: 28px; }
  .auth-content { width: min(420px, calc(100vw - 32px)); padding: 28px 22px; }
  .auth-brand { font-size: 10px; letter-spacing: 1.4px; }
}
@media (hover: hover) and (pointer: fine) {
  input:hover:not(:focus):not([aria-invalid='true']) { border-color: rgb(245 245 247 / 16%); }
  .password-toggle:hover { background: var(--color-hover); color: var(--color-text-primary); }
  .auth-submit:hover:not(:disabled) { background: #dedee3; }
  .auth-switch a:hover { text-decoration: underline; text-underline-offset: 4px; }
}
@media (prefers-reduced-motion: reduce) {
  input, .auth-submit { transition: none; }
  .auth-spinner { animation: none; }
  .auth-content { animation: none; }
}
</style>
