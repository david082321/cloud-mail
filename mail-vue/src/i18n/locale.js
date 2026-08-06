export const DEFAULT_LOCALE = 'zh-CN'
export const SUPPORTED_LOCALES = ['zh-TW', 'zh-CN', 'en']

export function normalizeLocale(locale) {
    if (!locale) {
        return null
    }

    const normalized = locale.replace('_', '-').toLowerCase()

    if (normalized === 'zh') {
        return 'zh-CN'
    }

    if (normalized.startsWith('zh-')) {
        return /(?:^|-)(?:tw|hk|mo|hant)(?:-|$)/.test(normalized) ? 'zh-TW' : 'zh-CN'
    }

    return normalized.startsWith('en') ? 'en' : null
}

export function detectBrowserLocale(languages = navigator.languages) {
    for (const language of languages || []) {
        const locale = normalizeLocale(language)
        if (locale) {
            return locale
        }
    }

    return languages?.length ? 'en' : DEFAULT_LOCALE
}

export function toDayjsLocale(locale) {
    if (locale === 'zh-TW') {
        return 'zh-tw'
    }

    return locale === 'en' ? 'en' : 'zh-cn'
}

export function toTinyMceLocale(locale) {
    if (locale === 'zh-TW') {
        return 'zh_TW'
    }

    return locale === 'zh-CN' ? 'zh_CN' : 'en'
}
