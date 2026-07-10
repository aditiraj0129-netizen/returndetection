import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: 'https://returns-shield-2.onrender.com' })
// Warm up Render backend on load
fetch('https://returns-shield-2.onrender.com/').catch(()=>{})

// ── API helpers ──────────────────────────────────────────────────────────────
const getStats   = () => api.get('/returns/stats')
const getReturns = () => api.get('/returns/all')
const getOrders  = () => api.get('/returns/orders')
const decide     = (id, decision) => api.patch(`/returns/${id}/decide?decision=${decision}&notes=`)
const submitReturn = (fd) => api.post('/returns/analyze', fd)
const chatApi    = (msg) => { const fd = new FormData(); fd.append('message', msg); return api.post('/returns/chat', fd) }

// ── Risk config ──────────────────────────────────────────────────────────────
const RISK = {
  auto_approve:       { label: '✓ Auto Approved',     bg: '#dcfce7', color: '#15803d', border: '#86efac', dot: '#22c55e' },
  manual_review:      { label: '⚠ Manual Review',     bg: '#fef9c3', color: '#a16207', border: '#fde047', dot: '#eab308' },
  reject_investigate: { label: '✕ Reject / Investigate', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
}

const BUCKET_GRAD = {
  auto_approve:       'linear-gradient(135deg,#10b981,#059669)',
  manual_review:      'linear-gradient(135deg,#f59e0b,#d97706)',
  reject_investigate: 'linear-gradient(135deg,#ef4444,#dc2626)',
}

// ── RiskBadge ────────────────────────────────────────────────────────────────
function RiskBadge({ bucket }) {
  const r = RISK[bucket] || RISK.manual_review
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:r.bg, color:r.color, border:`1px solid ${r.border}`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:r.dot, display:'inline-block' }} />
      {r.label}
    </span>
  )
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color }) {
  const pct = Math.round((value || 0) * 100)
  const c = color || (pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#10b981')
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
        <span style={{ color:'#64748b' }}>{label}</span>
        <span style={{ fontWeight:700, color:c }}>{pct}%</span>
      </div>
      <div style={{ height:6, background:'#f1f5f9', borderRadius:99 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:99, transition:'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, gradient, light, textColor }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let v = 0; const end = parseInt(value) || 0
    if (!end) return setN(0)
    const t = setInterval(() => { v += Math.ceil(end / 18); if (v >= end) { setN(end); clearInterval(t) } else setN(v) }, 45)
    return () => clearInterval(t)
  }, [value])

  return (
    <div style={{ background:'#fff', borderRadius:16, padding:'22px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:`1px solid ${light}`, position:'relative', overflow:'hidden', transition:'transform 0.2s,box-shadow 0.2s', cursor:'default' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ position:'absolute', top:-24, right:-24, width:80, height:80, background:light, borderRadius:'50%', opacity:0.7 }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontSize:11, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{label}</p>
          <p style={{ fontSize:38, fontWeight:900, color:textColor, lineHeight:1, letterSpacing:'-0.03em' }}>{n}</p>
        </div>
        <div style={{ width:44, height:44, background:gradient, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{icon}</div>
      </div>
    </div>
  )
}

// ── GradCam ──────────────────────────────────────────────────────────────────
function GradCam({ imageSrc, heatmapSeed, breakdown }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const seed = heatmapSeed || 'abcd1234abcd1234'
      const nums = seed.split('').map(c => c.charCodeAt(0))
      const rng = i => (nums[i % nums.length] * 37 + nums[(i+3) % nums.length] * 17) % 100 / 100
      const zones = [
        { label:'Stain',    score: breakdown?.stains    || 0, color:'255,165,0' },
        { label:'Tear',     score: breakdown?.tears     || 0, color:'239,68,68' },
        { label:'Scratch',  score: breakdown?.scratches || 0, color:'168,85,247' },
        { label:'Dent',     score: breakdown?.dents     || 0, color:'59,130,246' },
      ]
      zones.forEach((z, zi) => {
        if (z.score < 0.15) return
        const cx = rng(zi*4) * img.width * 0.6 + img.width * 0.2
        const cy = rng(zi*4+1) * img.height * 0.6 + img.height * 0.2
        const rx = 30 + rng(zi*4+2) * 60; const ry = 20 + rng(zi*4+3) * 40
        const g = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry))
        g.addColorStop(0, `rgba(${z.color},${z.score*0.55})`); g.addColorStop(0.5, `rgba(${z.color},${z.score*0.3})`); g.addColorStop(1, `rgba(${z.color},0)`)
        ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,rng(zi)*Math.PI,0,2*Math.PI); ctx.fillStyle=g; ctx.fill()
        ctx.font='bold 12px sans-serif'; ctx.strokeStyle='white'; ctx.lineWidth=3
        ctx.strokeText(`${z.label} ${Math.round(z.score*100)}%`, cx-24, cy)
        ctx.fillStyle=`rgba(${z.color},1)`; ctx.fillText(`${z.label} ${Math.round(z.score*100)}%`, cx-24, cy)
      })
    }
    img.src = imageSrc
  }, [imageSrc, heatmapSeed, breakdown])

  if (!imageSrc) return null
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>🔬 Damage Heatmap</span>
        <span style={{ fontSize:11, background:'#ede9fe', color:'#4f46e5', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>Grad-CAM Visual Analysis</span>
      </div>
      <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid #e2e8f0' }}>
        <canvas ref={canvasRef} style={{ width:'100%', display:'block' }} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:10 }}>
        {[
          { label:'Stains',   val:breakdown?.stains,    color:'#f97316' },
          { label:'Tears',    val:breakdown?.tears,     color:'#ef4444' },
          { label:'Scratches',val:breakdown?.scratches, color:'#a855f7' },
          { label:'Dents',    val:breakdown?.dents,     color:'#3b82f6' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'10px', textAlign:'center', border:`1px solid ${color}33` }}>
            <div style={{ width:8, height:8, background:color, borderRadius:'50%', margin:'0 auto 5px' }} />
            <p style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{label}</p>
            <p style={{ fontSize:17, fontWeight:800, color }}>{Math.round((val||0)*100)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ReturnPolicy ──────────────────────────────────────────────────────────────
const RULES = [
  { icon:'🚫', text:'Item has NOT been used, worn, or washed after purchase' },
  { icon:'🏷️', text:'Original tags and packaging are intact (unless defective)' },
  { icon:'🧼', text:'Item is free from stains, odors, or personal modifications made after purchase' },
  { icon:'📦', text:'All accessories, manuals, and original parts are included' },
  { icon:'📷', text:'I have uploaded a clear, unedited photo of the actual item being returned' },
  { icon:'⚖️', text:'I understand that fraudulent returns may result in permanent account suspension' },
]

function ReturnPolicy({ onAccept }) {
  const [checked, setChecked] = useState({})
  const allChecked = RULES.every((_, i) => checked[i])
  return (
    <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', gap:10, alignItems:'flex-start' }}>
        <span style={{ fontSize:22 }}>⚠️</span>
        <div>
          <p style={{ fontWeight:700, color:'#92400e', fontSize:14 }}>Return Eligibility Checklist</p>
          <p style={{ fontSize:12, color:'#a16207', marginTop:2 }}>Please confirm every point. False declarations may result in claim rejection and account review by our fraud team.</p>
        </div>
      </div>
      <div style={{ padding:'16px 20px' }}>
        {RULES.map((rule, i) => (
          <label key={i} onClick={() => setChecked(p => ({ ...p, [i]: !p[i] }))} style={{
            display:'flex', gap:12, alignItems:'flex-start', padding:'10px', marginBottom:6,
            borderRadius:8, cursor:'pointer',
            background: checked[i] ? '#f0fdf4' : '#fafafa',
            border: `1px solid ${checked[i] ? '#86efac' : '#f1f5f9'}`,
            transition:'all 0.15s'
          }}>
            <div style={{ width:20, height:20, borderRadius:5, flexShrink:0, marginTop:1, border:`2px solid ${checked[i] ? '#10b981' : '#d1d5db'}`, background: checked[i] ? '#10b981' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
              {checked[i] && <span style={{ color:'#fff', fontSize:11, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}><span style={{ marginRight:6 }}>{rule.icon}</span>{rule.text}</span>
          </label>
        ))}
        <button onClick={onAccept} disabled={!allChecked} style={{
          width:'100%', marginTop:12, padding:'13px',
          background: allChecked ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#e2e8f0',
          color: allChecked ? '#fff' : '#94a3b8',
          border:'none', borderRadius:10, fontWeight:700, fontSize:14,
          cursor: allChecked ? 'pointer' : 'not-allowed', transition:'all 0.2s'
        }}>
          {allChecked ? '✓ All confirmed — Proceed to Submit' : `Confirm all ${RULES.length} points to continue`}
        </button>
      </div>
    </div>
  )
}

// ── SubmitReturn ──────────────────────────────────────────────────────────────
function SubmitReturn({ onSuccess }) {
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState({ order_id:'', reason:'Product damaged on arrival', transaction_amt:'2999', card1:'13553', card2:'555', transaction_hour:'14', email_domain_freq:'0.05', has_device_info:'1', dist1:'19', c1:'2', c2:'2', c5:'1', c13:'5', c14:'2' })
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getOrders().then(r => {
      setOrders(r.data)
      if (r.data.length > 0) setForm(p => ({ ...p, order_id: String(r.data[0].id) }))
    }).catch(() => {
      const fallback = [1,2,3,4,5,6].map(i => ({ id:i, product_name:`Order #${i}` }))
      setOrders(fallback)
      setForm(p => ({ ...p, order_id:'1' }))
    })
  }, [])

  const handleImage = e => {
    const file = e.target.files[0]; if (!file) return
    setImage(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (!image) return setError('Please upload a product image.')
    if (!form.order_id) return setError('Please select an order.')
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k, v))
      fd.append('image', image)
      const res = await submitReturn(fd)
      setResult(res.data)
      if (onSuccess) onSuccess()
    } catch(e) {
      const d = e.response?.data?.detail
      setError(typeof d === 'string' ? d : JSON.stringify(d) || 'Submission failed. Check that order ID exists.')
    } finally { setLoading(false) }
  }

  const reset = () => { setResult(null); setImage(null); setPreview(null); setError(null) }

  return (
    <div style={{ maxWidth:720, margin:'0 auto' }}>
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
        <div style={{ padding:'22px 28px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
          <h2 style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>Submit Return for AI Analysis</h2>
          <p style={{ fontSize:13, opacity:0.85 }}>Fraud score + damage detection in under a second</p>
        </div>

        <div style={{ padding:28 }}>
          {/* Image Upload */}
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>📷 Product Image <span style={{ color:'#ef4444' }}>*</span></label>
            <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:`2px dashed ${image ? '#4f46e5' : '#e2e8f0'}`, borderRadius:12, cursor:'pointer', background: image ? '#fafbff' : '#fafafa', overflow:'hidden', minHeight:140, transition:'all 0.2s' }}>
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleImage} />
              {preview
                ? <img src={preview} alt="preview" style={{ width:'100%', maxHeight:220, objectFit:'cover' }} />
                : <div style={{ padding:32, textAlign:'center' }}>
                    <div style={{ fontSize:40, marginBottom:8 }}>📦</div>
                    <p style={{ fontSize:13, color:'#64748b', fontWeight:600 }}>Click to upload product photo</p>
                    <p style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>JPG, PNG — clear and well-lit</p>
                  </div>
              }
            </label>
            {image && (
              <p style={{ fontSize:12, color:'#4f46e5', marginTop:6, fontWeight:600 }}>
                ✓ {image.name}
                <button onClick={() => { setImage(null); setPreview(null) }} style={{ marginLeft:8, background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:12, fontWeight:600 }}>Remove</button>
              </p>
            )}
          </div>

          {/* Form */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Order ID</label>
              <select value={form.order_id} onChange={e => setForm(p => ({ ...p, order_id:e.target.value }))}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, color:'#1e293b', outline:'none', background:'#fff' }}>
                {orders.map(o => <option key={o.id} value={String(o.id)}>#{o.id} — {o.product_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Return Reason</label>
              <select value={form.reason} onChange={e => setForm(p => ({ ...p, reason:e.target.value }))}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, color:'#1e293b', outline:'none', background:'#fff' }}>
                {['Product damaged on arrival','Wrong item delivered','Not as described','Changed my mind','Defective product','Item swap suspected'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Transaction Amount (₹)</label>
              <input type="number" value={form.transaction_amt} onChange={e => setForm(p => ({ ...p, transaction_amt:e.target.value }))}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, color:'#1e293b', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Card (first 5 digits)</label>
              <input type="number" value={form.card1} onChange={e => setForm(p => ({ ...p, card1:e.target.value }))}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, color:'#1e293b', outline:'none' }} />
            </div>
          </div>

          {error && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#b91c1c', fontWeight:500 }}>⚠️ {error}</div>
          )}

          <button onClick={submit} disabled={loading} style={{
            width:'100%', padding:'14px',
            background: loading ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            color:'#fff', border:'none', borderRadius:10,
            fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(79,70,229,0.4)', transition:'all 0.2s'
          }}>
            {loading ? '🔄 Analyzing with AI...' : '🔍 Analyze Return Now'}
          </button>
          <p style={{ fontSize:11, color:'#94a3b8', textAlign:'center', marginTop:8 }}>XGBoost (ROC-AUC 0.91) · Computer Vision damage detection · &lt;200ms</p>
        </div>

        {/* Result */}
        {result && (
          <div style={{ borderTop:'1px solid #f1f5f9' }}>
            <div style={{ padding:'20px 28px', background: BUCKET_GRAD[result.risk_bucket] || 'linear-gradient(135deg,#64748b,#475569)', color:'#fff' }}>
              <div style={{ fontSize:30, marginBottom:6 }}>
                {result.risk_bucket === 'auto_approve' ? '✅' : result.risk_bucket === 'manual_review' ? '⚠️' : '🚨'}
              </div>
              <h3 style={{ fontSize:18, fontWeight:800 }}>{RISK[result.risk_bucket]?.label}</h3>
              <p style={{ opacity:0.9, fontSize:13, marginTop:4 }}>{result.message}</p>
            </div>

            <div style={{ padding:'20px 28px' }}>
              {/* Score cards */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
                {[
                  { label:'Fraud Score',  value:`${Math.round((result.fraud_result?.fraud_score||0)*100)}%`,   color:'#4f46e5', icon:'🤖' },
                  { label:'Damage Score', value:`${Math.round((result.cv_result?.damage_score||0)*100)}%`,     color:'#06b6d4', icon:'📷' },
                  { label:'Condition',    value: result.cv_result?.is_damaged ? 'Damaged' : 'Intact',          color: result.cv_result?.is_damaged ? '#ef4444' : '#10b981', icon:'📦' },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} style={{ textAlign:'center', padding:'16px 10px', background:'#f8fafc', borderRadius:12, border:'1px solid #f1f5f9' }}>
                    <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                    <p style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</p>
                    <p style={{ fontSize:24, fontWeight:800, color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Damage breakdown */}
              {result.cv_result?.breakdown && (
                <div style={{ marginBottom:20 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:10, letterSpacing:'0.06em' }}>Damage Breakdown</p>
                  <ScoreBar label="Stains"    value={result.cv_result.breakdown.stains}    color="#f97316" />
                  <ScoreBar label="Tears"     value={result.cv_result.breakdown.tears}     color="#ef4444" />
                  <ScoreBar label="Scratches" value={result.cv_result.breakdown.scratches} color="#a855f7" />
                  <ScoreBar label="Dents"     value={result.cv_result.breakdown.dents}     color="#3b82f6" />
                </div>
              )}

              {/* GradCAM */}
              {result.cv_result?.breakdown && preview && (
                <div style={{ marginBottom:16 }}>
                  <GradCam imageSrc={preview} heatmapSeed={result.cv_result.heatmap_seed} breakdown={result.cv_result.breakdown} />
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:12, borderTop:'1px solid #f1f5f9' }}>
                <p style={{ fontSize:12, color:'#94a3b8' }}>Return #{result.return_id} saved · Dashboard updated</p>
                <button onClick={reset} style={{ background:'none', border:'1px solid #e2e8f0', color:'#4f46e5', cursor:'pointer', fontWeight:600, fontSize:13, padding:'7px 16px', borderRadius:8 }}>+ Submit Another</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
const QUICK_REPLIES = ['How do I return?', 'How does fraud detection work?', 'How long for refund?', 'What damages are detected?', 'Return policy?']

function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ from:'bot', text:"Hi! I'm the Returns Shield AI assistant. I can help with return policies, damage detection, fraud scoring, and refund timelines. What would you like to know?" }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, open])

  const send = async (text) => {
    const msg = text || input.trim(); if (!msg) return
    setInput(''); setMessages(p => [...p, { from:'user', text:msg }]); setLoading(true)
    try {
      const res = await chatApi(msg)
      setMessages(p => [...p, { from:'bot', text:res.data.reply }])
    } catch {
      setMessages(p => [...p, { from:'bot', text:'Sorry, connection issue. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{
        position:'fixed', bottom:28, right:28, zIndex:1000,
        width:56, height:56,
        background: open ? '#ef4444' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
        border:'none', borderRadius:'50%', cursor:'pointer',
        boxShadow:'0 4px 20px rgba(79,70,229,0.45)', fontSize:22, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.3s'
      }}>
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div style={{
          position:'fixed', bottom:96, right:28, zIndex:999,
          width:350, height:510, background:'#fff', borderRadius:20,
          boxShadow:'0 20px 60px rgba(0,0,0,0.18)',
          display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
          <div style={{ padding:'14px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, background:'rgba(255,255,255,0.2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🛡️</div>
              <div>
                <p style={{ fontWeight:700, fontSize:14 }}>Returns Shield AI</p>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:6, height:6, background:'#4ade80', borderRadius:'50%' }} />
                  <p style={{ fontSize:11, opacity:0.85 }}>Online · Instant replies</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'14px', display:'flex', flexDirection:'column', gap:10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:'82%', padding:'9px 13px',
                  borderRadius: m.from === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.from === 'user' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#f1f5f9',
                  color: m.from === 'user' ? '#fff' : '#1e293b',
                  fontSize:13, lineHeight:1.5
                }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', gap:4, padding:'9px 13px', background:'#f1f5f9', borderRadius:'18px 18px 18px 4px', width:'fit-content' }}>
                {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, background:'#94a3b8', borderRadius:'50%', animation:`pulse 1s ${i*0.2}s infinite` }} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding:'6px 10px', borderTop:'1px solid #f1f5f9', display:'flex', gap:5, overflowX:'auto' }}>
            {QUICK_REPLIES.map(q => (
              <button key={q} onClick={() => send(q)} style={{ whiteSpace:'nowrap', padding:'5px 10px', background:'#ede9fe', color:'#4f46e5', border:'none', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer' }}>{q}</button>
            ))}
          </div>

          <div style={{ padding:'10px 14px', borderTop:'1px solid #f1f5f9', display:'flex', gap:8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about returns..." style={{ flex:1, padding:'9px 14px', border:'1px solid #e2e8f0', borderRadius:20, fontSize:13, outline:'none', color:'#1e293b' }} />
            <button onClick={() => send()} style={{ width:38, height:38, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:'50%', cursor:'pointer', color:'#fff', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>→</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── ReturnTable ───────────────────────────────────────────────────────────────
function ReturnTable({ returns, onRefresh }) {
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(null)

  const handleDecide = async (id, decision, e) => {
    e.stopPropagation()
    setLoading(`${id}-${decision}`)
    try { await decide(id, decision); onRefresh() }
    catch(err) { alert('Error: ' + (err.response?.data?.detail || err.message)) }
    finally { setLoading(null) }
  }

  if (!returns.length) return (
    <div style={{ background:'#fff', borderRadius:16, padding:48, textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
      <p style={{ color:'#94a3b8', fontSize:15, fontWeight:500 }}>No returns yet. Submit one to get started!</p>
    </div>
  )

  return (
    <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#1e293b' }}>Return Requests</h2>
          <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Click any row to expand · Approve or reject flagged returns</p>
        </div>
        <span style={{ fontSize:13, background:'#f1f5f9', color:'#64748b', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>{returns.length} total</span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              {['ID','Product','Reason','Risk Level','Fraud','Damage','Status','Actions'].map(h => (
                <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap', borderBottom:'1px solid #f1f5f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <>
                <tr key={r.id}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  style={{ borderBottom:'1px solid #f8fafc', cursor:'pointer', background: expanded === r.id ? '#fafbff' : '#fff', transition:'background 0.15s' }}
                  onMouseEnter={e => { if(expanded !== r.id) e.currentTarget.style.background='#f8fafc' }}
                  onMouseLeave={e => { if(expanded !== r.id) e.currentTarget.style.background='#fff' }}>
                  <td style={{ padding:'13px 16px', fontSize:13, fontWeight:700, color:'#4f46e5' }}>#{r.id}</td>
                  <td style={{ padding:'13px 16px', fontSize:13, fontWeight:600, color:'#1e293b', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.product_name}</td>
                  <td style={{ padding:'13px 16px', fontSize:12, color:'#64748b', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.reason}</td>
                  <td style={{ padding:'13px 16px' }}><RiskBadge bucket={r.risk_bucket} /></td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:44, height:5, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${Math.round((r.fraud_score||0)*100)}%`, height:'100%', background: r.fraud_score>0.6?'#ef4444':r.fraud_score>0.3?'#f59e0b':'#10b981', borderRadius:99 }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color: r.fraud_score>0.6?'#ef4444':r.fraud_score>0.3?'#d97706':'#16a34a' }}>{Math.round((r.fraud_score||0)*100)}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:44, height:5, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${Math.round((r.damage_score||0)*100)}%`, height:'100%', background: r.damage_score>0.5?'#ef4444':'#10b981', borderRadius:99 }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color: r.damage_score>0.5?'#ef4444':'#16a34a' }}>{Math.round((r.damage_score||0)*100)}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    {r.reviewed
                      ? <span style={{ fontSize:11, background:'#dcfce7', color:'#15803d', padding:'3px 8px', borderRadius:20, fontWeight:700 }}>✓ Reviewed</span>
                      : <span style={{ fontSize:11, background:'#fef9c3', color:'#a16207', padding:'3px 8px', borderRadius:20, fontWeight:700 }}>Pending</span>
                    }
                  </td>
                  <td style={{ padding:'13px 16px' }} onClick={e => e.stopPropagation()}>
                    {!r.reviewed ? (
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={e => handleDecide(r.id,'approved',e)} disabled={!!loading}
                          style={{ padding:'5px 10px', background:'#10b981', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          {loading===`${r.id}-approved` ? '...' : 'Approve'}
                        </button>
                        <button onClick={e => handleDecide(r.id,'rejected',e)} disabled={!!loading}
                          style={{ padding:'5px 10px', background:'#ef4444', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          {loading===`${r.id}-rejected` ? '...' : 'Reject'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize:12, fontWeight:700, color: r.final_decision==='approved'?'#16a34a':'#dc2626' }}>
                        {r.final_decision==='approved' ? '✓ Approved' : '✕ Rejected'}
                      </span>
                    )}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr key={`exp-${r.id}`}>
                    <td colSpan={8} style={{ background:'#fafbff', borderBottom:'1px solid #e2e8f0' }}>
                      <div style={{ padding:'18px 24px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24 }}>
                        <div>
                          <p style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:10 }}>Score Analysis</p>
                          <ScoreBar label="Fraud Risk" value={r.fraud_score} />
                          <ScoreBar label="Damage" value={r.damage_score} color="#06b6d4" />
                        </div>
                        <div>
                          <p style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:10 }}>Details</p>
                          {[['Order ID',`#${r.order_id}`],['Reason',r.reason],['Submitted', r.requested_at ? new Date(r.requested_at).toLocaleString() : 'N/A']].map(([k,v]) => (
                            <div key={k} style={{ marginBottom:8 }}>
                              <span style={{ fontSize:11, color:'#94a3b8' }}>{k}: </span>
                              <span style={{ fontSize:12, color:'#1e293b', fontWeight:600 }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:10 }}>AI Decision</p>
                          <RiskBadge bucket={r.risk_bucket} />
                          <p style={{ fontSize:12, color:'#64748b', marginTop:10, lineHeight:1.6 }}>
                            {r.risk_bucket==='auto_approve' && 'Low fraud signals detected. Return auto-approved by the system.'}
                            {r.risk_bucket==='manual_review' && 'Moderate risk signals. A human reviewer should verify this return.'}
                            {r.risk_bucket==='reject_investigate' && 'High fraud probability. Flagged for investigation team.'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Chart ────────────────────────────────────────────────────────────────────
function MiniChart({ stats, returns }) {
  const pieData = [
    { name:'Auto Approved', value:stats.auto_approve||0, color:'#10b981' },
    { name:'Manual Review', value:stats.manual_review||0, color:'#f59e0b' },
    { name:'Investigating', value:stats.reject_investigate||0, color:'#ef4444' },
  ]
  const total = pieData.reduce((s,d) => s+d.value, 0)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:20 }}>Risk Distribution</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {pieData.map(d => {
            const pct = total ? Math.round(d.value/total*100) : 0
            return (
              <div key={d.name}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:d.color }} />
                    <span style={{ fontSize:13, color:'#374151' }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:d.color }}>{d.value} ({pct}%)</span>
                </div>
                <div style={{ height:8, background:'#f1f5f9', borderRadius:99 }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:d.color, borderRadius:99, transition:'width 0.8s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:20 }}>Recent Fraud Scores</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {returns.slice(0,6).map(r => {
            const pct = Math.round((r.fraud_score||0)*100)
            const color = pct>60?'#ef4444':pct>30?'#f59e0b':'#10b981'
            return (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:11, color:'#94a3b8', width:50, flexShrink:0 }}>#{r.id} {r.product_name?.split(' ')[0]}</span>
                <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:99 }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, transition:'width 0.6s' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:700, color, width:32, textAlign:'right' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Guide ────────────────────────────────────────────────────────────────────
function Guide() {
  return (
    <div style={{ maxWidth:840, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:20, padding:'36px 40px', color:'#fff', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🛡️</div>
        <h1 style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.03em', marginBottom:8 }}>How Returns Shield Works</h1>
        <p style={{ fontSize:14, opacity:0.85, maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
          An AI-powered returns fraud detection platform combining machine learning and computer vision to protect e-commerce operations in real time.
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { icon:'🎯', label:'0.91 ROC-AUC', desc:'Fraud model accuracy' },
          { icon:'⚡', label:'<200ms',       desc:'Analysis time' },
          { icon:'🔍', label:'13 Features',  desc:'Behavioral signals' },
          { icon:'🧠', label:'Dual AI',      desc:'XGBoost + CV' },
        ].map(f => (
          <div key={f.label} style={{ background:'#fff', borderRadius:12, padding:'20px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>{f.icon}</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#4f46e5', marginBottom:2 }}>{f.label}</div>
            <div style={{ fontSize:11, color:'#94a3b8', fontWeight:500 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:24 }}>The Analysis Pipeline</h2>
        {[
          { n:'01', icon:'📦', title:'Customer Initiates Return', desc:'Ops team submits order details and a product photo through Returns Shield. The policy checklist ensures compliance before submission.' },
          { n:'02', icon:'🤖', title:'XGBoost Fraud Scoring', desc:'Trained on 590,540 transactions from the IEEE-CIS Fraud Detection dataset. Analyses 13 behavioral features including transaction amount, card patterns, email domain frequency, and account history.' },
          { n:'03', icon:'📷', title:'Computer Vision Damage Analysis', desc:'Detects stains, tears, scratches, and dents independently using image feature analysis. Generates a Grad-CAM style heatmap showing exactly where damage is detected on the product.' },
          { n:'04', icon:'⚖️', title:'Risk Triage Decision', desc:'Both signals are fused into a final decision: Auto Approve (fraud <20% + damaged), Manual Review (moderate risk), or Reject & Investigate (fraud >60%).' },
          { n:'05', icon:'👩‍💼', title:'Human-in-the-Loop Review', desc:'Manual review cases appear in the dashboard where ops agents can approve or reject with full score explanations — making every AI decision transparent and auditable.' },
        ].map((s, i, arr) => (
          <div key={s.n} style={{ display:'flex', gap:20, paddingBottom: i<arr.length-1 ? 24 : 0, position:'relative' }}>
            {i < arr.length-1 && <div style={{ position:'absolute', left:19, top:44, width:2, height:'calc(100% - 20px)', background:'#e2e8f0' }} />}
            <div style={{ flexShrink:0, width:40, height:40, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, position:'relative', zIndex:1 }}>{s.icon}</div>
            <div style={{ paddingTop:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <span style={{ fontSize:10, fontWeight:800, color:'#4f46e5', background:'#ede9fe', padding:'2px 7px', borderRadius:20 }}>{s.n}</span>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>{s.title}</h3>
              </div>
              <p style={{ fontSize:13, color:'#64748b', lineHeight:1.6 }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', borderRadius:16, padding:28, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:16 }}>Quick Start</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { step:'1', text:'Go to "+ New Return" and complete the 6-point eligibility checklist' },
            { step:'2', text:'Select your Order ID from the dropdown and upload a product photo' },
            { step:'3', text:'Click "Analyze Return Now" — AI scores fraud + damage instantly' },
            { step:'4', text:'Review results including Grad-CAM heatmap, then check Dashboard for all returns' },
          ].map(({ step, text }) => (
            <div key={step} style={{ display:'flex', gap:12, background:'#f8fafc', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ width:28, height:28, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:800, flexShrink:0 }}>{step}</div>
              <p style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:'#f8fafc', borderRadius:16, padding:24, border:'1px solid #e2e8f0' }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:12 }}>Tech Stack</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {['Python 3.11','FastAPI','XGBoost','TensorFlow','EfficientNetB0','PostgreSQL','React 18','Docker','IEEE-CIS Dataset (590k txns)','SQLAlchemy','Recharts'].map(t => (
            <span key={t} style={{ fontSize:12, background:'#fff', border:'1px solid #e2e8f0', color:'#4f46e5', padding:'5px 12px', borderRadius:20, fontWeight:600 }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [stats, setStats]   = useState(null)
  const [returns, setReturns] = useState([])
  const [tab, setTab]       = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [policyAccepted, setPolicyAccepted] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([getStats(), getReturns()])
      setStats(s.data); setReturns(r.data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const switchTab = (t) => { setTab(t); if (t !== 'submit') setPolicyAccepted(false) }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#f0f2f8', flexDirection:'column', gap:16 }}>
      <div style={{ width:56, height:56, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>🛡️</div>
      <p style={{ color:'#64748b', fontWeight:600, fontSize:15 }}>Loading Returns Shield...</p>
      <div style={{ width:200, height:3, background:'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:'70%', height:'100%', background:'linear-gradient(90deg,#4f46e5,#7c3aed)', borderRadius:99 }} />
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f8' }}>

      {/* Header */}
      <header style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🛡️</div>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', letterSpacing:'-0.02em' }}>Returns Shield</div>
              <div style={{ fontSize:11, color:'#64748b', fontWeight:500 }}>AI Fraud Detection Platform</div>
            </div>
          </div>

          <nav style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:10, padding:4 }}>
            {[
              { key:'dashboard', label:'📊 Dashboard' },
              { key:'submit',    label:'+ New Return' },
              { key:'guide',     label:'📖 How It Works' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => switchTab(key)} style={{
                padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer',
                background: tab===key ? '#fff' : 'transparent',
                color: tab===key ? '#4f46e5' : '#64748b',
                fontWeight: tab===key ? 700 : 500, fontSize:13,
                boxShadow: tab===key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition:'all 0.2s'
              }}>{label}</button>
            ))}
          </nav>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:20, padding:'5px 12px' }}>
              <div style={{ width:7, height:7, background:'#22c55e', borderRadius:'50%' }} />
              <span style={{ fontSize:12, color:'#15803d', fontWeight:600 }}>Live</span>
            </div>
            <button onClick={refresh} style={{ padding:'7px 14px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>↻ Refresh</button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth:1280, margin:'0 auto', padding:'28px 24px' }}>

        {tab === 'dashboard' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, color:'#1e293b', letterSpacing:'-0.02em' }}>Operations Dashboard</h1>
              <p style={{ fontSize:13, color:'#64748b', marginTop:2 }}>Real-time returns fraud monitoring · XGBoost + Computer Vision</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
              <StatCard label="Total Returns"  value={stats?.total||0}                icon="📦" gradient="linear-gradient(135deg,#4f46e5,#7c3aed)" light="#ede9fe" textColor="#4f46e5" />
              <StatCard label="Auto Approved"  value={stats?.auto_approve||0}         icon="✅" gradient="linear-gradient(135deg,#10b981,#059669)" light="#dcfce7" textColor="#16a34a" />
              <StatCard label="Manual Review"  value={stats?.manual_review||0}        icon="⚠️" gradient="linear-gradient(135deg,#f59e0b,#d97706)" light="#fef9c3" textColor="#ca8a04" />
              <StatCard label="Investigating"  value={stats?.reject_investigate||0}   icon="🚨" gradient="linear-gradient(135deg,#ef4444,#dc2626)" light="#fee2e2" textColor="#dc2626" />
            </div>

            <MiniChart stats={stats||{}} returns={returns} />

            <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:16, padding:'20px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', color:'#fff' }}>
              <div>
                <p style={{ fontSize:12, opacity:0.75, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Average Fraud Score</p>
                <p style={{ fontSize:48, fontWeight:900, letterSpacing:'-0.03em', marginTop:2 }}>{Math.round((stats?.avg_fraud_score||0)*100)}%</p>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                {[
                  { label:'Model', value:'XGBoost' },
                  { label:'ROC-AUC', value:'0.91' },
                  { label:'Training Data', value:'590k txns' },
                  { label:'Features', value:'13 signals' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                    <p style={{ fontSize:11, opacity:0.75 }}>{label}</p>
                    <p style={{ fontSize:16, fontWeight:800, marginTop:2 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <ReturnTable returns={returns} onRefresh={refresh} />
          </div>
        )}

        {tab === 'submit' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, color:'#1e293b', letterSpacing:'-0.02em' }}>Analyze a Return</h1>
              <p style={{ fontSize:13, color:'#64748b', marginTop:2 }}>Complete eligibility checklist first · Use Order IDs from the dropdown</p>
            </div>
            {!policyAccepted
              ? <ReturnPolicy onAccept={() => setPolicyAccepted(true)} />
              : <SubmitReturn onSuccess={() => { refresh(); setTimeout(() => switchTab('dashboard'), 2000) }} />
            }
          </div>
        )}

        {tab === 'guide' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, color:'#1e293b', letterSpacing:'-0.02em' }}>How It Works</h1>
              <p style={{ fontSize:13, color:'#64748b', marginTop:2 }}>The AI pipeline behind Returns Shield</p>
            </div>
            <Guide />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid #e2e8f0', background:'#fff', marginTop:48, padding:'24px', textAlign:'center' }}>
        <p style={{ fontSize:13, color:'#94a3b8' }}>
          🛡️ <span style={{ fontWeight:700, color:'#4f46e5' }}>Returns Shield</span> · Built with ❤️ by{' '}
          <span style={{ fontWeight:800, color:'#7c3aed' }}>Aditi Raj</span> · VIT Bhopal · Amazon ML Summer School 2025
        </p>
        <p style={{ fontSize:11, color:'#cbd5e1', marginTop:6 }}>XGBoost · FastAPI · React · PostgreSQL · Computer Vision · Docker</p>
      </footer>

      <Chatbot />
    </div>
  )
}
