<template>
  <div ref="container">
    <span v-if="loadFailed" class="turnstile-error">{{ $t('verifyModuleFailed') }}</span>
  </div>
</template>

<script setup>
import {nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'

const props = defineProps({
  siteKey: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['verified', 'expired', 'error'])
const container = ref(null)
const loadFailed = ref(false)
let widgetId = null
let retryTimer = null
let retryCount = 0

function clearRetryTimer() {
  if (retryTimer) {
    window.clearTimeout(retryTimer)
    retryTimer = null
  }
}

function removeWidget() {
  clearRetryTimer()
  if (widgetId !== null && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
  widgetId = null
}

function renderWhenReady() {
  if (!props.siteKey || !container.value || widgetId !== null) return

  if (!window.turnstile) {
    if (retryCount >= 30) {
      loadFailed.value = true
      return
    }
    retryCount += 1
    retryTimer = window.setTimeout(renderWhenReady, 250)
    return
  }

  try {
    widgetId = window.turnstile.render(container.value, {
      sitekey: props.siteKey,
      callback(token) {
        emit('verified', token)
      },
      'expired-callback'() {
        emit('verified', '')
        emit('expired')
      },
      'error-callback'(error) {
        emit('verified', '')
        emit('error', error)
      }
    })
  } catch (error) {
    loadFailed.value = true
    emit('error', error)
  }
}

function reset() {
  emit('verified', '')
  if (widgetId !== null && window.turnstile) {
    window.turnstile.reset(widgetId)
  }
}

watch(() => props.siteKey, async () => {
  removeWidget()
  retryCount = 0
  loadFailed.value = false
  await nextTick()
  renderWhenReady()
})

onMounted(renderWhenReady)
onBeforeUnmount(removeWidget)

defineExpose({reset})
</script>

<style scoped>
.turnstile-error {
  color: #f56c6c;
  font-size: 12px;
}
</style>
