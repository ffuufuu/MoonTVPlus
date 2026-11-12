/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.MTV_LIC_BASE || 'http://172.19.0.1:8099';
const TOKEN = process.env.MTV_CARD_TOKEN || '';

async function ensureOwner(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authInfo.username !== process.env.USERNAME) {
    return NextResponse.json({ error: '只有站长可以操作会员设置' }, { status: 403 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: '未配置 MTV_CARD_TOKEN' },
      { status: 500 }
    );
  }
  return null;
}

async function callAdmin(path: string, body?: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 读取会员设置 + 全部设备 */
export async function GET(request: NextRequest) {
  const denied = await ensureOwner(request);
  if (denied) return denied;
  try {
    const out = await callAdmin(`/cfg?k=${encodeURIComponent(TOKEN)}`);
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { ok: false, error: '连不上 App 管理端（8099）' },
      { status: 502 }
    );
  }
}

/** 保存设置 / 操作设备 */
export async function POST(request: NextRequest) {
  const denied = await ensureOwner(request);
  if (denied) return denied;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式不对' }, { status: 400 });
  }

  const q = `?k=${encodeURIComponent(TOKEN)}`;
  try {
    if (body.action === 'save_cfg') {
      const c = body.cfg || {};
      const patch: any = {};
      if ('pay_enabled' in c) patch.pay_enabled = !!c.pay_enabled;
      if ('trial_days' in c) patch.trial_days = Number(c.trial_days) || 0;
      if ('card_notice' in c) patch.card_notice = String(c.card_notice || '');
      if ('notice' in c) patch.notice = String(c.notice || '');
      return NextResponse.json(await callAdmin(`/cfg${q}`, patch));
    }
    if (body.action === 'device') {
      const patch: any = { id: String(body.id || '') };
      if ('blocked' in body) patch.blocked = !!body.blocked;
      if ('name' in body) patch.name = String(body.name || '');
      if (body.unbind) patch.unbind = true;
      if (body.clear) patch.clear = true;
      return NextResponse.json(await callAdmin(`/device${q}`, patch));
    }
    return NextResponse.json(
      { ok: false, error: '不支持的操作' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: '连不上 App 管理端（8099）' },
      { status: 502 }
    );
  }
}
