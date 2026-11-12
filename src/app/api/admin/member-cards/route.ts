/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** App 管理端（appadmin）地址与令牌，卡密数据的唯一权威 */
const BASE = process.env.MTV_LIC_BASE || 'http://172.19.0.1:8099';
const TOKEN = process.env.MTV_CARD_TOKEN || '';

/** 只有站长本人可以管理卡密 */
async function ensureOwner(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authInfo.username !== process.env.USERNAME) {
    return NextResponse.json({ error: '只有站长可以管理卡密' }, { status: 403 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: '未配置 MTV_CARD_TOKEN，请在容器环境变量里补上' },
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

export async function GET(request: NextRequest) {
  const denied = await ensureOwner(request);
  if (denied) return denied;
  try {
    const out = await callAdmin(`/cards?k=${encodeURIComponent(TOKEN)}`);
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { ok: false, error: '连不上 App 管理端（8099），请确认 appadmin 在跑' },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await ensureOwner(request);
  if (denied) return denied;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式不对' }, { status: 400 });
  }

  const action = String(body.action || '');
  const q = `?k=${encodeURIComponent(TOKEN)}`;
  try {
    switch (action) {
      case 'gen': {
        const out = await callAdmin(`/card/gen${q}`, {
          count: Number(body.count || 1),
          days: Number(body.days || 30),
          label: String(body.label || ''),
          note: String(body.note || ''),
        });
        return NextResponse.json(out);
      }
      case 'revoke':
        return NextResponse.json(
          await callAdmin(`/card/revoke${q}`, { code: body.code })
        );
      case 'update':
        return NextResponse.json(
          await callAdmin(`/card/update${q}`, {
            code: body.code,
            ...(body.days ? { days: Number(body.days) } : {}),
            ...(body.label ? { label: String(body.label) } : {}),
          })
        );
      case 'del':
        return NextResponse.json(
          await callAdmin(`/card/del${q}`, { code: body.code })
        );
      default:
        return NextResponse.json(
          { ok: false, error: '不支持的操作' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: '连不上 App 管理端（8099）' },
      { status: 502 }
    );
  }
}
