'use client';

import { Check, Copy, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface CardItem {
  id: string;
  code: string;
  tail: string;
  days: number;
  label: string;
  status: 'unused' | 'active' | 'expired' | 'revoked';
  dev: string;
  expire: number;
  used_at: number;
  note: string;
  name: string;
}

const STATUS_TEXT: Record<string, string> = {
  unused: '未使用',
  active: '使用中',
  expired: '已到期',
  revoked: '已作废',
};

const STATUS_CLASS: Record<string, string> = {
  unused: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function MemberCardsConfig() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [stats, setStats] = useState({ total: 0, used: 0, unused: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [gen, setGen] = useState({ days: 30, count: 1, note: '' });
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/member-cards', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setMsg(data.error || '读取失败');
        return;
      }
      setCards(data.cards || []);
      setStats({
        total: data.total || 0,
        used: data.used || 0,
        unused: data.unused || 0,
      });
      setMsg('');
    } catch {
      setMsg('读取卡密失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: any) => {
    const res = await fetch('/api/admin/member-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleGen = async () => {
    setLoading(true);
    setNewCodes([]);
    try {
      const out = await post({ action: 'gen', ...gen });
      if (out.ok === false) {
        setMsg(out.error || out.err || '生成失败');
        return;
      }
      setNewCodes(out.codes || []);
      setMsg('');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('作废后这台设备立即失效，确定？')) return;
    const out = await post({ action: 'revoke', code: id });
    if (out.ok === false) setMsg(out.error || out.err || '作废失败');
    await load();
  };

  const handleDel = async (id: string) => {
    if (!confirm('删除这条卡密记录？')) return;
    const out = await post({ action: 'del', code: id });
    if (out.ok === false) setMsg(out.error || out.err || '删除失败');
    await load();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setMsg('复制失败，请手动选中复制');
    }
  };

  const fmt = (t: number) =>
    t > 0 ? new Date(t * 1000).toLocaleDateString('zh-CN') : '—';

  return (
    <div className='space-y-4'>
      {/* 统计 */}
      <div className='grid grid-cols-3 gap-2'>
        <div className='rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center'>
          <div className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {stats.total}
          </div>
          <div className='text-xs text-gray-500'>总卡密</div>
        </div>
        <div className='rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center'>
          <div className='text-lg font-semibold text-blue-600'>
            {stats.used}
          </div>
          <div className='text-xs text-gray-500'>已使用</div>
        </div>
        <div className='rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center'>
          <div className='text-lg font-semibold text-green-600'>
            {stats.unused}
          </div>
          <div className='text-xs text-gray-500'>未使用</div>
        </div>
      </div>

      {/* 生成 */}
      <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3'>
        <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
          生成卡密
        </div>
        <div className='flex flex-wrap gap-2 items-center'>
          <input
            type='number'
            min={1}
            value={gen.days}
            onChange={(e) =>
              setGen((s) => ({ ...s, days: Number(e.target.value) || 1 }))
            }
            className='w-24 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
            placeholder='天数'
          />
          <span className='text-xs text-gray-500'>天</span>
          <input
            type='number'
            min={1}
            max={100}
            value={gen.count}
            onChange={(e) =>
              setGen((s) => ({ ...s, count: Number(e.target.value) || 1 }))
            }
            className='w-20 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
            placeholder='张数'
          />
          <span className='text-xs text-gray-500'>张</span>
          <input
            value={gen.note}
            onChange={(e) => setGen((s) => ({ ...s, note: e.target.value }))}
            className='flex-1 min-w-[8rem] px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
            placeholder='备注（给谁发的，可空）'
          />
          <button
            onClick={handleGen}
            disabled={loading}
            className='inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50'
          >
            <Plus size={14} /> 生成
          </button>
          <button
            onClick={load}
            disabled={loading}
            className='inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300'
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {newCodes.length > 0 && (
          <div className='rounded bg-green-50 dark:bg-green-900/20 p-2 space-y-1'>
            <div className='text-xs text-green-700 dark:text-green-300'>
              新生成 {newCodes.length} 张，只显示一次，记得复制：
            </div>
            {newCodes.map((c) => (
              <div key={c} className='flex items-center gap-2'>
                <code className='font-mono text-sm text-gray-900 dark:text-gray-100'>
                  {c}
                </code>
                <button
                  onClick={() => copy(c)}
                  className='text-blue-600 text-xs inline-flex items-center gap-1'
                >
                  {copied === c ? <Check size={12} /> : <Copy size={12} />}
                  {copied === c ? '已复制' : '复制'}
                </button>
              </div>
            ))}
          </div>
        )}

        {msg && (
          <div className='flex items-center gap-1 text-xs text-red-600'>
            <X size={12} /> {msg}
          </div>
        )}
      </div>

      {/* 列表 */}
      <div className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead className='bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'>
              <tr>
                <th className='px-2 py-2 text-left'>卡密尾号</th>
                <th className='px-2 py-2 text-left'>天数</th>
                <th className='px-2 py-2 text-left'>状态</th>
                <th className='px-2 py-2 text-left'>绑定设备</th>
                <th className='px-2 py-2 text-left'>到期</th>
                <th className='px-2 py-2 text-left'>备注</th>
                <th className='px-2 py-2 text-right'>操作</th>
              </tr>
            </thead>
            <tbody>
              {cards.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className='px-2 py-6 text-center text-gray-400'
                  >
                    还没有卡密
                  </td>
                </tr>
              )}
              {cards.map((c) => (
                <tr
                  key={c.id}
                  className='border-t border-gray-100 dark:border-gray-800'
                >
                  <td className='px-2 py-2 font-mono text-gray-900 dark:text-gray-100'>
                    {c.code}
                  </td>
                  <td className='px-2 py-2 text-gray-600 dark:text-gray-400'>
                    {c.days}
                  </td>
                  <td className='px-2 py-2'>
                    <span
                      className={`px-1.5 py-0.5 rounded ${STATUS_CLASS[c.status] || ''}`}
                    >
                      {STATUS_TEXT[c.status] || c.status}
                    </span>
                  </td>
                  <td className='px-2 py-2 text-gray-600 dark:text-gray-400 max-w-[10rem] truncate'>
                    {c.name ? `${c.name} / ` : ''}
                    {c.dev || '—'}
                  </td>
                  <td className='px-2 py-2 text-gray-600 dark:text-gray-400'>
                    {fmt(c.expire)}
                  </td>
                  <td className='px-2 py-2 text-gray-500 max-w-[8rem] truncate'>
                    {c.note || '—'}
                  </td>
                  <td className='px-2 py-2 text-right whitespace-nowrap'>
                    <button
                      onClick={() => handleRevoke(c.id)}
                      className='text-red-600 hover:underline mr-2'
                    >
                      作废
                    </button>
                    <button
                      onClick={() => handleDel(c.id)}
                      className='text-gray-500 hover:underline inline-flex items-center gap-0.5'
                    >
                      <Trash2 size={12} /> 删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className='text-xs text-gray-500 leading-relaxed'>
        卡密与 App 管理端共用同一份数据：这里发的卡，App 用户也能兑换；
        App 发的卡，这里同样能看到。作废会让已绑定的设备立即失效。
      </div>
    </div>
  );
}
