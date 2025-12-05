'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface RosterAssignment {
  shift_id: string
  employee_id: string
  employee: {
    employee_code: string
    first_name: string
    last_name: string
  }
  confidence: 'perfect' | 'good' | 'suboptimal'
  warnings: string[]
}

interface UnassignableReason {
  shift_id: string
  shift: {
    shift_date: string
    start_time: string
    end_time: string
    location: string | null
  }
  required_count: number
  assigned_count: number
  gap: number
  reasons: Array<{
    type: string
    count: number
    details: string
    affected_employees?: string[]
  }>
}

interface RosteringResult {
  assignments: RosterAssignment[]
  unassignable: UnassignableReason[]
  summary: {
    total_shifts: number
    fully_assigned: number
    partially_assigned: number
    unassigned: number
    total_required: number
    total_assigned: number
    coverage_percentage: number
  }
}

export default function RosterEngine() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RosteringResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'summary' | 'assignments' | 'gaps'>('summary')

  const handleGenerateRoster = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/roster/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setResult(data.data)
      }
    } catch (err) {
      setError('Failed to generate roster')
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      perfect: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      suboptimal: 'bg-yellow-100 text-yellow-800',
    }
    return colors[confidence as keyof typeof colors] || colors.good
  }

  const getReasonIcon = (type: string) => {
    const icons: Record<string, string> = {
      no_qualified_staff: '🎓',
      insufficient_staff: '👥',
      all_on_absence: '🏖️',
      contract_limits: '⏰',
      anomalies: '⚠️',
      rest_period_violation: '😴',
    }
    return icons[type] || '❓'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Intelligent Roster Assignment Engine
        </h2>
        <p className="text-gray-600 mb-6">
          Automatically assign employees to shifts based on qualifications, availability, and constraints
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerateRoster}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Roster'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Summary Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {result.summary.total_shifts}
                </div>
                <div className="text-sm text-gray-600">Total Shifts</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {result.summary.fully_assigned}
                </div>
                <div className="text-sm text-gray-600">Fully Assigned</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {result.summary.partially_assigned}
                </div>
                <div className="text-sm text-gray-600">Partially Assigned</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">
                  {result.summary.unassigned}
                </div>
                <div className="text-sm text-gray-600">Unassigned</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Coverage</span>
                <span className="text-sm font-bold text-gray-900">
                  {result.summary.coverage_percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    result.summary.coverage_percentage >= 90
                      ? 'bg-green-600'
                      : result.summary.coverage_percentage >= 70
                      ? 'bg-yellow-600'
                      : 'bg-red-600'
                  }`}
                  style={{ width: `${result.summary.coverage_percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{result.summary.total_assigned} assigned</span>
                <span>{result.summary.total_required} required</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 px-6">
                <button
                  onClick={() => setActiveView('summary')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeView === 'summary'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Assignments ({result.assignments.length})
                </button>
                <button
                  onClick={() => setActiveView('gaps')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeView === 'gaps'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Resource Gaps ({result.unassignable.length})
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeView === 'summary' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Employee
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Confidence
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Warnings
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.assignments.map((assignment, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {assignment.employee.first_name} {assignment.employee.last_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {assignment.employee.employee_code}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${getConfidenceBadge(
                                assignment.confidence
                              )}`}
                            >
                              {assignment.confidence}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {assignment.warnings.length > 0 ? (
                              <ul className="list-disc list-inside text-gray-600">
                                {assignment.warnings.map((warning, widx) => (
                                  <li key={widx} className="text-xs">
                                    {warning}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-gray-400">No issues</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeView === 'gaps' && (
                <div className="space-y-4">
                  {result.unassignable.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No resource gaps found! All shifts are fully assigned.
                    </div>
                  ) : (
                    result.unassignable.map((gap, idx) => (
                      <div
                        key={idx}
                        className="border border-red-200 bg-red-50 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              Shift on {format(new Date(gap.shift.shift_date), 'MMM dd, yyyy')}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {gap.shift.start_time} - {gap.shift.end_time}
                              {gap.shift.location && ` • ${gap.shift.location}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">
                              -{gap.gap}
                            </div>
                            <div className="text-xs text-gray-600">
                              {gap.assigned_count}/{gap.required_count} assigned
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700">Reasons:</h5>
                          {gap.reasons.map((reason, ridx) => (
                            <div
                              key={ridx}
                              className="bg-white rounded p-3 border border-red-100"
                            >
                              <div className="flex items-start space-x-2">
                                <span className="text-xl">{getReasonIcon(reason.type)}</span>
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {reason.details}
                                  </div>
                                  {reason.affected_employees && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      Affected: {reason.affected_employees.join(', ')}
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-red-600">
                                  {reason.count}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white text-gray-700 border border-gray-200">
                            💡 Suggestion: Review staff availability or hire temporary staff
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
