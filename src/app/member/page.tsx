'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type Status = {
  ok?: boolean;
  dev?: string;
  enabled?: boolean;
  pay_enabled?: boolean;
  state?: string;
  level?: string;
  days_left?: number;
  grace_left?: number;
  expire?: number;
};

const CARD_WRAP: CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
};

export default function MemberPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/member/status', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data);
    } catch {
      setMsg('读取会员状态失败');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async () => {
    if (busy || !code.trim()) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/member/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        const exp = data.expire
          ? new Date(data.expire * 1000).toLocaleDateString('zh-CN')
          : '';
        setMsg(`激活成功：${data.label}${exp ? `，到期 ${exp}` : ''}`);
        setCode('');
        load();
      } else {
        setMsg(data.error || '激活失败');
      }
    } catch {
      setMsg('网络错误，请重试');
    } finally {
      setBusy(false);
    }
  };

  const stateText = () => {
    if (!status) return '读取中…';
    if (!status.enabled) return '本站暂未开启会员校验';
    if (!status.pay_enabled) return '当前全站免费（收费开关未开）';
    switch (status.state) {
      case 'ok':
        const left = status.expire
          ? Math.max(0, Math.ceil((status.expire * 1000 - Date.now()) / 86400000))
          : status.days_left || 0;
        return `会员有效，剩余 ${left} 天`;
      case 'trial':
        return `试用中，剩余 ${status.days_left} 天`;
      case 'grace':
        return `已到期，缓冲 ${status.grace_left} 天`;
      case 'expired':
        return '会员已过期';
      case 'free':
        return '免费使用';
      default:
        return '未激活';
    }
  };

  return (
    <div style={{ padding: '40px 20px', minHeight: '100vh' }}>
      <div style={CARD_WRAP}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          会员激活
        </h1>
        <p style={{ color: '#8a87a2', fontSize: 13, marginBottom: 20 }}>
          卡密与 App 通用，一张卡两边都能用
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#8a87a2', marginBottom: 6 }}>
            当前状态
          </div>
          <div style={{ fontSize: 15 }}>{stateText()}</div>
          {status?.dev ? (
            <div style={{ fontSize: 11, color: '#5f5d74', marginTop: 8 }}>
              本页设备号：{status.dev}
            </div>
          ) : null}
        </div>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="输入卡密，例如 MTP-1234-5678-ABCD"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            color: 'inherit',
            fontSize: 14,
            outline: 'none',
          }}
        />

        <button
          onClick={redeem}
          disabled={busy}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '13px 0',
            borderRadius: 12,
            border: 'none',
            background: busy ? '#3a3850' : '#6d5bff',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? '正在激活…' : '激活'}
        </button>

        {msg ? (
          <div style={{ marginTop: 14, fontSize: 13, color: '#c9c6e0' }}>{msg}</div>
        ) : null}
      </div>
    </div>
  );
}
