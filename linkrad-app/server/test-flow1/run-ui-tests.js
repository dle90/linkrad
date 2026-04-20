/**
 * Flow 1 — UI walkthrough for the NEW self-pick workflow.
 *
 * After API tests: _TEST_PATIENT_1 is verified (HOÀN THÀNH, owned by test_bs2
 * via admin reassign), _TEST_PATIENT_2_CRITICAL is reading (CHỜ KẾT QUẢ, by test_bs).
 */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://localhost:3002'
const SHOTS = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

const failures = []
const passes = []
const ok = (n) => { passes.push(n); console.log(`  PASS  ${n}`) }
const fail = (n, d) => { failures.push({ n, d }); console.log(`  FAIL  ${n}\n        ${d}`) }

async function login(page, username, password = 'pass') {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="text"]', { timeout: 5000 })
  await page.fill('input[type="text"]', username)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForSelector('aside a', { timeout: 10000 })
}

async function logoutAndClear(page) {
  await page.evaluate(() => { localStorage.removeItem('linkrad_auth') })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="text"]', { timeout: 5000 })
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

async function gotoRIS(page) {
  await page.goto(`${BASE}/ris`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('aside a', { timeout: 5000 })
  await page.waitForTimeout(2000)
}

async function clickRISTab(page, label) {
  const buttons = await page.$$('button')
  for (const b of buttons) {
    const t = (await b.textContent() || '').trim()
    if (t.includes(label)) { await b.click(); await page.waitForTimeout(800); return true }
  }
  return false
}

async function step(name, fn) { try { await fn() } catch (e) { fail(name, e.message || String(e)) } }

async function run() {
  console.log('\n=== Flow 1 UI walkthrough (self-pick workflow) ===\n')
  console.log(`Base: ${BASE}`)
  console.log(`Screenshots: ${SHOTS}\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()

  // ── 1. Admin login + sidebar intact ──
  await step('1. admin login + sidebar has Tài Chính + Đọc phim — Quản lý', async () => {
    await login(page, 'test_admin')
    const labels = (await page.$$eval('aside a', as => as.map(a => a.textContent.trim()))).join('|')
    if (!labels.includes('Tài Chính')) throw new Error('missing Tài Chính')
    if (!labels.includes('Đọc phim — Quản lý')) throw new Error('missing Đọc phim — Quản lý')
    await shot(page, '01-admin-sidebar')
    ok('1. admin login + sidebar has Tài Chính + Đọc phim — Quản lý')
  })

  // ── 2. Admin sees verified patient in HOÀN THÀNH tab ──
  await step('2. admin /ris HOÀN THÀNH → _TEST_PATIENT_1 (verified)', async () => {
    await gotoRIS(page)
    await clickRISTab(page, 'HOÀN THÀNH')
    const body = await page.textContent('body')
    if (!body.includes('_TEST_PATIENT_1')) throw new Error('verified patient not visible')
    await shot(page, '02-admin-ris-completed')
    ok('2. admin /ris HOÀN THÀNH → _TEST_PATIENT_1 (verified)')
  })

  // ── 3. Admin sees reading patient in CHỜ KẾT QUẢ tab ──
  await step('3. admin /ris CHỜ KẾT QUẢ → _TEST_PATIENT_2_CRITICAL (reading)', async () => {
    await clickRISTab(page, 'CHỜ KẾT QUẢ')
    const body = await page.textContent('body')
    if (!body.includes('_TEST_PATIENT_2_CRITICAL')) throw new Error('reading patient not visible')
    await shot(page, '03-admin-ris-pending')
    ok('3. admin /ris CHỜ KẾT QUẢ → _TEST_PATIENT_2_CRITICAL (reading)')
  })

  // ── 4. TeleradAdmin (Đọc phim — Quản lý) renders with new oversight UI ──
  await step('4. admin /telerad-admin shows Pool + workload (no assign queue)', async () => {
    await page.goto(`${BASE}/telerad-admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const body = await page.textContent('body')
    if (!body.includes('Giám sát đọc phim')) throw new Error('new title missing')
    if (!body.includes('Pool chưa nhận')) throw new Error('Pool tab missing')
    if (!body.includes('Tải việc BS')) throw new Error('workload panel missing')
    if (body.includes('Phân công') && body.includes('Chọn BS đọc phim')) {
      throw new Error('old assign UI still present')
    }
    await shot(page, '04-admin-telerad-oversight')
    ok('4. admin /telerad-admin shows Pool + workload (no assign queue)')
  })

  // ── 5. NEW: seed an unclaimed pool study so bacsi can pick ──
  await step('5. SETUP: create fresh pending_read study as unclaimed pool', async () => {
    // Login as nhanvien via API (easiest way)
    const loginRes = await page.evaluate(async (base) => {
      const r = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_nv', password: 'pass' }),
      })
      return r.json()
    }, BASE)
    const token = loginRes.token
    // Create patient → appointment → in_progress → pending_read
    const state = await page.evaluate(async ({ base, token }) => {
      const post = (path, body) => fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(r => r.json())
      const put = (path, body) => fetch(`${base}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(r => r.json())

      const p = await post('/api/registration/patients', { name: '_TEST_PATIENT_3_POOL', dob: '1985-05-05', gender: 'M', phone: '0900000003' })
      const a = await post('/api/registration/appointments', {
        patientId: p._id, patientName: p.name, gender: 'M',
        site: 'TEST_SITE', modality: 'XR',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      })
      const a2 = await put(`/api/registration/appointments/${a._id}`, { status: 'in_progress' })
      const s2 = await put(`/api/ris/studies/${a2.studyId}`, { status: 'pending_read', technician: 'test_nv', technicianName: 'TEST NV' })
      return { studyId: a2.studyId, status: s2.status, radiologist: s2.radiologist || null }
    }, { base: BASE, token })
    if (state.status !== 'pending_read') throw new Error(`study status=${state.status}`)
    if (state.radiologist) throw new Error(`study should be unclaimed, has radiologist=${state.radiologist}`)
    ok(`5. SETUP: created pool study ${state.studyId}`)
  })

  // ── 6. BACSI sees the pool study with "Chưa nhận" badge + Nhận ca button ──
  await step('6. BACSI /ris → pool study _TEST_PATIENT_3_POOL visible with "Nhận ca" button', async () => {
    await logoutAndClear(page)
    await login(page, 'test_bs')
    await gotoRIS(page)
    await clickRISTab(page, 'CHỜ KẾT QUẢ')
    const body = await page.textContent('body')
    if (!body.includes('_TEST_PATIENT_3_POOL')) throw new Error('pool study not visible to bacsi')
    if (!body.includes('Chưa nhận')) throw new Error('"Chưa nhận" badge not shown for unclaimed')
    if (!body.includes('Nhận ca')) throw new Error('"Nhận ca" button not visible')
    await shot(page, '06-bacsi-ris-pool')
    ok('6. BACSI /ris → pool study _TEST_PATIENT_3_POOL visible with "Nhận ca" button')
  })

  // ── 7. BACSI clicks Nhận ca → study moves to their claimed list ──
  await step('7. BACSI clicks "Nhận ca" → study becomes theirs', async () => {
    // accept the confirm dialog
    page.once('dialog', d => d.accept())
    await page.click('button:has-text("Nhận ca")')
    await page.waitForTimeout(2000)
    const body = await page.textContent('body')
    // Should now show the bacsi as owner (BS: test_bs or their display name)
    if (!body.includes('TEST Bác sĩ') && !body.includes('test_bs')) {
      throw new Error('picked study does not show radiologist')
    }
    if (body.match(/_TEST_PATIENT_3_POOL[\s\S]*Chưa nhận/)) {
      throw new Error('still shows "Chưa nhận" after pick')
    }
    await shot(page, '07-bacsi-after-pick')
    ok('7. BACSI clicks "Nhận ca" → study becomes theirs')
  })

  // ── 8. BACSI2 does NOT see the picked study (out of pool, not theirs) ──
  await step('8. BACSI2 /ris → does NOT see study picked by BACSI', async () => {
    await logoutAndClear(page)
    await login(page, 'test_bs2')
    await gotoRIS(page)
    await clickRISTab(page, 'CHỜ KẾT QUẢ')
    const body = await page.textContent('body')
    if (body.includes('_TEST_PATIENT_3_POOL')) {
      throw new Error('test_bs2 sees study picked by test_bs — leak')
    }
    await shot(page, '08-bacsi2-no-access')
    ok('8. BACSI2 /ris → does NOT see study picked by BACSI')
  })

  // ── 9. NHANVIEN does NOT see a Nhận ca button (only bacsi picks) ──
  await step('9. NHANVIEN /ris CHỜ KẾT QUẢ → no Nhận ca button visible', async () => {
    await logoutAndClear(page)
    await login(page, 'test_nv')
    await gotoRIS(page)
    await clickRISTab(page, 'CHỜ KẾT QUẢ')
    const nhanCaCount = await page.$$eval('button', bs => bs.filter(b => (b.textContent || '').trim() === 'Nhận ca').length)
    if (nhanCaCount > 0) throw new Error(`nhanvien sees ${nhanCaCount} Nhận ca button(s) — should be 0`)
    await shot(page, '09-nhanvien-no-pick')
    ok('9. NHANVIEN /ris CHỜ KẾT QUẢ → no Nhận ca button visible')
  })

  // ── 10. TeleradReading (Đọc phim — Của tôi) shows bacsi's picked cases ──
  await step('10. BACSI /telerad-reading → shows "Đang đọc" tab with their cases', async () => {
    await logoutAndClear(page)
    await login(page, 'test_bs')
    await page.goto(`${BASE}/telerad-reading`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const body = await page.textContent('body')
    if (!body.includes('Đang đọc')) throw new Error('Đang đọc tab missing')
    if (!body.includes('_TEST_PATIENT_3_POOL') && !body.includes('_TEST_PATIENT_2_CRITICAL')) {
      throw new Error('no claimed studies shown')
    }
    await shot(page, '10-bacsi-telerad-reading')
    ok('10. BACSI /telerad-reading → shows "Đang đọc" tab with their cases')
  })

  await browser.close()

  console.log(`\n=== UI SUMMARY ===`)
  console.log(`PASS: ${passes.length}`)
  console.log(`FAIL: ${failures.length}`)
  if (failures.length) {
    console.log('\nFailures:')
    failures.forEach(f => console.log(`  - ${f.n}\n    ${f.d}`))
    process.exit(1)
  }
  process.exit(0)
}

run().catch(e => { console.error('FATAL:', e); process.exit(2) })
