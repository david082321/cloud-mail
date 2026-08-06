import i18next from 'i18next';
import zh from './zh.js'
import zhTW from './zh-TW.js'
import en from './en.js'

export function normalizeLocale(locale) {
    if (!locale) return 'zh-CN'

    const normalized = locale.split(',')[0].trim().replace('_', '-').toLowerCase()
    if (normalized === 'zh') return 'zh-CN'
    if (normalized.startsWith('zh-')) {
        return /(?:^|-)(?:tw|hk|mo|hant)(?:-|$)/.test(normalized) ? 'zh-TW' : 'zh-CN'
    }
    return normalized.startsWith('en') ? 'en' : 'zh-CN'
}

export async function i18nMiddleware(c, next) {
	const lang = normalizeLocale(c.req.header('accept-language'))
	c.set('locale', lang)
	await i18next.changeLanguage(lang)
	return await next()
}

const resources = {
	en: {
		translation: en
	},
	'zh-CN': {
		translation: zh,
	},
	'zh-TW': {
		translation: zhTW,
	},
};

await i18next.init({
	lng: 'zh-CN',
	fallbackLng: 'zh-CN',
	supportedLngs: ['zh-CN', 'zh-TW', 'en'],
	resources,
});

export const t = (key, values) => i18next.t(key, values)

export default i18next;
