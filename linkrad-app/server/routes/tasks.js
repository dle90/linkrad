const express = require('express')
const crypto = require('crypto')
const pool = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const buildTask = (row, comments) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  deadline: row.deadline ? new Date(row.deadline).toISOString().split('T')[0] : null,
  priority: row.priority,
  status: row.status,
  result: row.result || '',
  assignee: row.assignee,
  assigneeName: row.assigneeName,
  department: row.department,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  comments: (comments || []).map(c => ({
    id: c.id,
    author: c.author,
    authorName: c.authorName,
    text: c.text,
    createdAt: c.createdAt,
  })),
})

const roleFilter = (user) => {
  if (user.role === 'giamdoc' || user.role === 'admin') return ['1=1', []]
  if (user.role === 'truongphong') return ['department = ?', [user.department]]
  if (user.role === 'nhanvien') return ['assignee = ?', [user.username]]
  return ['1=0', []]
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [where, params] = roleFilter(req.user)
    const [taskRows] = await pool.execute(
      `SELECT * FROM tasks WHERE ${where} ORDER BY createdAt DESC`, params
    )
    const [commentRows] = await pool.execute('SELECT * FROM task_comments ORDER BY createdAt ASC')
    const [userRows] = await pool.execute('SELECT username, displayName, role, department FROM users')

    const byTask = {}
    commentRows.forEach(c => {
      if (!byTask[c.taskId]) byTask[c.taskId] = []
      byTask[c.taskId].push(c)
    })

    res.json({ tasks: taskRows.map(t => buildTask(t, byTask[t.id])), users: userRows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireAuth, async (req, res) => {
  const { role, username, department } = req.user
  if (role === 'guest') return res.status(403).json({ error: 'Guest không thể tạo công việc' })

  const { title, description, deadline, priority, assignee } = req.body
  if (!title || !title.trim()) return res.status(400).json({ error: 'Tiêu đề công việc không được trống' })

  try {
    let taskAssignee = username
    let taskDept = department

    if ((role === 'truongphong' || role === 'giamdoc' || role === 'admin') && assignee) {
      taskAssignee = assignee
      const [r] = await pool.execute('SELECT department FROM users WHERE username = ?', [assignee])
      if (r[0]) taskDept = r[0].department || department
    }

    const [nameRows] = await pool.execute('SELECT displayName FROM users WHERE username = ?', [taskAssignee])
    const assigneeName = nameRows[0]?.displayName || taskAssignee

    const id = crypto.randomUUID()
    await pool.execute(
      `INSERT INTO tasks (id, title, description, deadline, priority, status, result, assignee, assigneeName, department, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'todo', '', ?, ?, ?, NOW(), NOW())`,
      [id, title.trim(), (description || '').trim(), deadline || null, priority || 'medium', taskAssignee, assigneeName, taskDept]
    )

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id])
    res.json(buildTask(rows[0], []))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  const { role, username, department } = req.user
  try {
    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy công việc' })
    const task = rows[0]

    if (role === 'guest') return res.status(403).json({ error: 'Không có quyền' })
    if (role === 'nhanvien' && task.assignee !== username) return res.status(403).json({ error: 'Không có quyền chỉnh sửa công việc của người khác' })
    if (role === 'truongphong' && task.department !== department) return res.status(403).json({ error: 'Không có quyền chỉnh sửa công việc phòng khác' })

    const { status, result, title, description, deadline, priority } = req.body
    const sets = []
    const vals = []

    if (status !== undefined)      { sets.push('status = ?');      vals.push(status) }
    if (result !== undefined)      { sets.push('result = ?');      vals.push(result) }
    if (role !== 'nhanvien' || task.assignee === username) {
      if (title !== undefined)       { sets.push('title = ?');       vals.push(title) }
      if (description !== undefined) { sets.push('description = ?'); vals.push(description) }
      if (deadline !== undefined)    { sets.push('deadline = ?');    vals.push(deadline || null) }
      if (priority !== undefined)    { sets.push('priority = ?');    vals.push(priority) }
    }
    sets.push('updatedAt = NOW()')

    await pool.execute(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id])

    const [updated] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    const [comments] = await pool.execute('SELECT * FROM task_comments WHERE taskId = ? ORDER BY createdAt ASC', [req.params.id])
    res.json(buildTask(updated[0], comments))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/comments', requireAuth, async (req, res) => {
  const { role, username, department, displayName } = req.user
  if (role === 'nhanvien' || role === 'guest') {
    return res.status(403).json({ error: 'Chỉ trưởng phòng và giám đốc mới có thể thêm nhận xét' })
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy công việc' })
    const task = rows[0]

    if (role === 'truongphong' && task.department !== department) {
      return res.status(403).json({ error: 'Không có quyền nhận xét công việc phòng khác' })
    }

    const { text } = req.body
    if (!text || !text.trim()) return res.status(400).json({ error: 'Nội dung nhận xét không được trống' })

    const id = crypto.randomUUID()
    await pool.execute(
      'INSERT INTO task_comments (id, taskId, author, authorName, text) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, username, displayName, text.trim()]
    )
    await pool.execute('UPDATE tasks SET updatedAt = NOW() WHERE id = ?', [req.params.id])

    const [updated] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    const [comments] = await pool.execute('SELECT * FROM task_comments WHERE taskId = ? ORDER BY createdAt ASC', [req.params.id])
    res.json(buildTask(updated[0], comments))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { role, username, department } = req.user
  try {
    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy công việc' })
    const task = rows[0]

    if (role === 'guest') return res.status(403).json({ error: 'Không có quyền' })
    if (role === 'nhanvien' && task.assignee !== username) return res.status(403).json({ error: 'Không có quyền xóa công việc của người khác' })
    if (role === 'truongphong' && task.department !== department) return res.status(403).json({ error: 'Không có quyền xóa công việc phòng khác' })

    await pool.execute('DELETE FROM task_comments WHERE taskId = ?', [req.params.id])
    await pool.execute('DELETE FROM tasks WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
