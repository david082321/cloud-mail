# Cloud Mail Chrome 擴充功能

`mail-extension` 是 Cloud Mail 的 Manifest V3 正式版 Chrome 擴充功能，提供多信箱瀏覽、未讀徽章、Web Push 即時通知、純文字郵件檢視、快速寄信、信件刪除、裝置撤銷及可持續顯示的獨立小視窗。

## 伺服器設定

1. 在 `mail-worker` 產生一次性的 VAPID 金鑰組：

   ```powershell
   pnpm exec web-push generate-vapid-keys
   ```

2. 將公鑰及聯絡資訊設定成 Worker 變數：

   ```toml
   [vars]
   VAPID_PUBLIC_KEY = "..."
   VAPID_SUBJECT = "mailto:admin@example.com"
   ```

3. 私鑰只能使用 Cloudflare Secret，不可寫入設定檔或版本控制：

   ```powershell
   pnpm wrangler secret put VAPID_PRIVATE_KEY
   ```

4. GitHub Actions 部署會直接對遠端 D1 套用 `mail-worker/migrations`；手動部署仍須執行既有 `/api/init/{jwt_secret}` 初始化流程。

## 本機安裝

1. 執行 `node scripts/validate.mjs`、`node --test test/api.test.js test/package.test.js test/window.test.js` 與 `node scripts/package.mjs`。
2. 開啟 `chrome://extensions` 並啟用「開發人員模式」。
3. 選擇「載入未封裝項目」，指定本 `mail-extension` 資料夾。
4. 開啟工具列圖示，輸入 Cloud Mail HTTPS 網址及帳號密碼。密碼只用於建立裝置工作階段，不會保存在擴充功能儲存空間。
5. 按右上角的「↗」可開啟 `640 × 650` 獨立小視窗；再次按下會聚焦既有視窗並套用目前預設尺寸。

信件刪除必須在連結帳號時勾選刪除授權，且伺服器端使用者需具備 `email:delete` 權限；既有裝置工作階段需中斷後重新連結，才會取得新增的 `mail.delete` scope。

## GitHub Actions 自動建構

- 每次分支推送與 Pull Request 都會驗證、測試並建立 `cloud-mail-extension-<版本>.zip`，可從該次 Actions 執行的 Artifacts 下載，保留 30 天。
- ZIP 只包含 Chrome 執行時需要的 `manifest.json`、`src`、`icons` 與 `_locales`，不包含測試或開發腳本。
- 推送 `extension-v<版本>` 標籤時，標籤版本必須和 `manifest.json` 完全相同；Actions 會建立或更新同名 GitHub Release，並附加相同 ZIP。

例如 `manifest.json` 為 `1.2.0` 時：

```powershell
git tag extension-v1.2.0
git push origin extension-v1.2.0
```

也可在 Actions 頁面手動執行 **Validate Chrome extension**，建立目前版本的 Artifact，但手動執行不會建立 GitHub Release。

正式上架 Chrome Web Store 前，請固定擴充功能 ID、補齊商店隱私權說明，並以實際部署環境驗證 Web Push、背景喚醒與作業系統通知。
