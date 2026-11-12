/**
 * 会员（卡密）校验 —— 唯一数据源在 appadmin（管理端那套 cards.json）
 * 站点只负责“问一句”，不存自己的卡密表。
 *
 * 环境变量：
 *   MTV_LIC_ENABLED=1        开启校验（默认 0 = 完全不影响现有站内行为）
 *   MTV_LIC_BASE             appadmin 地址，默认 http://172.19.0.1:8099
 *   MTV_LIC_FAIL_OPEN=0      appadmin 挂了时是否放行（默认 1 放行，0 拦截）
 *   MTV_LIC_CACHE_MS         授权结果缓存，默认 60000
 */

import { NextResponse } from 'next/server';

export type License = {
  state: string;
  level: string;
  payEnabled: boolean;
  expire: number;
  daysLeft: number;
  graceLeft: number;
};

const BASE = process.env.MTV_LIC_BASE || 'http://172.19.0.1:8099';
const CACHE_MS = Number(process.env.MTV_LIC_CACHE_MS || 60000);
const FAIL_OPEN = process.env.MTV_LIC_FAIL_OPEN !== '0';
/** 演示/强制模式：即使后端 pay_enabled=false（全站免费），也按“必须有卡”处理 */
const REQUIRE_PAY = process.env.MTV_LIC_REQUIRE_PAY === '1';

export function licenseEnabled(): boolean {
  return process.env.MTV_LIC_ENABLED === '1';
}

const cache = new Map<string, { at: number; value: License | null }>();

/** 设备号：cookie 优先（网页 / App 的 WebView 都会带上），其次请求头，最后 query */
export function deviceIdOf(request: Request): string {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)mtv_dev=([^;]+)/);
  if (m && m[1]) {
    return decodeURIComponent(m[1]).trim();
  }
  const header = request.headers.get('x-mtv-dev');
  if (header && header.trim()) {
    return header.trim();
  }
  try {
    const q = new URL(request.url).searchParams.get('dev');
    if (q && q.trim()) {
      return q.trim();
    }
  } catch {
    // ignore
  }
  return '';
}

/** 问 appadmin：这个设备现在能不能看 */
export async function fetchLicense(dev: string): Promise<License | null> {
  if (!dev) {
    return null;
  }
  const hit = cache.get(dev);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.value;
  }
  let value: License | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${BASE}/auth?dev=${encodeURIComponent(dev)}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.json();
      value = {
        state: String(body.state || ''),
        level: String(body.level || ''),
        payEnabled: Boolean(body.pay_enabled),
        expire: Number(body.expire || 0),
        daysLeft: Number(body.days_left || 0),
        graceLeft: Number(body.grace_left || 0),
      };
    }
  } catch {
    value = null;
  }
  cache.set(dev, { at: Date.now(), value });
  return value;
}

export type Gate = { ok: boolean; reason?: string; license?: License };

/** 统一入口：所有“需要会员”的地方都调它 */
export async function checkEntitlement(request: Request): Promise<Gate> {
  if (!licenseEnabled()) {
    return { ok: true };
  }
  const dev = deviceIdOf(request);
  if (!dev) {
    return { ok: false, reason: 'no-device' };
  }
  const lic = await fetchLicense(dev);
  if (!lic) {
    return FAIL_OPEN
      ? { ok: true, reason: 'license-unreachable' }
      : { ok: false, reason: 'license-unreachable' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const expire = Number((lic as any).expire || 0);
  const graceDays = Number((lic as any).grace_days || 0);
  // 后台 pay_enabled=false 时 state 恒为 free，即便设备有卡；因此以 expire 为准
  if (expire > nowSec) return { ok: true, license: lic };
  if (expire > 0 && expire + graceDays * 86400 > nowSec) {
    return { ok: true, reason: 'grace', license: lic };
  }
  if (lic.state === 'expired') {
    return { ok: false, reason: 'expired', license: lic };
  }
  if (lic.state === 'free' && REQUIRE_PAY) {
    return { ok: false, reason: 'no-card', license: lic };
  }
  return { ok: true, license: lic };
}

/** 被拦时的标准响应：402，前端可识别 */
export function blocked(message: string, reason: string) {
  return NextResponse.json(
    { error: message, reason, need_card: true },
    { status: 402 }
  );
}


/** 路由里一行调用：不通过就直接 return 它 */
export async function requireEntitlement(
  request: Request
): Promise<Response | null> {
  const gate = await checkEntitlement(request);
  if (gate.ok) return null;
  const msg =
    gate.reason === 'expired'
      ? '会员已过期，请续费后观看'
      : gate.reason === 'no-device'
        ? '请先打开会员页激活卡密'
        : '请先在会员页激活卡密';
  return blocked(msg, gate.reason);
}
