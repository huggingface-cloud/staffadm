'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { api } from '@/lib/api'

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string | null
  joining_date: string
  is_active: boolean
  operating_company: { name: string; code: string } | null
  department: { name: string; code: string } | null
  roles: Array<{ role_name: string }>
  active_qualifications: Array<{
    qualification_types: {
      name: string
      validity_period_months: number | null
    }
    acquired_date: string
    expiry_date: string | null
    is_valid: boolean
  }>
  active_anomalies: Array<{
    anomaly_type: string
    restrictions: string | null
    start_date: string
    end_date: string | null
  }>
  active_contract: {
    contract_type: string
    weekly_hours: number
    is_active: boolean
  } | null
  total_qualifications: number
  has_anomalies: boolean
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const data = await api.employees.getAll({ is_active: true })
      setEmployees(data)
      setError(null)
    } catch (err) {
      setError('Failed to connect to API. Make sure the backend is running on http://localhost:8001')
      console.error('Error fetching employees:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error: {error}</p>
        <p className="text-red-600 text-sm mt-2">
          Make sure your FastAPI backend is running: <code className="bg-red-100 px-2 py-1 rounded">cd api && python main.py</code>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-600 mt-1">
            Connected to FastAPI backend • {employees.length} active employees
          </p>
        </div>
        <button
          onClick={fetchEmployees}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qualifications
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anomalies
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.employee_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{employee.full_name}</div>
                    <div className="text-sm text-gray-500">{employee.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.department?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.roles?.[0]?.role_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {employee.total_qualifications} active
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.has_anomalies ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {employee.active_anomalies.length} restriction(s)
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedEmployee(employee)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedEmployee.full_name}</h3>
                  <p className="text-gray-600">{selectedEmployee.employee_code}</p>
                </div>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <p className="font-medium">{selectedEmployee.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Department:</span>
                      <p className="font-medium">{selectedEmployee.department?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Joining Date:</span>
                      <p className="font-medium">{format(new Date(selectedEmployee.joining_date), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                </div>

                {/* Active Contract */}
                {selectedEmployee.active_contract && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Active Contract</h4>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <p><span className="text-gray-600">Type:</span> <span className="font-medium">{selectedEmployee.active_contract.contract_type}</span></p>
                      <p><span className="text-gray-600">Weekly Hours:</span> <span className="font-medium">{selectedEmployee.active_contract.weekly_hours}h</span></p>
                    </div>
                  </div>
                )}

                {/* Active Qualifications */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Active Qualifications ({selectedEmployee.total_qualifications})
                  </h4>
                  {selectedEmployee.active_qualifications.length > 0 ? (
                    <div className="space-y-2">
                      {selectedEmployee.active_qualifications.map((qual, idx) => (
                        <div key={idx} className="bg-blue-50 rounded p-3 text-sm">
                          <p className="font-medium">{qual.qualification_types.name}</p>
                          <p className="text-gray-600 text-xs mt-1">
                            Acquired: {format(new Date(qual.acquired_date), 'MMM dd, yyyy')}
                            {qual.expiry_date && ` • Expires: ${format(new Date(qual.expiry_date), 'MMM dd, yyyy')}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No active qualifications</p>
                  )}
                </div>

                {/* Active Anomalies */}
                {selectedEmployee.has_anomalies && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Active Restrictions ({selectedEmployee.active_anomalies.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEmployee.active_anomalies.map((anomaly, idx) => (
                        <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                          <p className="font-medium text-yellow-800">{anomaly.anomaly_type}</p>
                          {anomaly.restrictions && (
                            <p className="text-yellow-700 text-xs mt-1">{anomaly.restrictions}</p>
                          )}
                          <p className="text-gray-600 text-xs mt-1">
                            From: {format(new Date(anomaly.start_date), 'MMM dd, yyyy')}
                            {anomaly.end_date && ` • Until: ${format(new Date(anomaly.end_date), 'MMM dd, yyyy')}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
