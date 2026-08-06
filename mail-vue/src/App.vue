<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>
<script setup>
import { useI18n } from "vue-i18n";
import { computed, watch } from "vue";
import {useSettingStore} from "@/store/setting.js";
const settingStore = useSettingStore()
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import zhTw from 'element-plus/es/locale/lang/zh-tw';
import('@/icons/index.js')
const { locale } = useI18n()
const elementLocale = computed(() => {
  if (settingStore.lang === 'zh-TW') {
    return zhTw
  }

  return settingStore.lang === 'zh-CN' ? zhCn : undefined
})
function applyLocale(lang) {
  locale.value = lang
  document.documentElement.lang = lang
}

applyLocale(settingStore.lang)
watch(() => settingStore.lang, applyLocale)
</script>
