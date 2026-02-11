# Cloudflare Worker: 根路径按国家分发语言

将用户访问 `example.com/` 或 `example.com/index.html` 时，按地理位置重定向到对应语言子目录。

## 部署步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧 **Workers & Pages** → **Create** → **Create Worker**
3. 将 `geo-redirect.js` 内容粘贴到编辑器中（替换默认代码）
4. **Save and Deploy**
5. 进入 Worker 详情 → **Settings** → **Triggers** → **Add route**
   - Route: `your-domain.com/*`（例如 `imgtools365.com/*`）
   - Zone: 选择对应域名
6. 保存

## 行为说明

| 请求路径              | 行为                         |
|-----------------------|------------------------------|
| `/`                   | 按国家重定向到语言子目录     |
| `/index.html`         | 同上                         |
| `/en/`、`/de-DE/` 等  | 直接透传（不再重定向）       |
| `/pages/*`、`/assets/*` | 直接透传                   |
| Bot 请求              | 不重定向（SEO 友好）         |

## 用户语言记忆（可选）

前端语言切换时写入 cookie，下次优先使用：

```javascript
document.cookie = `locale=de-DE; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
```

## 国家与语言对应

- **简中**：CN → `/zh-CN/`
- **繁中**：TW, HK, MO → `/zh-TW/`
- **英文**：US, GB, CA, AU, NZ 等 → `/en/`
- **日韩**：JP → `/ja-JP/`，KR → `/ko-KR/`
- **西语**：ES → `/es-ES/`，MX/AR/CL 等拉美 → `/es-MX/`
- **其他**：见 `COUNTRY_TO_LOCALE`，未命中默认 `/en/`
