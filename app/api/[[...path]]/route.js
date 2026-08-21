import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid'

export const runtime = 'nodejs'

let client
let db

// ---- Google ----
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const googleClient = new OAuth2Client()

// ---- Plaid ----
function plaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET && process.env.PLAID_ENV)
}
function getPlaidClient() {
  if (!plaidConfigured()) return null
  const cfg = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV] || PlaidEnvironments.sandbox,
    baseOptions: { headers: { 'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID, 'PLAID-SECRET': process.env.PLAID_SECRET } },
  })
  return new PlaidApi(cfg)
}

// ---- CoinGecko (live crypto) ----
const COINS = {
  bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
  ethereum: { symbol: 'ETH', name: 'Ethereum' },
  solana: { symbol: 'SOL', name: 'Solana' },
  cardano: { symbol: 'ADA', name: 'Cardano' },
  ripple: { symbol: 'XRP', name: 'XRP' },
  dogecoin: { symbol: 'DOGE', name: 'Dogecoin' },
  polkadot: { symbol: 'DOT', name: 'Polkadot' },
  litecoin: { symbol: 'LTC', name: 'Litecoin' },
  chainlink: { symbol: 'LINK', name: 'Chainlink' },
  'matic-network': { symbol: 'MATIC', name: 'Polygon' },
  'avalanche-2': { symbol: 'AVAX', name: 'Avalanche' },
  tron: { symbol: 'TRX', name: 'TRON' },
  'binancecoin': { symbol: 'BNB', name: 'BNB' },
  'usd-coin': { symbol: 'USDC', name: 'USD Coin' },
  tether: { symbol: 'USDT', name: 'Tether' },
}
let priceCache = { ts: 0, data: {} }
async function getCryptoPrices(ids) {
  const unique = [...new Set(ids)].filter(Boolean).sort()
  if (!unique.length) return {}
  const now = Date.now()
  const missing = unique.filter(id => !priceCache.data[id])
  if (now - priceCache.ts < 60000 && missing.length === 0) return priceCache.data
  try {
    const params = new URLSearchParams({ ids: unique.join(','), vs_currencies: 'usd', include_24hr_change: 'true', include_last_updated_at: 'true' })
    const headers = {}
    if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`, { headers })
    if (!res.ok) throw new Error('price fetch failed')
    const data = await res.json()
    priceCache = { ts: now, data: { ...priceCache.data, ...data } }
    return priceCache.data
  } catch (e) {
    return priceCache.data
  }
}

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

    // ---------- GOOGLE SIGN-IN ----------
    if (route === '/auth/google' && method === 'POST') {
      if (!GOOGLE_CLIENT_ID) return json({ error: 'Google sign-in is not configured' }, 503)
      const body = await request.json()
      if (!body.credential) return json({ error: 'Missing credential' }, 400)
      let payload
      try {
        const ticket = await googleClient.verifyIdToken({ idToken: body.credential, audience: GOOGLE_CLIENT_ID })
        payload = ticket.getPayload()
      } catch {
        return json({ error: 'Google authentication failed' }, 401)
      }
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        return json({ error: 'Google account has no verified email' }, 401)
      }
      const email = payload.email.toLowerCase()
      let user = await db.collection('users').findOne({ googleSub: payload.sub })
      if (!user) user = await db.collection('users').findOne({ email })
      if (user) {
        await db.collection('users').updateOne({ id: user.id }, { $set: { googleSub: payload.sub, emailVerified: true, name: user.name || payload.name, image: payload.picture || user.image || null } })
        user = await db.collection('users').findOne({ id: user.id })
      } else {
        const count = await db.collection('users').countDocuments()
        const role = (count === 0 || email === (process.env.ADMIN_EMAIL || '').toLowerCase()) ? 'admin' : 'user'
        user = {
          id: uuidv4(), email, name: payload.name || email.split('@')[0], password: null,
          googleSub: payload.sub, image: payload.picture || null, currency: 'USD', role, emailVerified: true, createdAt: new Date(),
        }
        await db.collection('users').insertOne(user)
      }
      await audit(db, user.id, 'login_google', 'user', { email })
      return json({ token: signToken(user), user: publicUser(user) })
    }

    // ---------- FORGOT PASSWORD ----------
    if (route === '/auth/forgot' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').toLowerCase().trim()
      const user = await db.collection('users').findOne({ email })
      // Always respond ok to avoid account enumeration
      if (!user) return json({ ok: true })
      const rawToken = uuidv4() + uuidv4().replace(/-/g, '')
      const tokenHash = await bcrypt.hash(rawToken, 10)
      await db.collection('users').updateOne({ id: user.id }, { $set: { resetTokenHash: tokenHash, resetTokenExp: Date.now() + 3600000 } })
      await audit(db, user.id, 'forgot_password', 'user', { email })
      const emailConfigured = false // no email provider wired yet
      // For MVP without an email provider, return the token so the reset flow is usable.
      return json({ ok: true, emailSent: emailConfigured, devToken: emailConfigured ? undefined : rawToken })
    }

    // ---------- RESET PASSWORD ----------
    if (route === '/auth/reset' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').toLowerCase().trim()
      if (!body.token || !body.password || !email) return json({ error: 'Invalid request' }, 400)
      const user = await db.collection('users').findOne({ email })
      if (!user || !user.resetTokenHash || !user.resetTokenExp || user.resetTokenExp < Date.now()) {
        return json({ error: 'Reset link is invalid or expired' }, 400)
      }
      const okToken = await bcrypt.compare(body.token, user.resetTokenHash)
      if (!okToken) return json({ error: 'Reset link is invalid or expired' }, 400)
      await db.collection('users').updateOne({ id: user.id }, {
        $set: { password: await bcrypt.hash(body.password, 10) },
        $unset: { resetTokenHash: '', resetTokenExp: '' },
      })
      await audit(db, user.id, 'reset_password', 'user', { email })
      return json({ ok: true })
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

    // ---------- CONFIG (what integrations are live) ----------
    if (route === '/config' && method === 'GET') {
      return json({ googleEnabled: Boolean(GOOGLE_CLIENT_ID), plaidEnabled: plaidConfigured() })
    }

    // ---------- PLAID ----------
    if (route === '/plaid/link-token' && method === 'POST') {
      const plaid = getPlaidClient()
      if (!plaid) return json({ error: 'Plaid is not configured' }, 503)
      try {
        const resp = await plaid.linkTokenCreate({
          user: { client_user_id: userId },
          client_name: 'Aureal',
          language: 'en',
          country_codes: [CountryCode.Us],
          products: [Products.Auth],
        })
        return json({ link_token: resp.data.link_token })
      } catch (e) {
        console.error('plaid link-token', e?.response?.data?.error_code)
        return json({ error: 'Plaid request failed' }, 502)
      }
    }
    if (route === '/plaid/exchange' && method === 'POST') {
      const plaid = getPlaidClient()
      if (!plaid) return json({ error: 'Plaid is not configured' }, 503)
      const body = await request.json()
      if (!body.public_token) return json({ error: 'public_token required' }, 400)
      try {
        const ex = await plaid.itemPublicTokenExchange({ public_token: body.public_token })
        const { access_token, item_id } = ex.data
        await db.collection('plaid_items').updateOne(
          { userId, itemId: item_id },
          { $set: { accessToken: access_token, updatedAt: new Date() }, $setOnInsert: { userId, itemId: item_id, createdAt: new Date() } },
          { upsert: true }
        )
        await audit(db, userId, 'connect', 'bank', { item_id })
        return json({ item_id })
      } catch (e) {
        console.error('plaid exchange', e?.response?.data?.error_code)
        return json({ error: 'Plaid request failed' }, 502)
      }
    }
    if (route === '/plaid/balances' && method === 'GET') {
      const plaid = getPlaidClient()
      if (!plaid) return json({ error: 'Plaid is not configured' }, 503)
      try {
        const items = await db.collection('plaid_items').find({ userId }).toArray()
        const results = []
        for (const item of items) {
          const r = await plaid.accountsBalanceGet({ access_token: item.accessToken })
          results.push({ item_id: item.itemId, accounts: r.data.accounts })
        }
        return json({ items: results })
      } catch (e) {
        console.error('plaid balances', e?.response?.data?.error_code)
        return json({ error: 'Could not retrieve balances' }, 502)
      }
    }
    if (route === '/plaid/sync' && method === 'POST') {
      const plaid = getPlaidClient()
      if (!plaid) return json({ error: 'Plaid is not configured' }, 503)
      try {
        const items = await db.collection('plaid_items').find({ userId }).toArray()
        let imported = 0
        for (const item of items) {
          const r = await plaid.accountsBalanceGet({ access_token: item.accessToken })
          for (const acc of r.data.accounts) {
            const value = acc.balances?.current ?? acc.balances?.available ?? 0
            await db.collection('assets').updateOne(
              { userId, plaidAccountId: acc.account_id },
              { $set: { name: acc.name || acc.official_name || 'Bank Account', category: 'Bank Accounts', value: Number(value) || 0, notes: `Synced via Plaid (${acc.mask || ''})`, source: 'plaid', updatedAt: new Date() },
                $setOnInsert: { id: uuidv4(), userId, plaidAccountId: acc.account_id, createdAt: new Date() } },
              { upsert: true }
            )
            imported++
          }
        }
        await updateSnapshot(db, userId)
        await audit(db, userId, 'sync', 'bank', { imported })
        return json({ imported })
      } catch (e) {
        console.error('plaid sync', e?.response?.data?.error_code)
        return json({ error: 'Sync failed' }, 502)
      }
    }

    // ---------- CRYPTO (live prices) ----------
    if (route === '/crypto/coins' && method === 'GET') {
      return json(Object.entries(COINS).map(([id, v]) => ({ id, ...v })))
    }
    if (route === '/crypto' && method === 'GET') {
      const holdings = await db.collection('crypto_holdings').find({ userId }).sort({ createdAt: -1 }).toArray()
      const prices = await getCryptoPrices(holdings.map(h => h.coinId))
      let totalValue = 0, totalGainLoss = 0, totalDaily = 0
      const rows = holdings.map(({ _id, ...h }) => {
        const m = prices[h.coinId] || {}
        const currentPrice = m.usd ?? null
        const value = currentPrice == null ? null : h.quantity * currentPrice
        const costBasis = h.quantity * (h.averageCostUsd || 0)
        const gainLoss = value == null ? null : value - costBasis
        const changePct = m.usd_24h_change ?? null
        const daily = value == null || changePct == null ? null : value * (changePct / 100)
        if (value != null) totalValue += value
        if (gainLoss != null) totalGainLoss += gainLoss
        if (daily != null) totalDaily += daily
        return { ...h, currentPrice, value, gainLoss, dailyGainLoss: daily, changePct }
      })
      return json({ rows, totalValue, totalGainLoss, totalDailyGainLoss: totalDaily })
    }
    if (route === '/crypto' && method === 'POST') {
      const body = await request.json()
      const meta = COINS[body.coinId]
      if (!meta) return json({ error: 'Unknown coin' }, 400)
      const item = { id: uuidv4(), userId, coinId: body.coinId, symbol: meta.symbol, name: meta.name, quantity: Number(body.quantity) || 0, averageCostUsd: Number(body.averageCostUsd) || 0, createdAt: new Date() }
      await db.collection('crypto_holdings').insertOne(item)
      const { _id, ...r } = item
      return json(r)
    }
    if (route.startsWith('/crypto/') && method === 'PUT') {
      const body = await request.json()
      const update = {}
      if (body.quantity !== undefined) update.quantity = Number(body.quantity)
      if (body.averageCostUsd !== undefined) update.averageCostUsd = Number(body.averageCostUsd)
      await db.collection('crypto_holdings').updateOne({ id, userId }, { $set: update })
      const doc = await db.collection('crypto_holdings').findOne({ id, userId })
      return json(doc ? (({ _id, ...r }) => r)(doc) : {})
    }
    if (route.startsWith('/crypto/') && method === 'DELETE') {
      await db.collection('crypto_holdings').deleteOne({ id, userId })
      return json({ success: true })
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
