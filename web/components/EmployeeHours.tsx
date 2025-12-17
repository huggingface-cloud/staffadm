'use client'

import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isSameMonth, getWeek } from 'date-fns'

interface DailyHours {
  date: string
  hours: number
  shiftCount: number
}

interface EmployeeHoursData {
  employeeId: string
  employeeName: string
  department: string
  dailyHours: DailyHours[]
  weeklyTotal: number
  monthlyTotal: number
  contractedWeeklyHours: number
}

type ViewMode = 'week' | 'month'

interface EmployeeHoursProps {
  selectedDepartment?: string
}

export default function EmployeeHours({ selectedDepartment = 'all' }: EmployeeHoursProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [employeesData, setEmployeesData] = useState<EmployeeHoursData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'weeklyHours' | 'monthlyHours'>('weeklyHours')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Calculate date range based on view mode
  const getDateRange = () => {
    if (viewMode === 'week') {
      return {
        start: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      }
    } else {
      return {
        start: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
        end: format(endOfMonth(currentDate), 'yyyy-MM-dd')
      }
    }
  }

  const fetchEmployeeHours = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { start, end } = getDateRange()
      // Add department filter to the API call
      const departmentParam = selectedDepartment && selectedDepartment !== 'all'
        ? `&department_id=${selectedDepartment}`
        : ''
      const response = await fetch(`http://localhost:8001/api/employee-hours?start_date=${start}&end_date=${end}${departmentParam}`)

      if (!response.ok) {
        throw new Error('Failed to fetch employee hours')
      }

      const data = await response.json()
      setEmployeesData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployeeHours()
  }, [currentDate, viewMode, selectedDepartment])

  // Navigation functions
  const goToPrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1))
    } else {
      setCurrentDate(prev => subMonths(prev, 1))
    }
  }

  const goToNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1))
    } else {
      setCurrentDate(prev => addMonths(prev, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Get days to display
  const getDaysInRange = () => {
    const { start, end } = getDateRange()
    return eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end)
    })
  }

  // Filter and sort employees
  const getFilteredAndSortedEmployees = () => {
    let filtered = employeesData.filter(emp =>
      emp.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase())
    )

    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'name':
          aVal = a.employeeName
          bVal = b.employeeName
          break
        case 'weeklyHours':
          aVal = a.weeklyTotal
          bVal = b.weeklyTotal
          break
        case 'monthlyHours':
          aVal = a.monthlyTotal
          bVal = b.monthlyTotal
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return filtered
  }

  const days = getDaysInRange()
  const filteredEmployees = getFilteredAndSortedEmployees()

  // Calculate statistics
  const stats = {
    totalEmployees: employeesData.length,
    avgWeeklyHours: employeesData.length > 0
      ? (employeesData.reduce((sum, emp) => sum + emp.weeklyTotal, 0) / employeesData.length).toFixed(1)
      : 0,
    totalHours: viewMode === 'week'
      ? employeesData.reduce((sum, emp) => sum + emp.weeklyTotal, 0).toFixed(1)
      : employeesData.reduce((sum, emp) => sum + emp.monthlyTotal, 0).toFixed(1),
    overtimeEmployees: employeesData.filter(emp => emp.weeklyTotal > emp.contractedWeeklyHours).length
  }

  // Helper to get hours for a specific date
  const getHoursForDate = (employee: EmployeeHoursData, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayData = employee.dailyHours.find(d => d.date === dateStr)
    return dayData?.hours || 0
  }

  // Helper to get cell color based on hours
  const getCellColor = (hours: number) => {
    if (hours === 0) return 'bg-gray-50 text-gray-400'
    if (hours <= 4) return 'bg-green-50 text-green-900 font-medium'
    if (hours <= 8) return 'bg-blue-50 text-blue-900 font-semibold'
    if (hours <= 12) return 'bg-yellow-50 text-yellow-900 font-bold'
    return 'bg-red-50 text-red-900 font-bold'
  }

  const getWeeklyStatusColor = (weekly: number, contracted: number) => {
    const percent = (weekly / contracted) * 100
    if (percent > 120) return 'bg-red-100 border-red-400 text-red-900'
    if (percent > 100) return 'bg-orange-100 border-orange-400 text-orange-900'
    if (percent > 80) return 'bg-green-100 border-green-400 text-green-900'
    return 'bg-gray-100 border-gray-300 text-gray-600'
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Employee Hours Tracking
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {viewMode === 'week' ? 'Weekly' : 'Monthly'} schedule overview for all employees
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Week View
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🗓️ Month View
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              title="Previous"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Today
            </button>

            <button
              onClick={goToNext}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              title="Next"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="text-lg font-semibold text-gray-900">
            {viewMode === 'week' ? (
              `Week ${getWeek(currentDate)} - ${format(currentDate, 'MMM yyyy')}`
            ) : (
              format(currentDate, 'MMMM yyyy')
            )}
          </div>

          <div className="w-40" />
        </div>

        {/* Search and Sort */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search employees or departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="name">Sort by Name</option>
              <option value="weeklyHours">Sort by Weekly Hours</option>
              <option value="monthlyHours">Sort by Monthly Hours</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Employees</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Avg Weekly Hours</div>
          <div className="text-2xl font-bold text-blue-600">{stats.avgWeeklyHours}h</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Hours ({viewMode})</div>
          <div className="text-2xl font-bold text-green-600">{stats.totalHours}h</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Over Weekly Limit</div>
          <div className="text-2xl font-bold text-red-600">{stats.overtimeEmployees}</div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading employee hours...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Hours Table */}
      {!isLoading && !error && filteredEmployees.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Employee
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Dept
                  </th>
                  {days.map(day => (
                    <th
                      key={day.toISOString()}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200"
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div className="font-normal text-gray-600">{format(day, 'MMM d')}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-l-2 border-gray-300">
                    Week Total
                  </th>
                  {viewMode === 'month' && (
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200">
                      Month Total
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee, idx) => (
                  <tr key={employee.employeeId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">
                      <div>{employee.employeeName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Limit: {employee.contractedWeeklyHours}h/week
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {employee.department}
                    </td>
                    {days.map(day => {
                      const hours = getHoursForDate(employee, day)
                      return (
                        <td
                          key={day.toISOString()}
                          className={`px-3 py-3 text-center text-sm border-l border-gray-200 ${getCellColor(hours)}`}
                        >
                          {hours > 0 ? `${hours}h` : '-'}
                        </td>
                      )
                    })}
                    <td className={`px-4 py-3 text-center text-sm font-bold border-l-2 border-gray-300 ${
                      employee.weeklyTotal > employee.contractedWeeklyHours * 1.2
                        ? 'bg-red-100 text-red-900'
                        : employee.weeklyTotal > employee.contractedWeeklyHours
                        ? 'bg-orange-100 text-orange-900'
                        : 'text-gray-900'
                    }`}>
                      {employee.weeklyTotal.toFixed(1)}h
                      {employee.weeklyTotal > employee.contractedWeeklyHours && (
                        <div className="text-xs mt-0.5">
                          ⚠️ +{(employee.weeklyTotal - employee.contractedWeeklyHours).toFixed(1)}h
                        </div>
                      )}
                    </td>
                    {viewMode === 'month' && (
                      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 border-l border-gray-200">
                        {employee.monthlyTotal.toFixed(1)}h
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredEmployees.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600 text-lg">No employee hours data found</p>
          <p className="text-gray-500 text-sm mt-2">Try selecting a different date range or check if shifts have been assigned</p>
        </div>
      )}
    </div>
  )
}
