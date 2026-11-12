import { NextResponse } from 'next/server';

import { deviceIdOf, fetchLicense, licenseEnabled } from '@/lib/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.MTV_LIC_BASE || 'http://172.19.0.1:8099';

/** 兑换卡密：把卡密提交给 appadmin（唯一权威），成功后返回授权 */
export async function POST(request: Request) {
  if (!licenseEnabled()) {
    return NextResponse.json(
      { ok: false, error: '本站暂未开启会员校验（MTV_LIC_ENABLED=0）' },
      { status: 400 }
    );
  }
  let code = '';
  try {
    const body = await request.json();
    code = String(body.code || '').trim();
  } catch {
    // ignore
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: '请输入卡密' }, { status: 400 });
  }
  const dev = deviceIdOf(request);
  if (!dev) {
    return NextResponse.json(
      { ok: false, error: '设备标识缺失，请刷新页面后重试' },
      { status: 400 }
    );
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BASE}/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, dev }),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    const out = await res.json();
    if (!out || out.ok !== true) {
      return NextResponse.json(
        { ok: false, error: String(out?.err || out?.error || '卡密无效或已使用') },
        { status: 400 }
      );
    }
    const lic = await fetchLicense(dev);
    const done = NextResponse.json({
      ok: true,
      label: out.label || String(out.days || '') + ' 天',
      expire: out.expire || 0,
      state: lic?.state || 'ok',
      days_left: lic?.daysLeft || 0,
    });
    done.cookies.set('mtv_dev', dev, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
    });
    return done;
  } catch {
    return NextResponse.json(
      { ok: false, error: '会员服务暂时不可用，请稍后再试' },
      { status: 503 }
    );
  }
}
