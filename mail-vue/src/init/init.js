import {useUserStore} from "@/store/user.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {loginSession} from "@/request/login.js";
import {permsToRouter} from "@/perm/perm.js";
import router from "@/router";
import {websiteConfig} from "@/request/setting.js";
import i18n from "@/i18n/index.js";
import {detectBrowserLocale, normalizeLocale} from "@/i18n/locale.js";

export async function init() {
    document.title = '\u200B'

    const settingStore = useSettingStore();
    const userStore = useUserStore();
    const accountStore = useAccountStore();

    localStorage.removeItem('token');
    settingStore.lang = normalizeLocale(settingStore.lang) || detectBrowserLocale()

    i18n.global.locale.value = settingStore.lang

    let setting = null;

    const userPromise = loginSession({noMsg: true}).catch(() => null);
    const [s, user] = await Promise.all([websiteConfig(), userPromise]);
    setting = s;
    settingStore.settings = setting;
    settingStore.domainList = setting.domainList;
    document.title = setting.title;

    if (user) {
        accountStore.currentAccountId = user.account.accountId;
        accountStore.currentAccount = user.account;
        userStore.user = user;

        const routers = permsToRouter(user.permKeys);
        routers.forEach(routerData => {
            router.addRoute('layout', routerData);
        });
    }
}
