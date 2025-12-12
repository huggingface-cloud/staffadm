'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameDay, isToday, isPast, isFuture } from 'date-fns'

type ViewMode = 'day' | 'week' | 'month'
type ZoomLevel = 'compact' | 'normal' | 'comfortable'

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
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-200'
    case 'assigned':
      return 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-200'
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-200'
    case 'overtime':
      return 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-200'
    case 'unassigned':
      return 'bg-gray-50 text-gray-500 border-gray-200'
  }
}

const getShiftStatusBorder = (shift: Shift) => {
  const gap = shift.requiredCount - shift.assignments.length
  if (gap > 0) return 'border-l-4 border-l-red-500'
  if (shift.assignments.some(a => a.status === 'overtime')) return 'border-l-4 border-l-orange-500'
  if (shift.assignments.some(a => a.status === 'warning')) return 'border-l-4 border-l-amber-500'
  return 'border-l-4 border-l-emerald-500'
}

export default function RosterView() {
  // Always default to today
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('normal')
  const [scheduleData, setScheduleData] = useState<DaySchedule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [loadedDateRanges, setLoadedDateRanges] = useState<Set<string>>(new Set())
  const [showOptimizerModal, setShowOptimizerModal] = useState(false)
  const [optimizeWindow, setOptimizeWindow] = useState<'day' | 'week' | 'month' | '3months' | '6months' | 'custom'>('week')
  const [customOptimizeStart, setCustomOptimizeStart] = useState('')
  const [customOptimizeEnd, setCustomOptimizeEnd] = useState('')

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Reset to today on component mount/refresh
  useEffect(() => {
    setCurrentDate(new Date())
  }, [])

  const getDateRange = () => {
    const today = new Date()
    switch (viewMode) {
      case 'day':
        return { start: currentDate, end: currentDate }
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 })
        }
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

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const { start, end } = getDateRange()
  const startDate = format(start, 'yyyy-MM-dd')
  const endDate = format(end, 'yyyy-MM-dd')

  // Lazy load data for date range
  const loadDateRange = useCallback(async (start: string, end: string) => {
    const rangeKey = `${start}_${end}`
    if (loadedDateRanges.has(rangeKey)) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `http://localhost:8001/api/roster/view?start_date=${start}&end_date=${end}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch roster data: ${response.statusText}`)
      }

      const data = await response.json()
      setScheduleData(prev => {
        const newData = [...prev, ...(data || [])]
        // Remove duplicates based on date
        const unique = newData.reduce((acc, curr) => {
          if (!acc.find((item: DaySchedule) => item.date === curr.date)) {
            acc.push(curr)
          }
          return acc
        }, [] as DaySchedule[])
        return unique.sort((a: DaySchedule, b: DaySchedule) => a.date.localeCompare(b.date))
      })
      setLoadedDateRanges(prev => new Set([...prev, rangeKey]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      // Create empty schedule on error
      const days = eachDayOfInterval({ start: new Date(start), end: new Date(end) })
      const emptySchedule = days.map(day => ({
        date: format(day, 'yyyy-MM-dd'),
        shifts: []
      }))
      setScheduleData(emptySchedule)
    } finally {
      setIsLoading(false)
    }
  }, [loadedDateRanges])

  // Load current view data
  useEffect(() => {
    loadDateRange(startDate, endDate)
  }, [startDate, endDate, loadDateRange])

  const getOptimizationDateRange = () => {
    const today = new Date()
    let start, end

    switch (optimizeWindow) {
      case 'day':
        start = format(currentDate, 'yyyy-MM-dd')
        end = format(currentDate, 'yyyy-MM-dd')
        break
      case 'week':
        start = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        end = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
      case 'month':
        start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
        break
      case '3months':
        start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        end = format(endOfMonth(addMonths(currentDate, 2)), 'yyyy-MM-dd')
        break
      case '6months':
        start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        end = format(endOfMonth(addMonths(currentDate, 5)), 'yyyy-MM-dd')
        break
      case 'custom':
        start = customOptimizeStart
        end = customOptimizeEnd
        break
      default:
        start = startDate
        end = endDate
    }

    return { start, end }
  }

  const runOptimization = async () => {
    setIsOptimizing(true)
    setError(null)
    setShowOptimizerModal(false)

    const { start, end } = getOptimizationDateRange()

    try {
      const response = await fetch('http://localhost:8001/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: start,
          end_date: end,
          save_results: true
        })
      })

      if (!response.ok) {
        throw new Error(`Optimization failed: ${response.statusText}`)
      }

      const result = await response.json()

      // Reload data regardless of status
      const rosterResponse = await fetch(
        `http://localhost:8001/api/roster/view?start_date=${startDate}&end_date=${endDate}`
      )
      const data = await rosterResponse.json()
      setScheduleData(data || [])

      // Clear loaded ranges to force reload
      setLoadedDateRanges(new Set())

      if (result.status === 'Optimal') {
        // Show success message
        const successMsg = `✅ Optimization complete! ${result.statistics?.total_hours || 0}h scheduled`
        setError(successMsg)
        setTimeout(() => setError(null), 5000)
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

    const coveragePercent = totalRequired > 0 ? Math.round((totalAssignments / totalRequired) * 100) : 0

    return { totalShifts, totalAssignments, totalRequired, overtimeCount, unassignedCount, coveragePercent }
  }

  const stats = getTotalStats()

  // Zoom level styles
  const getZoomStyles = () => {
    switch (zoomLevel) {
      case 'compact':
        return {
          cardPadding: 'p-2',
          textSize: 'text-xs',
          titleSize: 'text-sm',
          badgeSize: 'text-[10px] px-1.5 py-0.5',
          spacing: 'space-y-1',
          gap: 'gap-1'
        }
      case 'comfortable':
        return {
          cardPadding: 'p-6',
          textSize: 'text-base',
          titleSize: 'text-xl',
          badgeSize: 'text-sm px-4 py-2',
          spacing: 'space-y-3',
          gap: 'gap-3'
        }
      default: // normal
        return {
          cardPadding: 'p-4',
          textSize: 'text-sm',
          titleSize: 'text-base',
          badgeSize: 'text-xs px-2 py-1',
          spacing: 'space-y-2',
          gap: 'gap-2'
        }
    }
  }

  const zoomStyles = getZoomStyles()

  // Auto-adjust zoom based on content density
  useEffect(() => {
    const totalItems = scheduleData.reduce((sum, day) => sum + day.shifts.length, 0)
    if (totalItems > 50) {
      setZoomLevel('compact')
    } else if (totalItems < 10) {
      setZoomLevel('comfortable')
    } else {
      setZoomLevel('normal')
    }
  }, [scheduleData])

  const days = eachDayOfInterval({ start, end })

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Floating Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm shadow-md border-b border-gray-200">
        <div className="px-6 py-4">
          {/* Title and Primary Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Staff Roster
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {viewMode === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
                  {viewMode === 'week' && `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`}
                  {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                </p>
              </div>

              {/* Coverage Indicator */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-medium text-gray-700">Coverage</span>
                </div>
                <span className={`text-2xl font-bold ${stats.coveragePercent >= 90 ? 'text-emerald-600' : stats.coveragePercent >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {stats.coveragePercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Optimizer Button with Gradient */}
              <button
                onClick={() => setShowOptimizerModal(true)}
                disabled={isOptimizing || isLoading}
                className="relative px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {isOptimizing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Optimizing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run Optimizer
                  </span>
                )}
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {(['compact', 'normal', 'comfortable'] as ZoomLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setZoomLevel(level)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      zoomLevel === level
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title={`${level.charAt(0).toUpperCase() + level.slice(1)} view`}
                  >
                    {level === 'compact' && '─'}
                    {level === 'normal' && '═'}
                    {level === 'comfortable' && '≡'}
                  </button>
                ))}
              </div>

              {/* View Mode Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
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
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => navigate('prev')}
                  className="p-2 rounded-lg hover:bg-white transition-all duration-200 text-gray-700 hover:text-blue-600"
                  title="Previous"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-white rounded-lg transition-all duration-200"
                >
                  Today
                </button>

                <button
                  onClick={() => navigate('next')}
                  className="p-2 rounded-lg hover:bg-white transition-all duration-200 text-gray-700 hover:text-blue-600"
                  title="Next"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Compact Stats Bar */}
          <div className="grid grid-cols-5 gap-3">
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
              <span className="text-xs font-medium text-gray-600">Shifts</span>
              <span className="text-lg font-bold text-gray-900">{stats.totalShifts}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <span className="text-xs font-medium text-blue-700">Assigned</span>
              <span className="text-lg font-bold text-blue-900">{stats.totalAssignments}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <span className="text-xs font-medium text-purple-700">Required</span>
              <span className="text-lg font-bold text-purple-900">{stats.totalRequired}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
              <span className="text-xs font-medium text-red-700">Gaps</span>
              <span className="text-lg font-bold text-red-900">{stats.unassignedCount}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
              <span className="text-xs font-medium text-amber-700">Overtime</span>
              <span className="text-lg font-bold text-amber-900">{stats.overtimeCount}</span>
            </div>
          </div>
        </div>

        {/* Error/Success Banner */}
        {error && (
          <div className={`mx-6 mb-4 px-4 py-3 rounded-xl border ${
            error.startsWith('✅')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {isLoading && scheduleData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-600 font-medium">Loading schedule...</p>
            </div>
          </div>
        ) : (
          <div className={zoomStyles.spacing}>
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayData = scheduleData.find(d => d.date === dateStr)
              const dayShifts = dayData?.shifts || []
              const isCurrentDay = isToday(day)
              const isPastDay = isPast(day) && !isCurrentDay
              const isFutureDay = isFuture(day)

              return (
                <div
                  key={dateStr}
                  className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border ${
                    isCurrentDay
                      ? 'border-blue-300 ring-2 ring-blue-200 ring-offset-2'
                      : 'border-gray-200'
                  } ${isPastDay ? 'opacity-60' : ''}`}
                >
                  {/* Day Header */}
                  <div className={`${zoomStyles.cardPadding} border-b border-gray-100 ${
                    isCurrentDay ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`${
                          isCurrentDay
                            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white'
                            : 'bg-white text-gray-900'
                        } w-14 h-14 rounded-xl flex flex-col items-center justify-center shadow-sm`}>
                          <span className="text-xs font-medium opacity-80">{format(day, 'EEE')}</span>
                          <span className="text-xl font-bold">{format(day, 'd')}</span>
                        </div>
                        <div>
                          <h3 className={`${zoomStyles.titleSize} font-bold text-gray-900`}>
                            {format(day, 'EEEE, MMMM d, yyyy')}
                          </h3>
                          <p className={`${zoomStyles.textSize} text-gray-600`}>
                            {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''} scheduled
                          </p>
                        </div>
                        {isCurrentDay && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                            TODAY
                          </span>
                        )}
                        {isPastDay && (
                          <span className="px-3 py-1 bg-gray-400 text-white text-xs font-medium rounded-full">
                            PAST
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Shifts Grid */}
                  <div className={`${zoomStyles.cardPadding}`}>
                    {dayShifts.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className={`${zoomStyles.textSize} font-medium`}>No shifts scheduled</p>
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 ${viewMode === 'day' ? 'lg:grid-cols-1' : 'lg:grid-cols-2 xl:grid-cols-3'} ${zoomStyles.gap}`}>
                        {dayShifts.map(shift => {
                          const gap = shift.requiredCount - shift.assignments.length
                          const coverageRate = shift.requiredCount > 0
                            ? Math.round((shift.assignments.length / shift.requiredCount) * 100)
                            : 0

                          return (
                            <div
                              key={shift.id}
                              className={`${zoomStyles.cardPadding} rounded-xl bg-gradient-to-br from-white to-gray-50 border hover:shadow-lg transition-all duration-200 ${getShiftStatusBorder(shift)}`}
                              title={`${shift.role} at ${shift.location || 'Unknown location'}\nTime: ${shift.startTime} - ${shift.endTime}\nSkills needed: ${shift.role}\nStaff required: ${shift.requiredCount}\nAssigned: ${shift.assignments.length}`}
                            >
                              {/* Shift Header */}
                              <div className="flex items-start justify-between mb-3 cursor-help">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`${zoomStyles.titleSize} font-bold text-gray-900`}>
                                      {shift.role}
                                    </span>
                                    {shift.location && (
                                      <span className={`${zoomStyles.badgeSize} px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium`}>
                                        📍 {shift.location}
                                      </span>
                                    )}
                                  </div>
                                  <div className={`flex items-center gap-2 ${zoomStyles.textSize} text-gray-600`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">{shift.startTime} - {shift.endTime}</span>
                                  </div>
                                </div>

                                {/* Coverage Badge */}
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                                  coverageRate === 100
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : coverageRate >= 50
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  <span className={`${zoomStyles.textSize} font-bold`}>
                                    {shift.assignments.length} / {shift.requiredCount}
                                  </span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mb-3">
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${
                                      coverageRate === 100
                                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                        : coverageRate >= 50
                                        ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                                        : 'bg-gradient-to-r from-red-500 to-red-600'
                                    }`}
                                    style={{ width: `${coverageRate}%` }}
                                  />
                                </div>
                              </div>

                              {/* Assignments */}
                              {shift.assignments.length > 0 ? (
                                <div className={`flex flex-wrap ${zoomStyles.gap}`}>
                                  {shift.assignments.map(assignment => {
                                    const tooltipText = [
                                      `${assignment.employeeName} (${assignment.employeeCode})`,
                                      `Weekly hours: ${assignment.weeklyHours}h`,
                                      ...(assignment.warnings || [])
                                    ].join('\\n')

                                    return (
                                      <div
                                        key={assignment.id}
                                        className={`${zoomStyles.badgeSize} ${zoomStyles.cardPadding} rounded-lg ${getStatusColor(assignment.status)} cursor-help transform hover:scale-105 transition-transform duration-200`}
                                        title={tooltipText}
                                      >
                                        <div className="font-semibold">{assignment.employeeName}</div>
                                        <div className="text-[10px] opacity-75 font-medium">{assignment.employeeCode}</div>
                                        {assignment.warnings && assignment.warnings.length > 0 && (
                                          <div className="text-[10px] mt-1 font-medium">
                                            ⚠️ {assignment.warnings[0]}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}

                                  {/* Empty Slots */}
                                  {gap > 0 && Array.from({ length: Math.min(gap, 3) }).map((_, i) => (
                                    <div
                                      key={`empty-${i}`}
                                      className={`${zoomStyles.badgeSize} ${zoomStyles.cardPadding} rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-400 flex items-center justify-center cursor-help hover:border-blue-400 hover:bg-blue-50 transition-all duration-200`}
                                      title={`⚠️ ${gap} position${gap !== 1 ? 's' : ''} need to be filled`}
                                    >
                                      <span className="font-medium">Unassigned</span>
                                    </div>
                                  ))}
                                  {gap > 3 && (
                                    <div className={`${zoomStyles.badgeSize} ${zoomStyles.cardPadding} rounded-lg bg-red-100 text-red-700 font-bold`}>
                                      +{gap - 3} more gaps
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                                  <p className={`${zoomStyles.textSize} text-gray-500 font-medium`}>
                                    No assignments - {shift.requiredCount} needed
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Optimizer Time Window Modal */}
      {showOptimizerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Configure Optimization</h2>
                <button
                  onClick={() => setShowOptimizerModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mt-2">Select the time window for roster optimization</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Quick Presets</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'day', label: 'Today Only', icon: '📅', desc: '1 day' },
                    { value: 'week', label: 'This Week', icon: '📆', desc: '7 days' },
                    { value: 'month', label: 'This Month', icon: '🗓️', desc: '~30 days' },
                    { value: '3months', label: '3 Months', icon: '📊', desc: '~90 days' },
                    { value: '6months', label: '6 Months', icon: '📈', desc: '~180 days' },
                    { value: 'custom', label: 'Custom Range', icon: '⚙️', desc: 'Pick dates' }
                  ].map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setOptimizeWindow(preset.value as any)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        optimizeWindow === preset.value
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{preset.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{preset.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{preset.desc}</div>
                        </div>
                        {optimizeWindow === preset.value && (
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              {optimizeWindow === 'custom' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Custom Date Range</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customOptimizeStart}
                        onChange={(e) => setCustomOptimizeStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={customOptimizeEnd}
                        onChange={(e) => setCustomOptimizeEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Date Range Preview */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-gray-900">Optimization will run for:</span>
                </div>
                <div className="mt-2 text-lg font-semibold text-blue-600">
                  {(() => {
                    const { start, end } = getOptimizationDateRange()
                    if (!start || !end) return 'Select dates above'
                    return `${start} to ${end}`
                  })()}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="font-semibold text-amber-900 text-sm">Important Notes</div>
                    <ul className="text-xs text-amber-800 mt-1 space-y-1">
                      <li>• Larger time windows take longer to optimize</li>
                      <li>• Existing assignments in this range will be replaced</li>
                      <li>• Optimization considers employee availability & qualifications</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowOptimizerModal(false)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={runOptimization}
                disabled={optimizeWindow === 'custom' && (!customOptimizeStart || !customOptimizeEnd)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Optimization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
