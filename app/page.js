'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  LayoutDashboard, Wallet, TrendingDown, Target, Plug, User, Shield,
  Sun, Moon, Plus, Pencil, Trash2, LogOut, Download, ArrowUpRight, ArrowDownRight,
  DollarSign, Landmark, Menu, Sparkles, Coins, Building2, CircleDollarSign,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

// ---------------- constants ----------------
const ASSET_CATEGORIES = ['Cash', 'Bank Accounts', 'Stocks', 'ETFs', 'Mutual Funds', 'Crypto', 'Real Estate', 'Gold', 'Silver', 'Fixed Deposits', 'Recurring Deposits', 'Retirement Accounts', 'Vehicles', 'Business', 'Other']
const LIABILITY_CATEGORIES = ['Credit Cards', 'Mortgage', 'Personal Loan', 'Student Loan', 'Vehicle Loan', 'Business Loan', 'Medical Loan', 'Other']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CNY', 'CHF', 'SGD', 'AED', 'ZAR', 'BRL']
const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(158 40% 55%)', 'hsl(199 60% 60%)', 'hsl(262 50% 65%)']

// ---------------- api ----------------
function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('nwt_token')
}
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`/api${path}`, { ...opts, headers })
  if (!res.ok) {
    let msg = 'Request failed'
    try { msg = (await res.json()).error || msg } catch {}
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

function fmt(n, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0)
  } catch { return `${(n || 0).toLocaleString()}` }
}

