const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
const TASKS_FILE = path.join(__dirname, '../data/tasks.json')
const USERS_FILE = path.join(__dirname, '../data/users.json')

const loadTasks = () => {
  try { return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) }
  catch { return [] }
}
const saveTasks = (tasks) => {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2))
}
const loadUsers = () => {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) }
  catch { return {} }
}

// Filter tasks by role
const visibleTasks = (tasks, user) => {
  if (user.role === 'giamdoc' || user.role === 'admin') return tasks
  if (user.role === 'truongphong') {
    return tasks.filter(t => t.department === user.department)
  }
  if (user.role === 'nhanvien') {
    return tasks.filter(t => t.assignee === user.username)
  }
  return []
}

// GET /api/tasks — returns tasks visible to caller + list of users (for manager/director)
router.get('/', requireAuth, (req, res) => {
  const tasks = loadTasks()
  const users = loadUsers()

  // Build user list (for manager/director to see employees)
  const userList = Object.entries(users).map(([username, u]) => ({
    username,
    displayName: u.displayName || username,
    role: u.role,
    department: u.department,
  }))

  res.json({ tasks: visibleTasks(tasks, req.user), users: userList })
})

// POST /api/tasks — create task (nhanvien, truongphong, admin)
router.post('/', requireAuth, (req, res) => {
  const { role, username, department, displayName } = req.user
  if (role === 'guest') {
    return res.status(403).json({ error: 'Guest không thể tạo công việc' })
  }

  const { title, description, deadline, priority, assignee } = req.body
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Tiêu đề công việc không được trống' })
  }

  const users = loadUsers()
  // For nhanvien: always assign to self. For truongphong/giamdoc/admin: can assign to anyone
  let taskAssignee = username
  let taskDept = department
  if ((role === 'truongphong' || role === 'giamdoc' || role === 'admin') && assignee) {
    taskAssignee = assignee
    taskDept = users[assignee]?.department || department
  }

  const now = new Date().toISOString()
  const task = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || '').trim(),
    deadline: deadline || null,
    priority: priority || 'medium',
    status: 'todo',
    result: '',
    assignee: taskAssignee,
    assigneeName: users[taskAssignee]?.displayName || taskAssignee,
    department: taskDept,
    createdAt: now,
    updatedAt: now,
    comments: [],
  }

  const tasks = loadTasks()
  tasks.push(task)
  saveTasks(tasks)
  res.json(task)
})

// PUT /api/tasks/:id — update task
router.put('/:id', requireAuth, (req, res) => {
  const { role, username, department } = req.user
  const tasks = loadTasks()
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy công việc' })

  const task = tasks[idx]

  // Check permission
  if (role === 'guest') return res.status(403).json({ error: 'Không có quyền' })
  if (role === 'nhanvien' && task.assignee !== username) return res.status(403).json({ error: 'Không có quyền chỉnh sửa công việc của người khác' })
  if (role === 'truongphong' && task.department !== department) return res.status(403).json({ error: 'Không có quyền chỉnh sửa công việc phòng khác' })

  const { status, result, title, description, deadline, priority } = req.body

  if (status !== undefined) task.status = status
  if (result !== undefined) task.result = result
  // Only truongphong/giamdoc/admin can edit title/deadline/priority of others' tasks
  if (role !== 'nhanvien' || task.assignee === username) {
    if (title !== undefined) task.title = title
    if (description !== undefined) task.description = description
    if (deadline !== undefined) task.deadline = deadline
    if (priority !== undefined) task.priority = priority
  }
  task.updatedAt = new Date().toISOString()

  tasks[idx] = task
  saveTasks(tasks)
  res.json(task)
})

// POST /api/tasks/:id/comments — add comment (truongphong, giamdoc, admin)
router.post('/:id/comments', requireAuth, (req, res) => {
  const { role, username, department, displayName } = req.user
  if (role === 'nhanvien' || role === 'guest') {
    return res.status(403).json({ error: 'Chỉ trưởng phòng và giám đốc mới có thể thêm nhận xét' })
  }

  const tasks = loadTasks()
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy công việc' })

  const task = tasks[idx]
  if (role === 'truongphong' && task.department !== department) {
    return res.status(403).json({ error: 'Không có quyền nhận xét công việc phòng khác' })
  }

  const { text } = req.body
  if (!text || !text.trim()) return res.status(400).json({ error: 'Nội dung nhận xét không được trống' })

  const comment = {
    id: crypto.randomUUID(),
    author: username,
    authorName: displayName,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }

  task.comments.push(comment)
  task.updatedAt = new Date().toISOString()
  tasks[idx] = task
  saveTasks(tasks)
  res.json(task)
})

// DELETE /api/tasks/:id — delete (own task for nhanvien, dept for truongphong, all for giamdoc/admin)
router.delete('/:id', requireAuth, (req, res) => {
  const { role, username, department } = req.user
  const tasks = loadTasks()
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy công việc' })

  const task = tasks[idx]
  if (role === 'guest') return res.status(403).json({ error: 'Không có quyền' })
  if (role === 'nhanvien' && task.assignee !== username) return res.status(403).json({ error: 'Không có quyền xóa công việc của người khác' })
  if (role === 'truongphong' && task.department !== department) return res.status(403).json({ error: 'Không có quyền xóa công việc phòng khác' })

  tasks.splice(idx, 1)
  saveTasks(tasks)
  res.json({ ok: true })
})

module.exports = router
