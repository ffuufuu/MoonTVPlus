# PATCH 说明：站点会员（卡密）系统

> 改动原则：**只加不改核心**。全部功能由 `MTV_LIC_ENABLED` 开关控制，默认关闭时与上游行为完全一致。
> 数据唯一权威在 appadmin（管理端的 `cards.json`），站点不存卡密表。

## 改了哪些文件（共 6 个，新增 4 + 修改 2）

| 文件 | 类型 | 作用 |
|---|---|---|
| `src/lib/membership.ts` | 新增 | 会员校验核心：读设备号 → 问 appadmin `/auth` → 60 秒缓存 |
| `src/app/api/member/status/route.ts` | 新增 | 返回当前设备授权状态；没有设备号时自动生成 cookie |
| `src/app/api/member/redeem/route.ts` | 新增 | 兑换卡密，转发给 appadmin `/redeem`（唯一权威） |
| `src/app/member/page.tsx` | 新增 | 站内「会员激活」页：输卡密、看剩余天数 |
| `src/app/api/proxy-m3u8/route.ts` | 修改（2 行 import + 6 行校验） | **流入口**：没卡不给 m3u8 |
| `src/app/api/video-proxy/route.ts` | 修改（2 行 import + 6 行校验） | **流入口**：没卡不给视频分片 |

## 环境变量

```bash
MTV_LIC_ENABLED=1                # 0/不设 = 完全关闭，站内行为与上游一致
MTV_LIC_BASE=http://172.19.0.1:8099   # appadmin 地址（同机 docker 网关）
MTV_LIC_FAIL_OPEN=1              # 1 = appadmin 挂了放行（保站点可用），0 = 拦截
MTV_LIC_CACHE_MS=60000           # 授权结果缓存毫秒，默认 60 秒
```

## 身份怎么带

- 网页：进 `/member` 时自动生成 `mtv_dev` cookie（HttpOnly，一年）
- App（WebView）：加载站点前 `CookieManager.setCookie("nova.550556.xyz", "mtv_dev=<设备号>")`，或请求头带 `x-mtv-dev`，或 URL 带 `?dev=`
- 优先级：cookie > 请求头 > query

## 授权判定

| appadmin `/auth` 返回的 state | 站点行为 |
|---|---|
| `ok` / `trial` / `grace` / `free` | 放行 |
| `expired` | 402 + 「会员已过期，请续费后观看」 |
| 无设备号 | 402 + 「请先在会员页激活卡密」 |
| appadmin 不可达 | 按 `MTV_LIC_FAIL_OPEN` 决定放行或拦截 |

## 已知边界（下一阶段再补）

1. **直连源**：如果某个播放源由站点前端直接访问（不走 `/api/proxy-m3u8`），这道闸拦不到。需要时在 `/play` 页或播放器组件里加一次 `checkEntitlement`。
2. **直播**（`/api/proxy/m3u8`、`/api/proxy/segment`）暂未接入，需要时同样加 6 行。
3. 网页侧目前是“设备号”而非“账号”，换浏览器会换号；要跨设备同一会员需改成账号绑定。

## 回滚

把 `MTV_LIC_ENABLED` 改成 `0` 重启容器即可，代码不用回退。
