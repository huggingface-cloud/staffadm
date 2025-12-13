'use client'

import { useState, useEffect } from 'react'

type AdminTab = 'employees' | 'shifts' | 'roles'

interface Role {
  id: string
  name: string
  description: string | null
  level: string | null
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_code: string
  department_id: string
  active_for_rostering: boolean
  joining_date: string
  opco_id: string
  roles?: string[]
}

interface ShiftRequirement {
  id: string
  start_time: string
  end_time: string
  headcount_needed: number
  required_role_id: string
  department_id: string
  location: string
}

interface Department {
  id: string
  name: string
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<ShiftRequirement[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form states
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [showBulkGenerate, setShowBulkGenerate] = useState(false)

  const [bulkCount, setBulkCount] = useState({ employees: 10, shifts: 20 })

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [employeesRes, shiftsRes, rolesRes, deptsRes] = await Promise.all([
        fetch('http://localhost:8001/api/admin/employees'),
        fetch('http://localhost:8001/api/admin/shifts'),
        fetch('http://localhost:8001/api/admin/roles'),
        fetch('http://localhost:8001/api/admin/departments')
      ])

      if (employeesRes.ok) setEmployees(await employeesRes.json())
      if (shiftsRes.ok) setShifts(await shiftsRes.json())
      if (rolesRes.ok) setRoles(await rolesRes.json())
      if (deptsRes.ok) setDepartments(await deptsRes.json())
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const generateBulkData = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      const response = await fetch('http://localhost:8001/api/admin/generate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_count: bulkCount.employees,
          shift_count: bulkCount.shifts
        })
      })

      if (!response.ok) throw new Error('Failed to generate bulk data')

      const result = await response.json()
      setMessage({
        type: 'success',
        text: `✅ Generated ${result.employees_created} employees and ${result.shifts_created} shifts!`
      })
      setShowBulkGenerate(false)
      loadData()
      setTimeout(() => setMessage(null), 5000)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : 'Failed to generate data'}` })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return

    try {
      const response = await fetch(`http://localhost:8001/api/admin/employees/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete employee')
      setMessage({ type: 'success', text: '✅ Employee deleted successfully' })
      loadData()
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : 'Failed to delete'}` })
    }
  }

  const deleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return

    try {
      const response = await fetch(`http://localhost:8001/api/admin/shifts/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete shift')
      setMessage({ type: 'success', text: '✅ Shift deleted successfully' })
      loadData()
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : 'Failed to delete'}` })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Admin Panel
              </h1>
              <p className="text-gray-600 mt-1">Manage employees, shifts, and system data</p>
            </div>

            <button
              onClick={() => setShowBulkGenerate(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              ⚡ Generate Test Data
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6">
            {[
              { id: 'employees' as AdminTab, label: '👥 Employees', count: employees.length },
              { id: 'shifts' as AdminTab, label: '📅 Shift Requirements', count: shifts.length },
              { id: 'roles' as AdminTab, label: '🎭 Roles & Qualifications', count: roles.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {activeTab === 'employees' && (
            <EmployeesTab
              employees={employees}
              roles={roles}
              departments={departments}
              onDelete={deleteEmployee}
              onRefresh={loadData}
              showForm={showEmployeeForm}
              setShowForm={setShowEmployeeForm}
              setMessage={setMessage}
            />
          )}

          {activeTab === 'shifts' && (
            <ShiftsTab
              shifts={shifts}
              roles={roles}
              departments={departments}
              onDelete={deleteShift}
              onRefresh={loadData}
              showForm={showShiftForm}
              setShowForm={setShowShiftForm}
              setMessage={setMessage}
            />
          )}

          {activeTab === 'roles' && (
            <RolesTab
              roles={roles}
              onRefresh={loadData}
              showForm={showRoleForm}
              setShowForm={setShowRoleForm}
              setMessage={setMessage}
            />
          )}
        </div>

        {/* Bulk Generate Modal */}
        {showBulkGenerate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Test Data</h2>
              <p className="text-gray-600 mb-6">Create random employees and shifts for testing</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Employees
                  </label>
                  <input
                    type="number"
                    value={bulkCount.employees}
                    onChange={(e) => setBulkCount({ ...bulkCount, employees: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Shifts
                  </label>
                  <input
                    type="number"
                    value={bulkCount.shifts}
                    onChange={(e) => setBulkCount({ ...bulkCount, shifts: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                    max="200"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={generateBulkData}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 font-semibold"
                >
                  {isLoading ? 'Generating...' : 'Generate'}
                </button>
                <button
                  onClick={() => setShowBulkGenerate(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Employees Tab Component
function EmployeesTab({
  employees,
  roles,
  departments,
  onDelete,
  onRefresh,
  showForm,
  setShowForm,
  setMessage
}: any) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    department_id: '',
    active_for_rostering: true,
    joining_date: new Date().toISOString().split('T')[0],
    role_ids: [] as string[]
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('http://localhost:8001/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to create employee')

      setMessage({ type: 'success', text: '✅ Employee created successfully' })
      setShowForm(false)
      setFormData({
        first_name: '',
        last_name: '',
        department_id: '',
        active_for_rostering: true,
        joining_date: new Date().toISOString().split('T')[0],
        role_ids: []
      })
      onRefresh()
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : 'Failed to create'}` })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Employees</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {/* Add Employee Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Department</option>
                {departments.map((dept: Department) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Joining Date</label>
              <input
                type="date"
                required
                value={formData.joining_date}
                onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Roles & Qualifications</label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map((role: Role) => (
                <label key={role.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-purple-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role_ids.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, role_ids: [...formData.role_ids, role.id] })
                      } else {
                        setFormData({ ...formData, role_ids: formData.role_ids.filter(id => id !== role.id) })
                      }
                    }}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">{role.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="active"
              checked={formData.active_for_rostering}
              onChange={(e) => setFormData({ ...formData, active_for_rostering: e.target.checked })}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Active for Rostering
            </label>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold"
          >
            Create Employee
          </button>
        </form>
      )}

      {/* Employees Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp: Employee) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {emp.first_name} {emp.last_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{emp.employee_code}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    emp.active_for_rostering
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {emp.active_for_rostering ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(emp.joining_date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(emp.id)}
                    className="text-red-600 hover:text-red-800 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Shifts Tab Component
function ShiftsTab({
  shifts,
  roles,
  departments,
  onDelete,
  onRefresh,
  showForm,
  setShowForm,
  setMessage
}: any) {
  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    headcount_needed: 1,
    required_role_id: '',
    department_id: '',
    location: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('http://localhost:8001/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to create shift')

      setMessage({ type: 'success', text: '✅ Shift created successfully' })
      setShowForm(false)
      setFormData({
        start_time: '',
        end_time: '',
        headcount_needed: 1,
        required_role_id: '',
        department_id: '',
        location: ''
      })
      onRefresh()
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : 'Failed to create'}` })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Shift Requirements</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Shift'}
        </button>
      </div>

      {/* Add Shift Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Headcount Needed</label>
              <input
                type="number"
                required
                min="1"
                value={formData.headcount_needed}
                onChange={(e) => setFormData({ ...formData, headcount_needed: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Required Role</label>
              <select
                required
                value={formData.required_role_id}
                onChange={(e) => setFormData({ ...formData, required_role_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Role</option>
                {roles.map((role: Role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Department</option>
                {departments.map((dept: Department) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Terminal 5"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold"
          >
            Create Shift
          </button>
        </form>
      )}

      {/* Shifts Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headcount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shifts.map((shift: ShiftRequirement) => (
              <tr key={shift.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(shift.start_time).toLocaleString()} - {new Date(shift.end_time).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{shift.location}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{shift.headcount_needed}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(shift.id)}
                    className="text-red-600 hover:text-red-800 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Roles Tab Component
function RolesTab({
  roles,
  onRefresh,
  showForm,
  setShowForm,
  setMessage
}: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('http://localhost:8001/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to create role')

      setMessage({ type: 'success', text: '✅ Role created successfully' })
      setShowForm(false)
      setFormData({ name: '', description: '', level: '' })
      onRefresh()
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : 'Failed to create'}` })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Roles & Qualifications</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Role'}
        </button>
      </div>

      {/* Add Role Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Baggage Handler L2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
              <input
                type="text"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., L1, L2, L3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Brief description"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold"
          >
            Create Role
          </button>
        </form>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-3 gap-4">
        {roles.map((role: Role) => (
          <div key={role.id} className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-gray-900">{role.name}</h3>
              {role.level && (
                <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                  {role.level}
                </span>
              )}
            </div>
            {role.description && (
              <p className="text-sm text-gray-600">{role.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
