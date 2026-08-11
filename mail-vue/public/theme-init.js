try {
  const uiStoreStr = localStorage.getItem('ui')
  if (uiStoreStr) {
    const uiStore = JSON.parse(uiStoreStr)
    const root = document.documentElement
    root.setAttribute('class', uiStore.dark ? 'dark' : '')
    const metaTag = document.getElementById('theme-color-meta')
    const isMobile = !window.matchMedia('(pointer: fine) and (hover: hover)').matches
    metaTag?.setAttribute('content', uiStore.dark ? (isMobile ? '#141414' : '#000000') : (isMobile ? '#FFFFFF' : '#F1F1F1'))
  }
} catch {
  localStorage.removeItem('ui')
}
