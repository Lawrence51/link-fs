import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { EventItem, fetchEvents, triggerSync } from './api'

export function App() {
  const [items, setItems] = useState<EventItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const [city, setCity] = useState('杭州')
  const [type, setType] = useState<string>('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  async function load() {
    setLoading(true)
    try {
      const res = await fetchEvents({ city, type: type || undefined, q, from, to, page, pageSize })
      setItems(res.items)
      setTotal(res.total)
      setPage(res.page)
      setPageSize(res.pageSize)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, type, q, from, to, page, pageSize])

  async function onSync() {
    setLoading(true)
    try {
      await triggerSync(city)
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1>DS Events</h1>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        <div>
          <label>城市</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="杭州" style={{ width: '100%' }} />
        </div>
        <div>
          <label>类型</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%' }}>
            <option value="">全部</option>
            <option value="expo">展会</option>
            <option value="concert">演唱会</option>
          </select>
        </div>
        <div>
          <label>关键词</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="标题/场馆/地址" style={{ width: '100%' }} />
        </div>
        <div>
          <label>开始日期</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label>结束日期</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button onClick={() => { setPage(1); load() }} disabled={loading}>查询</button>
          <button onClick={onSync} disabled={loading}>手动抓取</button>
        </div>
      </section>

      <section>
        <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">标题</th>
              <th align="left">类型</th>
              <th align="left">城市</th>
              <th align="left">时间</th>
              <th align="left">场馆</th>
              <th align="left">票价</th>
              <th align="left">来源</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid #eee' }}>
                <td>{e.title}</td>
                <td>{e.type === 'expo' ? '展会' : '演唱会'}</td>
                <td>{e.city}</td>
                <td>
                  {e.start_date}
                  {e.end_date && e.end_date !== e.start_date ? ` ~ ${e.end_date}` : ''}
                </td>
                <td>
                  <div>{e.venue || '-'}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{e.address || ''}</div>
                </td>
                <td>{e.price_range || '-'}</td>
                <td>
                  {e.source_url ? (
                    <a href={e.source_url} target="_blank" rel="noreferrer">链接</a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} align="center" style={{ padding: 24, color: '#666' }}>
                  {loading ? '加载中...' : '暂无数据'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>上一页</button>
        <span>
          第 {page} / {pages} 页（共 {total} 条）
        </span>
        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading}>下一页</button>
        <span style={{ marginLeft: 'auto' }}>
          每页
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ marginLeft: 4 }}>
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          条
        </span>
      </section>

      <footer style={{ marginTop: 24, color: '#666', fontSize: 12 }}>
        <div>提示：后端默认每天 09:00 自动抓取“当天的下周同一天”数据。你也可以使用上面的“手动抓取”按钮。</div>
      </footer>
    </div>
  )
}
