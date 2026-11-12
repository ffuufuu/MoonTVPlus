import { NextResponse } from 'next/server';

import { deviceIdOf, fetchLicense, licenseEnabled } from '@/lib/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 生成/读取网页侧设备号，并返回当前授权状态 */
export async function GET(request: Request) {
  let dev = deviceIdOf(request);
  const generated = !dev;
  if (!dev) {
    dev = 'web-' + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
  }
  const lic = licenseEnabled() ? await fetchLicense(dev) : null;
  const res = NextResponse.json({
    ok: true,
    dev,
    enabled: licenseEnabled(),
    pay_enabled: lic?.payEnabled ?? false,
    state: lic?.state ?? 'unknown',
    level: lic?.level ?? '',
    days_left: lic?.daysLeft ?? 0,
    grace_left: lic?.graceLeft ?? 0,
    expire: lic?.expire ?? 0,
  });
  if (generated) {
    res.cookies.set('mtv_dev', dev, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
    });
  }
  return res;
}