// ================= AUTH SCREEN =================
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', currency: 'USD' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api(`/auth/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST', body: JSON.stringify(form),
      })
      localStorage.setItem('nwt_token', data.token)
      onAuth(data.user)
      toast.success(mode === 'login' ? 'Welcome back' : 'Account created')
    } catch (err) {
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">Aureal</span>
        </div>
        <Card className="glass border-border/60 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl">{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</CardTitle>
            <CardDescription>Track your global net worth in one place.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label>Preferred currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled title="Configure Google OAuth keys to enable">
                Continue with Google
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-4">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button className="text-primary font-medium hover:underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ================= SUMMARY CARDS =================
function SummaryCards({ s, currency }) {
  const cards = [
    { label: 'Total Net Worth', value: s.netWorth, icon: CircleDollarSign, accent: 'text-primary', ring: 'from-primary/20' },
    { label: 'Total Assets', value: s.totalAssets, icon: Wallet, accent: 'text-emerald-500', ring: 'from-emerald-500/20' },
    { label: 'Total Liabilities', value: s.totalLiabilities, icon: TrendingDown, accent: 'text-rose-500', ring: 'from-rose-500/20' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <Card className={`card-3d overflow-hidden relative bg-gradient-to-br ${c.ring} to-transparent`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`h-5 w-5 ${c.accent}`} />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{fmt(c.value, currency)}</div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <Card className={`card-3d overflow-hidden relative bg-gradient-to-br ${s.growth >= 0 ? 'from-emerald-500/20' : 'from-rose-500/20'} to-transparent`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monthly Growth</span>
              {s.growth >= 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : <ArrowDownRight className="h-5 w-5 text-rose-500" />}
            </div>
            <div className={`mt-3 text-2xl font-bold tracking-tight ${s.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {s.growth >= 0 ? '+' : ''}{(s.growth || 0).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">{fmt(s.growthAmount, currency)} this month</div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ================= DASHBOARD =================
function Dashboard({ currency, goto }) {
  const [data, setData] = useState(null)
  const load = useCallback(() => { api('/dashboard').then(setData).catch(e => toast.error(e.message)) }, [])
  useEffect(() => { load() }, [load])

  if (!data) return <div className="text-muted-foreground">Loading dashboard…</div>
  const { summary, allocation, liabilityBreakdown, history, goals } = data
  const goal = goals?.[0]
  const goalPct = goal && goal.targetAmount > 0 ? Math.min(100, Math.max(0, (summary.netWorth / goal.targetAmount) * 100)) : 0

  return (
    <div className="space-y-6">
      <SummaryCards s={summary} currency={currency} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-3d">
          <CardHeader><CardTitle className="text-base">Net Worth History</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} formatter={v => fmt(v, currency)} />
                <Area type="monotone" dataKey="netWorth" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#nw)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-3d">
          <CardHeader><CardTitle className="text-base">Goal Progress</CardTitle></CardHeader>
          <CardContent>
            {goal ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">{goal.title}</div>
                  <div className="text-2xl font-bold">{fmt(summary.netWorth, currency)}</div>
                  <div className="text-xs text-muted-foreground">of {fmt(goal.targetAmount, currency)}{goal.targetDate ? ` by ${goal.targetDate}` : ''}</div>
                </div>
                <Progress value={goalPct} className="h-3" />
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="secondary">{goalPct.toFixed(0)}% complete</Badge>
                  <span className="text-muted-foreground">{fmt(Math.max(0, goal.targetAmount - summary.netWorth), currency)} to go</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>No goal yet. Set a target net worth to track progress.</p>
                <Button size="sm" variant="outline" onClick={() => goto('goals')}>Create a goal</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutCard title="Asset Allocation" data={allocation} currency={currency} empty="Add assets to see allocation" />
        <Card className="card-3d">
          <CardHeader><CardTitle className="text-base">Liability Breakdown</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {liabilityBreakdown?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liabilityBreakdown} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={44} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} formatter={v => fmt(v, currency)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {liabilityBreakdown.map((e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="No liabilities yet" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DonutCard({ title, data, currency, empty }) {
  return (
    <Card className="card-3d">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-[280px]">
        {data?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                {data.map((e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} formatter={v => fmt(v, currency)} />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyChart text={empty} />}
      </CardContent>
    </Card>
  )
}
function EmptyChart({ text }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{text}</div>
}

// ================= ENTITY MANAGER (assets / liabilities) =================
function EntityManager({ kind, currency }) {
  const isAsset = kind === 'assets'
  const categories = isAsset ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', category: categories[0], value: '', notes: '', customCategory: '' })
  const [useCustom, setUseCustom] = useState(false)

  const load = useCallback(() => { api(`/${kind}`).then(setItems).catch(e => toast.error(e.message)) }, [kind])
  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditing(null); setUseCustom(false)
    setForm({ name: '', category: categories[0], value: '', notes: '', customCategory: '' })
    setOpen(true)
  }
  const openEdit = (it) => {
    setEditing(it)
    const known = categories.includes(it.category)
    setUseCustom(!known)
    setForm({ name: it.name, category: known ? it.category : categories[0], value: it.value, notes: it.notes || '', customCategory: known ? '' : it.category })
    setOpen(true)
  }
  const save = async () => {
    const category = useCustom ? (form.customCategory.trim() || 'Other') : form.category
    const payload = { name: form.name, category, value: Number(form.value) || 0, notes: form.notes }
    try {
      if (editing) await api(`/${kind}/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await api(`/${kind}`, { method: 'POST', body: JSON.stringify(payload) })
      toast.success('Saved')
      setOpen(false); load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (it) => {
    try { await api(`/${kind}/${it.id}`, { method: 'DELETE' }); toast.success('Deleted'); load() }
    catch (e) { toast.error(e.message) }
  }

  const total = items.reduce((s, x) => s + (Number(x.value) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold capitalize">{kind}</h2>
          <p className="text-sm text-muted-foreground">Total: <span className={`font-semibold ${isAsset ? 'text-emerald-500' : 'text-rose-500'}`}>{fmt(total, currency)}</span></p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add {isAsset ? 'Asset' : 'Liability'}</Button>
      </div>

      <Card className="card-3d">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No {kind} yet. Add your first one.</TableCell></TableRow>
              )}
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell><Badge variant="secondary">{it.category}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(it.value, currency)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-[240px] truncate">{it.notes}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(it)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} {isAsset ? 'Asset' : 'Liability'}</DialogTitle>
            <DialogDescription>Enter the details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={isAsset ? 'e.g. Fidelity 401k' : 'e.g. Home Mortgage'} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Category</Label>
                <button className="text-xs text-primary hover:underline" onClick={() => setUseCustom(!useCustom)}>{useCustom ? 'Pick from list' : 'Custom category'}</button>
              </div>
              {useCustom ? (
                <Input value={form.customCategory} onChange={e => setForm({ ...form, customCategory: e.target.value })} placeholder="Custom category name" />
              ) : (
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Value ({currency})</Label>
              <Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ================= GOALS =================
function GoalsPage({ currency }) {
  const [items, setItems] = useState([])
  const [nw, setNw] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', targetAmount: '', targetDate: '' })

  const load = useCallback(() => {
    api('/goals').then(setItems).catch(e => toast.error(e.message))
    api('/dashboard').then(d => setNw(d.summary.netWorth)).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm({ title: '', targetAmount: '', targetDate: '' }); setOpen(true) }
  const openEdit = (g) => { setEditing(g); setForm({ title: g.title, targetAmount: g.targetAmount, targetDate: g.targetDate || '' }); setOpen(true) }
  const save = async () => {
    const payload = { title: form.title || 'My Goal', targetAmount: Number(form.targetAmount) || 0, targetDate: form.targetDate || null }
    try {
      if (editing) await api(`/goals/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await api('/goals', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('Saved'); setOpen(false); load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (g) => { try { await api(`/goals/${g.id}`, { method: 'DELETE' }); load() } catch (e) { toast.error(e.message) } }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Goals</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Goal</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.length === 0 && <p className="text-muted-foreground">No goals yet.</p>}
        {items.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, Math.max(0, (nw / g.targetAmount) * 100)) : 0
          return (
            <Card key={g.id} className="card-3d">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{g.title}</CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(g)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{fmt(nw, currency)}</span>
                  <span className="text-sm text-muted-foreground">/ {fmt(g.targetAmount, currency)}</span>
                </div>
                <Progress value={pct} className="h-3" />
                <div className="flex justify-between text-sm">
                  <Badge variant="secondary">{pct.toFixed(0)}%</Badge>
                  {g.targetDate && <span className="text-muted-foreground">Target: {g.targetDate}</span>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Goal' : 'New Goal'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. First Million" /></div>
            <div className="space-y-1.5"><Label>Target Net Worth ({currency})</Label><Input type="number" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} placeholder="1000000" /></div>
            <div className="space-y-1.5"><Label>Target Date</Label><Input type="date" value={form.targetDate || ''} onChange={e => setForm({ ...form, targetDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ================= INTEGRATIONS (stubs) =================
function IntegrationsPage() {
  const groups = [
    { title: 'Banking', icon: Landmark, providers: ['Plaid', 'Open Banking'] },
    { title: 'Investments', icon: TrendingDown, providers: ['Wealthsimple', 'Questrade', 'Fidelity', 'Charles Schwab', 'Interactive Brokers'] },
    { title: 'Crypto', icon: Coins, providers: ['WalletConnect', 'Coinbase', 'Binance'] },
  ]
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Connect accounts to sync balances automatically. Ready to enable once API keys are added.</p>
      </div>
      {groups.map(g => (
        <div key={g.title} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><g.icon className="h-4 w-4" /> {g.title}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.providers.map(p => (
              <Card key={p} className="card-3d">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><Building2 className="h-4 w-4" /></div>
                    <span className="font-medium">{p}</span>
                  </div>
                  <Button size="sm" variant="outline" disabled>Connect</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ================= PROFILE =================
function ProfilePage({ user, setUser }) {
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(user.name)
  const [currency, setCurrency] = useState(user.currency)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({ name, currency }) })
      setUser(data.user); toast.success('Profile updated')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-xl font-bold">Profile</h2>
      <Card className="card-3d">
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5"><Label>Email</Label><Input value={user.email} disabled /></div>
          <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Display currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">All amounts across your dashboard use this currency.</p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}><Sun className="h-4 w-4 mr-1" />Light</Button>
              <Button size="sm" variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}><Moon className="h-4 w-4 mr-1" />Dark</Button>
            </div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ================= ADMIN =================
function AdminPage({ currency }) {
  const [metrics, setMetrics] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  useEffect(() => {
    api('/admin/metrics').then(setMetrics).catch(e => toast.error(e.message))
    api('/admin/users').then(setUsers).catch(() => {})
    api('/admin/audit').then(setLogs).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Admin</h2>
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { l: 'Users', v: metrics.totalUsers },
            { l: 'Assets tracked', v: metrics.totalAssets },
            { l: 'Liabilities tracked', v: metrics.totalLiabilities },
            { l: 'Aggregate Net Worth', v: fmt(metrics.aggregateNetWorth, currency) },
          ].map(m => (
            <Card key={m.l} className="card-3d"><CardContent className="p-5"><div className="text-sm text-muted-foreground">{m.l}</div><div className="text-2xl font-bold mt-1">{m.v}</div></CardContent></Card>
          ))}
        </div>
      )}
      <Card className="card-3d">
        <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Net Worth</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(u.netWorth, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="card-3d">
        <CardHeader><CardTitle className="text-base">Audit Logs</CardTitle></CardHeader>
        <CardContent className="p-0 max-h-[360px] overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground text-xs">{new Date(l.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{l.email}</TableCell>
                  <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                  <TableCell>{l.entity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ================= APP SHELL =================
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'assets', label: 'Assets', icon: Wallet },
  { key: 'liabilities', label: 'Liabilities', icon: TrendingDown },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'profile', label: 'Profile', icon: User },
]

function AppShell({ user, setUser, onLogout }) {
  const [view, setView] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const currency = user.currency || 'USD'
  const nav = user.role === 'admin' ? [...NAV, { key: 'admin', label: 'Admin', icon: Shield }] : NAV

  const exportCsv = async () => {
    try {
      const res = await fetch('/api/export', { headers: { Authorization: `Bearer ${getToken()}` } })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'networth-export.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed') }
  }

  const NavList = () => (
    <nav className="space-y-1">
      {nav.map(n => (
        <button key={n.key} onClick={() => { setView(n.key); setMobileOpen(false) }}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${view === n.key ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
          <n.icon className="h-4 w-4" /> {n.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen mesh-bg">
      <div className="flex">
        {/* sidebar desktop */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-border/60 glass min-h-screen sticky top-0 p-4">
          <div className="flex items-center gap-2 px-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
            <span className="text-xl font-extrabold tracking-tight">Aureal</span>
          </div>
          <NavList />
          <div className="mt-auto space-y-2 pt-4">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onLogout}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
          </div>
        </aside>

        {/* main */}
        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 glass border-b border-border/60 px-4 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}><Menu className="h-5 w-5" /></Button>
              <h1 className="text-lg font-bold capitalize">{view}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                <Sun className="h-5 w-5 hidden dark:block" /><Moon className="h-5 w-5 dark:hidden" />
              </Button>
              <div className="flex items-center gap-2 rounded-full bg-muted pl-3 pr-1 py-1">
                <span className="text-sm font-medium hidden sm:block">{user.name}</span>
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{(user.name || 'U')[0].toUpperCase()}</div>
              </div>
            </div>
          </header>

          {mobileOpen && (
            <div className="lg:hidden px-4 py-3 border-b border-border/60 glass">
              <NavList />
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={onLogout}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
              </div>
            </div>
          )}

          <main className="p-4 lg:p-8 max-w-7xl">
            {view === 'dashboard' && <Dashboard currency={currency} goto={setView} />}
            {view === 'assets' && <EntityManager kind="assets" currency={currency} />}
            {view === 'liabilities' && <EntityManager kind="liabilities" currency={currency} />}
            {view === 'goals' && <GoalsPage currency={currency} />}
            {view === 'integrations' && <IntegrationsPage />}
            {view === 'profile' && <ProfilePage user={user} setUser={setUser} />}
            {view === 'admin' && user.role === 'admin' && <AdminPage currency={currency} />}
          </main>
        </div>
      </div>
    </div>
  )
}

// ================= ROOT =================
function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) { setReady(true); return }
    api('/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('nwt_token')).finally(() => setReady(true))
  }, [])

  const logout = () => { localStorage.removeItem('nwt_token'); setUser(null) }

  if (!ready) return <div className="min-h-screen mesh-bg flex items-center justify-center text-muted-foreground">Loading…</div>
  if (!user) return <AuthScreen onAuth={setUser} />
  return <AppShell user={user} setUser={setUser} onLogout={logout} />
}

export default App
