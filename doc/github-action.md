## Github Action 部署

**配置 Github 仓库**

1. Fork 或克隆仓库 [https://github.com/eoao/cloud-mail](https://github.com/eoao/cloud-mail)
2. 进入您的 GitHub 仓库设置
3. 转到 Settings → Secrets and variables → Actions → New Repository secrets
4. 添加以下 Secrets：

| Secret 名称             | 必需 | 用途                                                  |
| ----------------------- | :--: | ----------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  |  ✅  | Cloudflare API 令牌（需要 Workers 和相关资源权限）    |
| `CLOUDFLARE_ACCOUNT_ID` |  ✅  | Cloudflare 账户 ID                                    |
| `D1_DATABASE_ID`        |  ✅  | 您的 D1 数据库的 ID                                     |
| `KV_NAMESPACE_ID`       |  ✅  | 您的 KV 命名空间的 ID                                   |
| `R2_BUCKET_NAME`        |  ✅  | 您的 R2 存储桶的名称                                    |
| `DOMAIN`                |  ✅  | 您要用于邮件服务的域名（例如 `["xx.xx"]，多域名用,分隔`）        |
| `ADMIN`                 |  ✅  | 您的管理员邮箱地址（例如 `admin@example.com`）      |
| `JWT_SECRET`            |  ✅  | 用于生成和验证 JWT 的随机长字符串                     |
| `VAPID_PUBLIC_KEY`      |  ❌  | Chrome 扩展 Web Push 公钥；启用实时通知时必需          |
| `VAPID_PRIVATE_KEY`     |  ❌  | Chrome 扩展 Web Push 私钥；只能保存为 GitHub Secret    |
| `VAPID_SUBJECT`         |  ❌  | Web Push 联系方式，例如 `mailto:admin@example.com`      |
| `INIT_URL`              |  ❌  | （可选）部署后用于初始化数据库的 Worker URL（格式参考下述手动初始化）           |

---

**获取 Cloudflare API 令牌**

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. 创建新的 API 令牌
3. 选择"编辑 Cloudflare Workers"模板，并参照下表添加相应权限
   ![dc2e1dc8dcd217644759c46c6c705de1](https://i.miji.bid/2025/07/07/dc2e1dc8dcd217644759c46c6c705de1.png)
4. 保存令牌并复制到 GitHub Secrets 中的 `CLOUDFLARE_API_TOKEN`

**获取 Cloudflare 账户 ID**
1. 账户 ID 可以在 Cloudflare 仪表盘的账户设置中找到。
2. 复制到 GitHub Secrets 中的 `CLOUDFLARE_ACCOUNT_ID`

**运行工作流**
1. 然后在Action页面手动运行工作流，后续同步上游后会自动部署到 Cloudflare Workers。部署后会通过 Wrangler 直接对配置的远端 D1 套用 `mail-worker/migrations`，再执行既有的 Worker 初始化流程。
2. 自动同步上游可使用bot或者手动点击Sync Upstream按钮。

---

**构建 Chrome 扩展**

1. 分支推送时，`Validate Chrome extension` 工作流会验证、测试并构建 `cloud-mail-extension-<版本>.zip`，结果可从该次运行的 Artifacts 下载并保留 30 天。
2. Pull Request 也会执行相同检查及构建。
3. 若要发布正式版，请先确认 `mail-extension/manifest.json` 的 `version`，再推送完全匹配的 `extension-v<版本>` 标签。工作流会自动建立 GitHub Release，并附加相同的 ZIP；标签版本不匹配时会停止发布。

例如版本为 `1.1.0`：

```powershell
git tag extension-v1.1.0
git push origin extension-v1.1.0
```
