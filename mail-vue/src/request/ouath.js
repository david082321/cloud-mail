import http from '@/axios/index.js';

export function oauthLinuxDoLogin(code, codeVerifier) {
    return http.post('/oauth/linuxDo/login',{code, codeVerifier})
}

export function oauthBindUser(form) {
    return http.put('/oauth/bindUser', form)
}
