'use client';

import { Ban, RefreshCw, Save, Unlock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DeviceRec {
  name?: string;
  blocked?: boolean;
  expire?: number;
  card?: string;
  first_seen?: number;
  updated_at?: number;
}

export default function MemberSettingsConfig() {
  const [cfg, setCfg] = useState<any>({});
  const [devices, setDevices] = useState<Record<string, DeviceRec>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/member-config', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setMsg(data.error || data.err || '读取失败');
        return;
      }
      setCfg(data.cfg || {});
      setDevices(data.devices || {});
      setMsg('');
    } catch {
      setMsg('读取会员设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: any) => {
    const res = await fetch('/api/admin/member-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const save = async () => {
    setLoading(true);
    try {
      const out = await post({
        action: 'save_cfg',
        cfg: {
          pay_enabled: !!cfg.pay_enabled,
          trial_days: Number(cfg.trial_days || 0),
          card_notice: cfg.card_notice || '',
          notice: cfg.notice || '',
        },
      });
      if (out.ok === false) setMsg(out.error || out.err || '保存失败');
      else {
        setSaved('已保存');
        setTimeout(() => setSaved(''), 1500);
        await load();
      }
    } finally {
      setLoading(false);
    }
  };

  const deviceOp = async (id: string, body: Record<string, unknown>) => {
    const out = await post({ action: 'device', id, ...body });
    if (out.ok === false) setMsg(out.error || out.err || '操作失败');
    await load();
  };

  const now = Math.floor(Date.now() / 1000);
  const daysLeft = (exp: number) =>
    exp > 0 ? Math.max(0, Math.ceil((exp - now) / 86400)) : 0;

  const rows = Object.entries(devices)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

  return (
    <div className='space-y-4'>
      {msg && (
        <div className='rounded bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600'>
          {msg}
        </div>
      )}

      {/* 收费开关 / 试用 / 公告 */}
      <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3'>
        <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
          会员规则
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <div className='text-sm text-gray-800 dark:text-gray-200'>
              开启收费验证
            </div>
            <div className='text-xs text-gray-500'>
              关闭时所有人免费；开启后没卡、过期都不能播放
            </div>
          </div>
          <button
            onClick={() => setCfg((c: any) => ({ ...c, pay_enabled: !c.pay_enabled }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              cfg.pay_enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                cfg.pay_enabled ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-700 dark:text-gray-300'>
            新设备试用
          </span>
          <input
            type='number'
            min={0}
            max={365}
            value={cfg.trial_days ?? 0}
            onChange={(e) =>
              setCfg((c: any) => ({ ...c, trial_days: Number(e.target.value) || 0 }))
            }
            className='w-20 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
          />
          <span className='text-xs text-gray-500'>天（0 = 不试用）</span>
        </div>

        <div className='space-y-1'>
          <div className='text-sm text-gray-700 dark:text-gray-300'>
            卡密提示语（会员页顶部）
          </div>
          <textarea
            value={cfg.card_notice || ''}
            onChange={(e) =>
              setCfg((c: any) => ({ ...c, card_notice: e.target.value }))
            }
            rows={2}
            className='w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
            placeholder='例如：一卡一机，换机需重新购卡'
          />
        </div>

        <div className='space-y-1'>
          <div className='text-sm text-gray-700 dark:text-gray-300'>
            站点公告
          </div>
          <textarea
            value={cfg.notice || ''}
            onChange={(e) => setCfg((c: any) => ({ ...c, notice: e.target.value }))}
            rows={2}
            className='w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
            placeholder='留空则不显示公告'
          />
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={save}
            disabled={loading}
            className='inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50'
          >
            <Save size={14} /> 保存设置
          </button>
          <button
            onClick={load}
            disabled={loading}
            className='inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300'
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
          {saved && <span className='text-xs text-green-600'>{saved}</span>}
        </div>

        <div className='text-xs text-gray-500'>
          卡密与 App 管理端共用一份数据，这里改的开关和公告对 App 同样生效。
        </div>
      </div>

      {/* 设备 / 会员列表 */}
      <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2'>
        <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
          设备会员（{rows.length}）
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead className='bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'>
              <tr>
                <th className='px-2 py-2 text-left'>设备</th>
                <th className='px-2 py-2 text-left'>状态</th>
                <th className='px-2 py-2 text-left'>剩余</th>
                <th className='px-2 py-2 text-left'>到期</th>
                <th className='px-2 py-2 text-right'>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className='px-2 py-6 text-center text-gray-400'>
                    还没有设备
                  </td>
                </tr>
              )}
              {rows.map((d) => {
                const blocked = !!d.blocked;
                const card = d.card || '';
                const exp = Number(d.expire || 0);
                const active = exp > now;
                return (
                  <tr
                    key={d.id}
                    className='border-t border-gray-100 dark:border-gray-800'
                  >
                    <td className='px-2 py-2 text-gray-900 dark:text-gray-100'>
                      <div className='truncate max-w-[8rem]' title={d.id}>
                        {d.name || d.id}
                      </div>
                      <div className='text-[10px] text-gray-400 font-mono'>
                        {d.id.slice(0, 12)}
                      </div>
                    </td>
                    <td className='px-2 py-2'>
                      {blocked ? (
                        <span className='px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'>
                          已拉黑
                        </span>
                      ) : active ? (
                        <span className='px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'>
                          会员
                        </span>
                      ) : (
                        <span className='px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'>
                          免费
                        </span>
                      )}
                    </td>
                    <td className='px-2 py-2 text-gray-600 dark:text-gray-400'>
                      {active ? `${daysLeft(exp)} 天` : '—'}
                    </td>
                    <td className='px-2 py-2 text-gray-600 dark:text-gray-400'>
                      {exp > 0
                        ? new Date(exp * 1000).toLocaleDateString('zh-CN')
                        : '—'}
                    </td>
                    <td className='px-2 py-2 text-right whitespace-nowrap'>
                      <button
                        onClick={() => deviceOp(d.id, { blocked: !blocked })}
                        className='text-red-600 hover:underline mr-2 inline-flex items-center gap-0.5'
                      >
                        {blocked ? <Unlock size={12} /> : <Ban size={12} />}
                        {blocked ? '解除' : '拉黑'}
                      </button>
                      {(active || !!card) && (
                        <button
                          onClick={() => deviceOp(d.id, { unbind: true })}
                          className='text-gray-500 hover:underline'
                        >
                          解绑卡
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
