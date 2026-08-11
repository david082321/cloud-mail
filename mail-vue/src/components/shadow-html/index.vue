<template>
  <div class="content-box">
    <iframe
      class="content-html"
      :srcdoc="documentHtml"
      sandbox
      referrerpolicy="no-referrer"
      :title="$t('message')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  html: {
    type: String,
    required: true
  }
})

const documentHtml = computed(() => `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src https: data:; form-action 'none'; frame-src 'none'; base-uri 'none'">
<meta name="referrer" content="no-referrer">
<style>
html,body{margin:0;padding:0;background:#fff;color:#13181d;font:14px/1.5 -apple-system,Inter,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;word-break:break-word}
body{padding:1px}img{max-width:100%;height:auto}table{max-width:100%}a{color:#0e70df}
</style></head><body>${props.html || ''}</body></html>`)
</script>

<style scoped>
.content-box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, Inter, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
}

.content-html {
  display: block;
  border: 0;
  width: 100%;
  height: 100%;
}
</style>
