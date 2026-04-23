/**
 * Tier 1 read-only API sanity test for the Kho (inventory) module.
 * Logs in as admin, then fetches every endpoint the Kho workspace +
 * new /catalogs/* inventory routes depend on and reports pass/fail.
 *
 * Usage: node scripts/test-inventory-api.js
 * No writes. Safe on prod Mongo.
 */

const BASE = 'http://localhost:3001/api'
const CREDS = { username: 'admin', password: 'linkrad2025' }

const results = []
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`) }
const fail = (name, err)           => { results.push({ name, ok: false, err }); console.log(`  ✗ ${name}  ${err}`) }

async function req(token, path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const body = await r.json().catch(() => null)
  return { status: r.status, body }
}

async function run() {
  console.log('\n— Tier 1 read-only inventory API sanity —\n')

  // 1. Auth
  console.log('1. Auth')
  const login = await req(null, '/auth/login', { method: 'POST', body: JSON.stringify(CREDS) })
  if (login.status !== 200 || !login.body?.token) { fail('login', `status=${login.status} body=${JSON.stringify(login.body)}`); return }
  const token = login.body.token
  pass('login', `role=${login.body.role} perms=${login.body.permissions?.length}`)

  // 2. Warehouses accessible
  console.log('\n2. Warehouses')
  const wh = await req(token, '/inventory/warehouses/accessible')
  if (wh.status !== 200) { fail('warehouses/accessible', `status=${wh.status}`); return }
  const whs = wh.body.warehouses || []
  pass('warehouses/accessible', `supervisor=${wh.body.supervisor} count=${whs.length}`)
  if (whs.length === 0) { fail('has warehouses', 'no warehouses returned — cannot scope further tests'); return }
  const firstWh = whs[0]
  const whParam = `?warehouseId=${firstWh._id}`

  // 3. Overview
  console.log('\n3. Overview (Tổng quan)')
  const alerts = await req(token, `/inventory/alerts${whParam}`)
  if (alerts.status === 200) {
    const a = alerts.body
    pass('alerts', `expiringSoon=${a.expiringSoon?.count30 ?? '?'} belowMin=${a.belowMinimum?.count ?? '?'} pendingTransfers=${a.pendingTransfers?.count ?? '?'} variance=${a.autoDeductVariance?.count ?? '?'}`)
  } else fail('alerts', `status=${alerts.status}`)

  const act = await req(token, `/inventory/activity-today${whParam}`)
  if (act.status === 200) pass('activity-today', `counts=${JSON.stringify(act.body?.counts || {})}`)
  else fail('activity-today', `status=${act.status}`)

  // 4. Stock + Matrix
  console.log('\n4. Stock & Matrix')
  const stock = await req(token, `/inventory/stock${whParam}`)
  if (stock.status === 200) pass('stock', `rows=${stock.body?.rows?.length ?? 0}`)
  else fail('stock', `status=${stock.status}`)

  const matrix = await req(token, '/inventory/stock/matrix')
  if (matrix.status === 200) pass('stock/matrix', `warehouses=${matrix.body?.warehouses?.length ?? 0} rows=${matrix.body?.rows?.length ?? 0}`)
  else fail('stock/matrix', `status=${matrix.status}`)

  // 5. Transactions
  console.log('\n5. Transactions')
  const txs = await req(token, `/inventory/transactions${whParam}`)
  if (txs.status === 200) pass('transactions', `count=${txs.body?.length ?? 0}`)
  else fail('transactions', `status=${txs.status}`)

  // 6. Stocktakes
  console.log('\n6. Stocktakes')
  const st = await req(token, `/inventory/stocktakes${whParam}`)
  if (st.status === 200) pass('stocktakes', `count=${st.body?.length ?? 0}`)
  else fail('stocktakes', `status=${st.status}`)

  // 7. New /catalogs/* inventory routes
  console.log('\n7. New /catalogs/* inventory catalogs (added 2026-04-23)')
  const supplies = await req(token, '/catalogs/supplies')
  if (supplies.status === 200) pass('catalogs/supplies', `count=${supplies.body?.length ?? 0}`)
  else fail('catalogs/supplies', `status=${supplies.status} body=${JSON.stringify(supplies.body)}`)

  const cats = await req(token, '/catalogs/supply-categories')
  if (cats.status === 200) pass('catalogs/supply-categories', `count=${cats.body?.length ?? 0}`)
  else fail('catalogs/supply-categories', `status=${cats.status} body=${JSON.stringify(cats.body)}`)

  const suppliers = await req(token, '/catalogs/suppliers')
  if (suppliers.status === 200) pass('catalogs/suppliers', `count=${suppliers.body?.length ?? 0}`)
  else fail('catalogs/suppliers', `status=${suppliers.status} body=${JSON.stringify(suppliers.body)}`)

  // 8. Mapping — verify serviceName hydration (the 3A fix)
  console.log('\n8. Supply-Service mapping — serviceName hydration')
  const mapNew = await req(token, '/catalogs/supply-service-mapping')
  const mapOld = await req(token, '/inventory/his-mapping')
  if (mapNew.status !== 200) fail('catalogs/supply-service-mapping', `status=${mapNew.status}`)
  else if (mapOld.status !== 200) fail('inventory/his-mapping', `status=${mapOld.status}`)
  else {
    const newRows = mapNew.body || []
    const oldRows = mapOld.body || []
    pass('catalogs/supply-service-mapping', `count=${newRows.length}`)
    pass('inventory/his-mapping (legacy)',    `count=${oldRows.length}`)
    const oldBlankNames = oldRows.filter(r => !r.serviceName).length
    const newBlankNames = newRows.filter(r => !r.serviceName).length
    if (oldBlankNames > 0 && newBlankNames === 0) {
      pass('serviceName hydration works', `legacy had ${oldBlankNames} blank serviceName; new endpoint has 0 blank`)
    } else if (oldBlankNames === 0 && newBlankNames === 0) {
      pass('serviceName hydration', 'both endpoints already populated (no test signal, but no regression)')
    } else if (newBlankNames > 0) {
      fail('serviceName hydration', `new endpoint still has ${newBlankNames} blank serviceName rows`)
      const sample = newRows.find(r => !r.serviceName)
      if (sample) console.log(`      sample: serviceId=${sample.serviceId} serviceCode=${sample.serviceCode}`)
    } else {
      pass('serviceName hydration', 'no duplication concerns')
    }
    if (newRows.length) console.log(`      sample row: ${JSON.stringify({ serviceCode: newRows[0].serviceCode, serviceName: newRows[0].serviceName, supplyCode: newRows[0].supplyCode, supplyName: newRows[0].supplyName, quantity: newRows[0].quantity })}`)
  }

  // 9. Legacy /inventory/* catalog reads (still used by Stock filter dropdown etc.)
  console.log('\n9. Legacy /inventory/* catalog endpoints (still in use)')
  const legSupplies = await req(token, '/inventory/supplies')
  if (legSupplies.status === 200) pass('inventory/supplies', `count=${legSupplies.body?.length ?? 0}`)
  else fail('inventory/supplies', `status=${legSupplies.status}`)

  const legCats = await req(token, '/inventory/categories')
  if (legCats.status === 200) pass('inventory/categories', `count=${legCats.body?.length ?? 0}`)
  else fail('inventory/categories', `status=${legCats.status}`)

  const legSuppliers = await req(token, '/inventory/suppliers')
  if (legSuppliers.status === 200) pass('inventory/suppliers', `count=${legSuppliers.body?.length ?? 0}`)
  else fail('inventory/suppliers', `status=${legSuppliers.status}`)

  // 10. Lots for a sample supply
  console.log('\n10. Lots FEFO order')
  const sampleSupplyId = stock.body?.rows?.[0]?.supply?._id
  if (!sampleSupplyId) {
    pass('lots (skipped)', 'no stock rows to probe a supplyId with')
  } else {
    const lots = await req(token, `/inventory/lots${whParam}&supplyId=${sampleSupplyId}`)
    if (lots.status === 200) {
      const arr = lots.body || []
      const dates = arr.map(l => l.expiryDate).filter(Boolean)
      const fefoOk = dates.every((d, i) => i === 0 || dates[i - 1] <= d)
      if (fefoOk) pass('lots FEFO order', `supplyId=${sampleSupplyId} lots=${arr.length}`)
      else fail('lots FEFO order', `expiry dates not ascending`)
    } else fail('lots', `status=${lots.status}`)
  }

  // Summary
  const okCount = results.filter(r => r.ok).length
  const failCount = results.length - okCount
  console.log(`\n— Summary: ${okCount}/${results.length} passed${failCount ? `, ${failCount} FAILED` : ''} —\n`)
  if (failCount) process.exit(1)
}

run().catch(e => { console.error('FATAL', e); process.exit(1) })
