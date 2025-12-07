'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameDay, parseISO } from 'date-fns'

type ViewMode = 'day' | 'week' | 'month'

type AssignmentStatus = 'assigned' | 'unassigned' | 'overtime' | 'warning' | 'optimal'

interface ShiftAssignment {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  weeklyHours: number
  status: AssignmentStatus
  warnings?: string[]
}

interface Shift {
  id: string
  name: string
  startTime: string
  endTime: string
  requiredCount: number
  assignments: ShiftAssignment[]
  location?: string
  role: string
}

interface DaySchedule {
  date: string
  shifts: Shift[]
}

const getStatusColor = (status: AssignmentStatus) => {
  switch (status) {
    case 'optimal':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'overtime':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'unassigned':
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

const getShiftStatusColor = (shift: Shift) => {
  const gap = shift.requiredCount - shift.assignments.length
  if (gap > 0) return 'border-l-4 border-l-red-500 bg-red-50'
  if (shift.assignments.some(a => a.status === 'overtime')) return 'border-l-4 border-l-orange-500 bg-orange-50'
  if (shift.assignments.some(a => a.status === 'warning')) return 'border-l-4 border-l-yellow-500 bg-yellow-50'
  return 'border-l-4 border-l-green-500 bg-green-50'
}

export default function RosterView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [scheduleData, setScheduleData] = useState<DaySchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)

  const getDateRange = () => {
    switch (viewMode) {
      case 'day':
        return { start: currentDate, end: currentDate }
      case 'week':
        return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) }
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
    }
  }

  const navigate = (direction: 'prev' | 'next') => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1))
        break
      case 'week':
        setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
        break
      case 'month':
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
        break
    }
  }

  const goToToday = () => setCurrentDate(new Date())

  const { start, end } = getDateRange()

  // Fetch roster data from API
  useEffect(() => {
    const fetchRosterData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const startDate = format(start, 'yyyy-MM-dd')
        const endDate = format(end, 'yyyy-MM-dd')

        const response = await fetch(
          `http://localhost:8001/api/roster/view?start_date=${startDate}&end_date=${endDate}`
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch roster data: ${response.statusText}`)
        }

        const data = await response.json()

        // If no data, create empty schedule for date range
        if (!data || data.length === 0) {
          const emptySchedule = eachDayOfInterval({ start, end }).map(date => ({
            date: format(date, 'yyyy-MM-dd'),
            shifts: []
          }))
          setScheduleData(emptySchedule)
        } else {
          setScheduleData(data)
        }
      } catch (err) {
        console.error('Error fetching roster data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load roster data')
        // Set empty data on error
        const emptySchedule = eachDayOfInterval({ start, end }).map(date => ({
          date: format(date, 'yyyy-MM-dd'),
          shifts: []
        }))
        setScheduleData(emptySchedule)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRosterData()
  }, [start, end])

  const runOptimization = async () => {
    setIsOptimizing(true)
    setError(null)
    try {
      const startDate = format(start, 'yyyy-MM-dd')
      const endDate = format(end, 'yyyy-MM-dd')

      const response = await fetch('http://localhost:8001/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          save_results: true
        })
      })

      if (!response.ok) {
        throw new Error(`Optimization failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.status === 'completed') {
        // Reload roster data
        const rosterResponse = await fetch(
          `http://localhost:8001/api/roster/view?start_date=${startDate}&end_date=${endDate}`
        )
        const data = await rosterResponse.json()
        setScheduleData(data)
      } else if (result.job_id) {
        // TODO: Implement job polling for async optimization
        alert(`Optimization job started: ${result.job_id}. Please refresh to see results.`)
      }
    } catch (err) {
      console.error('Optimization error:', err)
      setError(err instanceof Error ? err.message : 'Optimization failed')
    } finally {
      setIsOptimizing(false)
    }
  }

  const getTotalStats = () => {
    let totalShifts = 0
    let totalAssignments = 0
    let totalRequired = 0
    let overtimeCount = 0
    let unassignedCount = 0

    scheduleData.forEach(day => {
      day.shifts.forEach(shift => {
        totalShifts++
        totalAssignments += shift.assignments.length
        totalRequired += shift.requiredCount
        if (shift.assignments.length < shift.requiredCount) {
          unassignedCount += (shift.requiredCount - shift.assignments.length)
        }
        overtimeCount += shift.assignments.filter(a => a.status === 'overtime').length
      })
    })

    return { totalShifts, totalAssignments, totalRequired, overtimeCount, unassignedCount }
  }

  const stats = getTotalStats()

  return (
    <div className="space-y-4">
      {/* Header with Navigation */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Roster Schedule</h2>
            <p className="text-sm text-gray-600 mt-1">
              {viewMode === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
              {viewMode === 'week' && `Week of ${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`}
              {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Run Optimizer Button */}
            <button
              onClick={runOptimization}
              disabled={isOptimizing || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {isOptimizing ? 'Optimizing...' : '🎯 Run Optimizer'}
            </button>

            {/* View Mode Toggle */}
            <div className="bg-gray-100 rounded-md p-1 flex gap-1">
              {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('prev')}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                title="Previous"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                Today
              </button>

              <button
                onClick={() => navigate('next')}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                title="Next"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-600">Total Shifts</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalShifts}</div>
          </div>
          <div className="bg-blue-50 rounded p-3">
            <div className="text-xs text-blue-600">Assigned</div>
            <div className="text-2xl font-bold text-blue-900">{stats.totalAssignments}</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-600">Required</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalRequired}</div>
          </div>
          <div className="bg-red-50 rounded p-3">
            <div className="text-xs text-red-600">Gaps</div>
            <div className="text-2xl font-bold text-red-900">{stats.unassignedCount}</div>
          </div>
          <div className="bg-orange-50 rounded p-3">
            <div className="text-xs text-orange-600">Overtime</div>
            <div className="text-2xl font-bold text-orange-900">{stats.overtimeCount}</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-600">Warning (40-48h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-600">Overtime (&gt;48h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="text-xs text-gray-600">Unassigned</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium">Error loading roster data</div>
              <div className="text-xs mt-1 opacity-90">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading roster data...</span>
          </div>
        </div>
      ) : (
        /* Schedule Grid */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {scheduleData.map((daySchedule) => {
              const dateObj = parseISO(daySchedule.date)
              const isToday = isSameDay(dateObj, new Date())

              return (
                <div key={daySchedule.date} className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`text-center ${isToday ? 'bg-blue-600 text-white rounded-lg px-3 py-2' : ''}`}>
                        <div className={`text-xs font-medium uppercase ${isToday ? 'text-blue-100' : 'text-gray-500'}`}>
                          {format(dateObj, 'EEE')}
                        </div>
                        <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                          {format(dateObj, 'd')}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{format(dateObj, 'EEEE')}</div>
                        <div className="text-xs text-gray-500">{format(dateObj, 'MMMM d, yyyy')}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {daySchedule.shifts.length} shift{daySchedule.shifts.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Shifts for the day */}
                  <div className="space-y-2 ml-16">
                    {daySchedule.shifts.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No shifts scheduled
                      </div>
                    ) : (
                      daySchedule.shifts.map((shift) => {
                        const gap = shift.requiredCount - shift.assignments.length

                        return (
                          <div
                            key={shift.id}
                            className={`rounded-lg p-4 ${getShiftStatusColor(shift)} transition-all hover:shadow-md`}
                          >
                            {/* Shift Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900">{shift.name}</h4>
                                  <span className="text-xs px-2 py-0.5 bg-white rounded-full text-gray-600">
                                    {shift.role}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {shift.startTime} - {shift.endTime}
                                  </span>
                                  {shift.location && (
                                    <span className="flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      {shift.location}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={`text-sm font-semibold ${gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {shift.assignments.length} / {shift.requiredCount}
                                </div>
                                <div className="text-xs text-gray-500">assigned</div>
                                {gap > 0 && (
                                  <div className="mt-1 text-xs font-medium text-red-600">
                                    ⚠️ {gap} gap{gap !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Assignments */}
                            {shift.assignments.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {shift.assignments.map((assignment) => (
                                  <div
                                    key={assignment.id}
                                    className={`px-3 py-2 rounded border ${getStatusColor(assignment.status)} text-sm`}
                                  >
                                    <div className="font-medium">{assignment.employeeName}</div>
                                    <div className="text-xs opacity-75">{assignment.employeeCode}</div>
                                    {assignment.warnings && assignment.warnings.length > 0 && (
                                      <div className="text-xs mt-1 opacity-90">
                                        {assignment.warnings.map((w, i) => (
                                          <div key={i}>⚠️ {w}</div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {/* Show empty slots */}
                                {gap > 0 && Array.from({ length: gap }).map((_, i) => (
                                  <div
                                    key={`empty-${i}`}
                                    className="px-3 py-2 rounded border border-dashed border-gray-300 bg-white text-sm text-gray-400 flex items-center justify-center min-w-[120px]"
                                  >
                                    <span>Unassigned</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed border-gray-300 rounded">
                                No assignments - {shift.requiredCount} needed
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info Note */}
      {!isLoading && scheduleData.length > 0 && scheduleData.every(d => d.shifts.length === 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium">No shift requirements found</div>
              <div className="text-xs mt-1 opacity-90">
                Add shift requirements to your database or click "Run Optimizer" to generate optimized assignments for existing shifts.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
