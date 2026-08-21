import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

function json(data, status = 200) {
  return handleCORS(NextResponse.json(data, { status }))
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// ---- auth helpers ----
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
}

async function getUser(request, db) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await db.collection('users').findOne({ id: decoded.id })
    return user || null
  } catch {
    return null
  }
}

function publicUser(u) {
  if (!u) return null
  const { _id, password, ...rest } = u
  return rest
}

async function audit(db, userId, action, entity, details) {
  await db.collection('audit_logs').insertOne({
    id: uuidv4(), userId, action, entity, details: details || {}, timestamp: new Date()
  })
}

// recompute + upsert today's snapshot for a user
async function updateSnapshot(db, userId) {
  const assets = await db.collection('assets').find({ userId }).toArray()
  const liabilities = await db.collection('liabilities').find({ userId }).toArray()
  const totalAssets = assets.reduce((s, a) => s + (Number(a.value) || 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.value) || 0), 0)
  const netWorth = totalAssets - totalLiabilities
  const day = new Date().toISOString().slice(0, 10)
  await db.collection('snapshots').updateOne(
    { userId, day },
    { $set: { userId, day, date: new Date(), totalAssets, totalLiabilities, netWorth } },
    { upsert: true }
  )
  return { totalAssets, totalLiabilities, netWorth }
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  const id = path[1]

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return json({ message: 'Aureal Net Worth API' })
    }

    // ---------- AUTH ----------
    if (route === '/auth/signup' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').toLowerCase().trim()
      if (!email || !body.password) return json({ error: 'Email and password required' }, 400)
      const existing = await db.collection('users').findOne({ email })
      if (existing) return json({ error: 'Account already exists' }, 409)
      const count = await db.collection('users').countDocuments()
      const role = (count === 0 || email === (process.env.ADMIN_EMAIL || '').toLowerCase()) ? 'admin' : 'user'
      const user = {
        id: uuidv4(),
        email,
        name: body.name || email.split('@')[0],
        password: await bcrypt.hash(body.password, 10),
        currency: body.currency || 'USD',
        role,
        emailVerified: true,
        createdAt: new Date(),
      }
      await db.collection('users').insertOne(user)
      await audit(db, user.id, 'signup', 'user', { email })
      return json({ token: signToken(user), user: publicUser(user) })
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').toLowerCase().trim()
      const user = await db.collection('users').findOne({ email })
      if (!user || !(await bcrypt.compare(body.password || '', user.password))) {
        return json({ error: 'Invalid email or password' }, 401)
      }
      await audit(db, user.id, 'login', 'user', {})
      return json({ token: signToken(user), user: publicUser(user) })
    }

    // ---------- everything below requires auth ----------
    const me = await getUser(request, db)
    if (!me) return json({ error: 'Unauthorized' }, 401)
    const userId = me.id

    if (route === '/auth/me' && method === 'GET') {
      return json({ user: publicUser(me) })
    }

    if (route === '/profile' && method === 'PUT') {
      const body = await request.json()
      const update = {}
      if (body.name !== undefined) update.name = body.name
      if (body.currency !== undefined) update.currency = body.currency
      await db.collection('users').updateOne({ id: userId }, { $set: update })
      const updated = await db.collection('users').findOne({ id: userId })
      return json({ user: publicUser(updated) })
    }

    // ---------- ASSETS ----------
    if (route === '/assets' && method === 'GET') {
      const items = await db.collection('assets').find({ userId }).sort({ createdAt: -1 }).toArray()
      return json(items.map(({ _id, ...r }) => r))
    }
    if (route === '/assets' && method === 'POST') {
      const body = await request.json()
      const item = {
        id: uuidv4(), userId,
        name: body.name || 'Untitled',
        category: body.category || 'Other',
        value: Number(body.value) || 0,
        notes: body.notes || '',
        createdAt: new Date(), updatedAt: new Date(),
      }
      await db.collection('assets').insertOne(item)
      await updateSnapshot(db, userId)
      await audit(db, userId, 'create', 'asset', { id: item.id, name: item.name })
      const { _id, ...r } = item
      return json(r)
    }
    if (route.startsWith('/assets/') && method === 'PUT') {
      const body = await request.json()
      const update = { updatedAt: new Date() }
      for (const k of ['name', 'category', 'value', 'notes']) {
        if (body[k] !== undefined) update[k] = k === 'value' ? Number(body[k]) : body[k]
      }
      await db.collection('assets').updateOne({ id, userId }, { $set: update })
      await updateSnapshot(db, userId)
      await audit(db, userId, 'update', 'asset', { id })
      const doc = await db.collection('assets').findOne({ id, userId })
      return json(doc ? (({ _id, ...r }) => r)(doc) : {})
    }
    if (route.startsWith('/assets/') && method === 'DELETE') {
      await db.collection('assets').deleteOne({ id, userId })
      await updateSnapshot(db, userId)
      await audit(db, userId, 'delete', 'asset', { id })
      return json({ success: true })
    }

    // ---------- LIABILITIES ----------
    if (route === '/liabilities' && method === 'GET') {
      const items = await db.collection('liabilities').find({ userId }).sort({ createdAt: -1 }).toArray()
      return json(items.map(({ _id, ...r }) => r))
    }
    if (route === '/liabilities' && method === 'POST') {
      const body = await request.json()
      const item = {
        id: uuidv4(), userId,
        name: body.name || 'Untitled',
        category: body.category || 'Other',
        value: Number(body.value) || 0,
        notes: body.notes || '',
        createdAt: new Date(), updatedAt: new Date(),
      }
      await db.collection('liabilities').insertOne(item)
      await updateSnapshot(db, userId)
      await audit(db, userId, 'create', 'liability', { id: item.id, name: item.name })
      const { _id, ...r } = item
      return json(r)
    }
    if (route.startsWith('/liabilities/') && method === 'PUT') {
      const body = await request.json()
      const update = { updatedAt: new Date() }
      for (const k of ['name', 'category', 'value', 'notes']) {
        if (body[k] !== undefined) update[k] = k === 'value' ? Number(body[k]) : body[k]
      }
      await db.collection('liabilities').updateOne({ id, userId }, { $set: update })
      await updateSnapshot(db, userId)
      await audit(db, userId, 'update', 'liability', { id })
      const doc = await db.collection('liabilities').findOne({ id, userId })
      return json(doc ? (({ _id, ...r }) => r)(doc) : {})
    }
    if (route.startsWith('/liabilities/') && method === 'DELETE') {
      await db.collection('liabilities').deleteOne({ id, userId })
      await updateSnapshot(db, userId)
      await audit(db, userId, 'delete', 'liability', { id })
      return json({ success: true })
    }

    // ---------- GOALS ----------
    if (route === '/goals' && method === 'GET') {
      const items = await db.collection('goals').find({ userId }).sort({ createdAt: -1 }).toArray()
      return json(items.map(({ _id, ...r }) => r))
    }
    if (route === '/goals' && method === 'POST') {
      const body = await request.json()
      const item = {
        id: uuidv4(), userId,
        title: body.title || 'My Goal',
        targetAmount: Number(body.targetAmount) || 0,
        targetDate: body.targetDate || null,
        createdAt: new Date(),
      }
      await db.collection('goals').insertOne(item)
      const { _id, ...r } = item
      return json(r)
    }
    if (route.startsWith('/goals/') && method === 'PUT') {
      const body = await request.json()
      const update = {}
      for (const k of ['title', 'targetAmount', 'targetDate']) {
        if (body[k] !== undefined) update[k] = k === 'targetAmount' ? Number(body[k]) : body[k]
      }
      await db.collection('goals').updateOne({ id, userId }, { $set: update })
      const doc = await db.collection('goals').findOne({ id, userId })
      return json(doc ? (({ _id, ...r }) => r)(doc) : {})
    }
    if (route.startsWith('/goals/') && method === 'DELETE') {
      await db.collection('goals').deleteOne({ id, userId })
      return json({ success: true })
    }

    // ---------- DASHBOARD ----------
    if (route === '/dashboard' && method === 'GET') {
      const assets = await db.collection('assets').find({ userId }).toArray()
      const liabilities = await db.collection('liabilities').find({ userId }).toArray()
      const totalAssets = assets.reduce((s, a) => s + (Number(a.value) || 0), 0)
      const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.value) || 0), 0)
      const netWorth = totalAssets - totalLiabilities

      const groupBy = (arr) => {
        const m = {}
        for (const x of arr) m[x.category] = (m[x.category] || 0) + (Number(x.value) || 0)
        return Object.entries(m).map(([name, value]) => ({ name, value }))
      }

      let snaps = await db.collection('snapshots').find({ userId }).sort({ day: 1 }).toArray()
      if (snaps.length === 0) {
        await updateSnapshot(db, userId)
        snaps = await db.collection('snapshots').find({ userId }).sort({ day: 1 }).toArray()
      }
      const history = snaps.map(s => ({ day: s.day, netWorth: s.netWorth, assets: s.totalAssets, liabilities: s.totalLiabilities }))

      // monthly growth
      let growth = 0, growthAmount = 0
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const prevSnaps = snaps.filter(s => s.day <= cutoff)
      const prev = prevSnaps.length ? prevSnaps[prevSnaps.length - 1] : snaps[0]
      if (prev) {
        growthAmount = netWorth - prev.netWorth
        growth = prev.netWorth !== 0 ? (growthAmount / Math.abs(prev.netWorth)) * 100 : 0
      }

      const goals = await db.collection('goals').find({ userId }).sort({ createdAt: -1 }).toArray()

      return json({
        summary: { netWorth, totalAssets, totalLiabilities, growth, growthAmount },
        allocation: groupBy(assets),
        liabilityBreakdown: groupBy(liabilities),
        history,
        goals: goals.map(({ _id, ...r }) => r),
      })
    }

    // ---------- EXPORT CSV ----------
    if (route === '/export' && method === 'GET') {
      const assets = await db.collection('assets').find({ userId }).toArray()
      const liabilities = await db.collection('liabilities').find({ userId }).toArray()
      const rows = [['Type', 'Name', 'Category', 'Value', 'Notes']]
      assets.forEach(a => rows.push(['Asset', a.name, a.category, a.value, a.notes || '']))
      liabilities.forEach(l => rows.push(['Liability', l.name, l.category, l.value, l.notes || '']))
      const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
      const res = new NextResponse(csv, { status: 200 })
      res.headers.set('Content-Type', 'text/csv')
      res.headers.set('Content-Disposition', 'attachment; filename="networth-export.csv"')
      return handleCORS(res)
    }

    // ---------- ADMIN ----------
    if (route.startsWith('/admin')) {
      if (me.role !== 'admin') return json({ error: 'Forbidden' }, 403)
      if (route === '/admin/users' && method === 'GET') {
        const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray()
        const withCounts = await Promise.all(users.map(async (u) => {
          const snap = await updateSnapshotReadOnly(db, u.id)
          return { ...publicUser(u), netWorth: snap.netWorth }
        }))
        return json(withCounts)
      }
      if (route === '/admin/metrics' && method === 'GET') {
        const totalUsers = await db.collection('users').countDocuments()
        const totalAssets = await db.collection('assets').countDocuments()
        const totalLiabilities = await db.collection('liabilities').countDocuments()
        const totalGoals = await db.collection('goals').countDocuments()
        const allAssets = await db.collection('assets').find({}).toArray()
        const allLiab = await db.collection('liabilities').find({}).toArray()
        const aum = allAssets.reduce((s, a) => s + (Number(a.value) || 0), 0)
        const debt = allLiab.reduce((s, l) => s + (Number(l.value) || 0), 0)
        return json({ totalUsers, totalAssets, totalLiabilities, totalGoals, aum, debt, aggregateNetWorth: aum - debt })
      }
      if (route === '/admin/audit' && method === 'GET') {
        const logs = await db.collection('audit_logs').find({}).sort({ timestamp: -1 }).limit(200).toArray()
        const users = await db.collection('users').find({}).toArray()
        const map = {}
        users.forEach(u => { map[u.id] = u.email })
        return json(logs.map(({ _id, ...r }) => ({ ...r, email: map[r.userId] || 'unknown' })))
      }
    }

    return json({ error: `Route ${route} not found` }, 404)
  } catch (error) {
    console.error('API Error:', error)
    return json({ error: 'Internal server error', detail: String(error?.message || error) }, 500)
  }
}

async function updateSnapshotReadOnly(db, userId) {
  const assets = await db.collection('assets').find({ userId }).toArray()
  const liabilities = await db.collection('liabilities').find({ userId }).toArray()
  const totalAssets = assets.reduce((s, a) => s + (Number(a.value) || 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.value) || 0), 0)
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
