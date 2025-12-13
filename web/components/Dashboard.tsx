'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface EmployeeRole {
  id: string
  name: string
  description?: string
  is_primary: boolean
  valid_from: string
  valid_until?: string
  is_valid: boolean
}

interface Qualification {
  id: string
  name: string
  details?: string
  is_mandatory: boolean
  achieved_date: string
  expiry_date: string
  certificate_ref?: string
  is_expired: boolean
  days_until_expiry: number
}

interface Assignment {
  id: string
  shiftDate: string
  shiftStartTime: string
  shiftEndTime: string
  shiftRole: string
  location: string
  weeklyHours: number
  overtimeHours: number
  isCrossDepartment: boolean
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  department: string
  activeForRostering: boolean
  roles: EmployeeRole[]
  qualifications: Qualification[]
  assignments: Assignment[]
  totalHours: number
  totalShifts: number
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingRolesQuals, setLoadingRolesQuals] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Fetch roles and qualifications when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeRolesQualifications(selectedEmployee.id)
    }
  }, [selectedEmployee?.id])

  const fetchEmployeeRolesQualifications = async (employeeId: string) => {
    if (!selectedEmployee) return

    setLoadingRolesQuals(true)
    try {
      const response = await fetch(`http://localhost:8001/api/employees/${employeeId}/roles-qualifications`)
      if (response.ok) {
        const data = await response.json()
        setSelectedEmployee({
          ...selectedEmployee,
          roles: data.roles || [],
          qualifications: data.qualifications || []
        })
      }
    } catch (err) {
      console.error('Failed to load roles/qualifications:', err)
    } finally {
      setLoadingRolesQuals(false)
    }
  }

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch employees
      const empResponse = await fetch('http://localhost:8001/api/admin/employees')
      if (!empResponse.ok) throw new Error('Failed to fetch employees')
      const employeesData = await empResponse.json()

      // Fetch roles for mapping
      const rolesResponse = await fetch('http://localhost:8001/api/admin/roles')
      if (!rolesResponse.ok) throw new Error('Failed to fetch roles')
      const rolesData = await rolesResponse.json()
      const rolesMap = rolesData.reduce((acc: any, role: any) => {
        acc[role.id] = role.name
        return acc
      }, {})

      // Fetch all roster assignments
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 14)

      const startDate = format(weekAgo, 'yyyy-MM-dd')
      const endDate = format(nextWeek, 'yyyy-MM-dd')

      const rosterResponse = await fetch(
        `http://localhost:8001/api/roster/view?start_date=${startDate}&end_date=${endDate}`
      )
      if (!rosterResponse.ok) throw new Error('Failed to fetch roster data')
      const rosterData = await rosterResponse.json()

      // Build assignments map by employee ID
      const assignmentsByEmployee: { [key: string]: Assignment[] } = {}

      for (const day of rosterData) {
        for (const shift of day.shifts) {
          for (const assignment of shift.assignments) {
            const empId = assignment.employeeId
            if (!assignmentsByEmployee[empId]) {
              assignmentsByEmployee[empId] = []
            }
            assignmentsByEmployee[empId].push({
              id: assignment.id,
              shiftDate: day.date,
              shiftStartTime: shift.startTime,
              shiftEndTime: shift.endTime,
              shiftRole: shift.role,
              location: shift.location || 'N/A',
              weeklyHours: assignment.weeklyHours || 0,
              overtimeHours: 0,
              isCrossDepartment: false
            })
          }
        }
      }

      // Fetch employee roles
      const employeeRolesMap: { [key: string]: EmployeeRole[] } = {}
      for (const emp of employeesData) {
        try {
          // This is a simple approach - in production you'd have a proper endpoint
          // For now, we'll fetch roles from a hypothetical employee-roles endpoint
          employeeRolesMap[emp.id] = []
        } catch (e) {
          employeeRolesMap[emp.id] = []
        }
      }

      // Combine data
      const enrichedEmployees: Employee[] = employeesData.map((emp: any) => {
        const assignments = assignmentsByEmployee[emp.id] || []
        const totalHours = assignments.reduce((sum, a) => sum + a.weeklyHours, 0)

        return {
          id: emp.id,
          firstName: emp.first_name,
          lastName: emp.last_name,
          employeeCode: emp.employee_code,
          department: 'Operations', // TODO: Fetch from department table
          activeForRostering: emp.active_for_rostering,
          roles: [],
          qualifications: [],
          assignments,
          totalHours,
          totalShifts: assignments.length
        }
      })

      // Sort by total hours descending
      enrichedEmployees.sort((a, b) => b.totalHours - a.totalHours)

      setEmployees(enrichedEmployees)
      if (enrichedEmployees.length > 0 && !selectedEmployee) {
        setSelectedEmployee(enrichedEmployees[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEmployees = employees.filter(emp =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Dashboard</h2>
          <p className="text-gray-600 mt-1">Real-time view of employee assignments and workload</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Employees</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{employees.length}</p>
            </div>
            <div className="bg-blue-200 rounded-full p-3">
              <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Active Workers</p>
              <p className="text-3xl font-bold text-green-900 mt-1">
                {employees.filter(e => e.activeForRostering).length}
              </p>
            </div>
            <div className="bg-green-200 rounded-full p-3">
              <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Total Shifts</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                {employees.reduce((sum, e) => sum + e.totalShifts, 0)}
              </p>
            </div>
            <div className="bg-purple-200 rounded-full p-3">
              <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Total Hours</p>
              <p className="text-3xl font-bold text-orange-900 mt-1">
                {Math.round(employees.reduce((sum, e) => sum + e.totalHours, 0))}
              </p>
            </div>
            <div className="bg-orange-200 rounded-full p-3">
              <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Employees List + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Employees List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Employees</h3>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {filteredEmployees.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No employees found
              </div>
            ) : (
              filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => setSelectedEmployee(employee)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedEmployee?.id === employee.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                    {!employee.activeForRostering && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">{employee.employeeCode}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {employee.totalShifts} shifts
                    </span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {Math.round(employee.totalHours)}h
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Employee Details & Assignments */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          {selectedEmployee ? (
            <div>
              {/* Employee Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </h3>
                    <p className="text-gray-600 mt-1">{selectedEmployee.employeeCode}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedEmployee.activeForRostering
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {selectedEmployee.activeForRostering ? 'Active' : 'Inactive'}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Total Shifts</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedEmployee.totalShifts}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Total Hours</p>
                    <p className="text-2xl font-bold text-gray-900">{Math.round(selectedEmployee.totalHours)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Avg Hours/Shift</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedEmployee.totalShifts > 0
                        ? Math.round(selectedEmployee.totalHours / selectedEmployee.totalShifts)
                        : 0
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Roles & Qualifications Section */}
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Roles */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Valid Roles ({selectedEmployee.roles?.length || 0})
                    </h4>
                    {loadingRolesQuals ? (
                      <div className="text-center py-4 text-gray-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    ) : selectedEmployee.roles && selectedEmployee.roles.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEmployee.roles.map((role) => (
                          <div
                            key={role.id}
                            className={`p-3 rounded-lg border ${
                              role.is_primary
                                ? 'bg-blue-50 border-blue-300'
                                : role.is_valid
                                ? 'bg-white border-gray-200'
                                : 'bg-gray-100 border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {role.name}
                                  {role.is_primary && (
                                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                {role.description && (
                                  <div className="text-xs text-gray-600 mt-1">{role.description}</div>
                                )}
                              </div>
                              {!role.is_valid && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                  Expired
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No roles assigned
                      </div>
                    )}
                  </div>

                  {/* Qualifications */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      Qualifications ({selectedEmployee.qualifications?.length || 0})
                    </h4>
                    {loadingRolesQuals ? (
                      <div className="text-center py-4 text-gray-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                      </div>
                    ) : selectedEmployee.qualifications && selectedEmployee.qualifications.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEmployee.qualifications.map((qual) => (
                          <div
                            key={qual.id}
                            className={`p-3 rounded-lg border ${
                              qual.is_expired
                                ? 'bg-red-50 border-red-300'
                                : qual.days_until_expiry < 30
                                ? 'bg-amber-50 border-amber-300'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {qual.name}
                                  {qual.is_mandatory && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                      Required
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  Expires: {format(new Date(qual.expiry_date), 'MMM d, yyyy')}
                                  {!qual.is_expired && qual.days_until_expiry < 90 && (
                                    <span className="ml-2 text-amber-600 font-medium">
                                      ({qual.days_until_expiry} days left)
                                    </span>
                                  )}
                                </div>
                              </div>
                              {qual.is_expired && (
                                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                                  Expired
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No qualifications recorded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignments List */}
              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Shift Assignments
                </h4>

                {selectedEmployee.assignments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="font-medium">No assignments found</p>
                    <p className="text-sm mt-1">This employee has no scheduled shifts</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {selectedEmployee.assignments
                      .sort((a, b) => new Date(a.shiftDate).getTime() - new Date(b.shiftDate).getTime())
                      .map((assignment) => {
                        const assignmentDate = new Date(assignment.shiftDate)
                        const isPast = assignmentDate < new Date()
                        const isToday = format(assignmentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

                        return (
                          <div
                            key={assignment.id}
                            className={`p-4 rounded-lg border-l-4 ${
                              isToday
                                ? 'bg-blue-50 border-blue-500'
                                : isPast
                                ? 'bg-gray-50 border-gray-300'
                                : 'bg-white border-green-500'
                            } border border-gray-200 hover:shadow-md transition-shadow`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-900">
                                    {assignment.shiftRole}
                                  </span>
                                  {isToday && (
                                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                                      TODAY
                                    </span>
                                  )}
                                  {isPast && !isToday && (
                                    <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">
                                      Past
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  📍 {assignment.location}
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                {format(assignmentDate, 'MMM d, yyyy')}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {assignment.shiftStartTime} - {assignment.shiftEndTime}
                              </span>
                              <span className="flex items-center gap-1 font-medium">
                                {Math.round(assignment.weeklyHours)}h
                              </span>
                            </div>

                            {/* Role Match Badge */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600">Role Match:</span>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                  ✓ {assignment.shiftRole}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-12 text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="font-medium">Select an employee</p>
                <p className="text-sm mt-1">Choose an employee from the list to view their details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
