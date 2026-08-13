<template>
  <emailScroll ref="trashScroll"
               type="trash"
               :get-email-list="getEmailList"
               :email-delete="emailPermanentDelete"
               :email-restore="emailRestore"
               :show-star="false"
               show-status
               action-left="4px"
               @jump="jumpContent"
               :time-sort="params.timeSort"
  >
    <template #first>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
            v-if="params.timeSort === 0" width="28" height="28"/>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
            width="28" height="28"/>
    </template>
  </emailScroll>
</template>

<script setup>
import {defineOptions, reactive, ref, watch} from 'vue'
import {Icon} from '@iconify/vue'
import emailScroll from '@/components/email-scroll/index.vue'
import {emailPermanentDelete, emailRestore, trashList} from '@/request/email.js'
import {useAccountStore} from '@/store/account.js'
import {useEmailStore} from '@/store/email.js'
import router from '@/router/index.js'

defineOptions({
  name: 'trash'
})

const accountStore = useAccountStore()
const emailStore = useEmailStore()
const trashScroll = ref({})
const params = reactive({
  timeSort: 0
})

watch(() => [accountStore.currentAccountId, accountStore.currentAccount.allReceive], () => {
  trashScroll.value.refreshList()
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  trashScroll.value.refreshList()
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'trash'
  emailStore.contentData.showUnread = false
  emailStore.contentData.showStar = false
  emailStore.contentData.showReply = false
  router.push('/message')
}

function getEmailList(emailId, size) {
  const accountId = accountStore.currentAccountId
  const allReceive = accountStore.currentAccount.allReceive
  return trashList(accountId, allReceive, emailId, params.timeSort, size).then(data => {
    data.latestEmail.reqAccountId = accountId
    data.latestEmail.allReceive = allReceive
    return data
  })
}
</script>

<style scoped>
.icon {
  cursor: pointer;
}
</style>
