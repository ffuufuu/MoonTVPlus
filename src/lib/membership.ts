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
  if (lic.state === 'expired') {
    return { ok: false, reason: 'expired', license: lic };
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
