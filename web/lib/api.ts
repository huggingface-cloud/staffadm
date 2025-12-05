// API configuration for FastAPI backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export const api = {
  employees: {
    getAll: (params?: { opco_id?: string; dept_id?: string; is_active?: boolean }) => {
      const searchParams = new URLSearchParams()
      if (params?.opco_id) searchParams.append('opco_id', params.opco_id)
      if (params?.dept_id) searchParams.append('dept_id', params.dept_id)
      if (params?.is_active !== undefined) searchParams.append('is_active', String(params.is_active))

      const url = `${API_BASE_URL}/api/employees${searchParams.toString() ? '?' + searchParams.toString() : ''}`
      return fetch(url).then(res => res.json())
    },

    getById: (id: string) => {
      return fetch(`${API_BASE_URL}/api/employees/${id}`).then(res => res.json())
    }
  },

  roster: {
    assign: (data: { start_date: string; end_date: string; dept_id?: string }) => {
      return fetch(`${API_BASE_URL}/api/roster/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json())
    }
  },

  shifts: {
    getAll: (params?: { start_date?: string; end_date?: string; dept_id?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.start_date) searchParams.append('start_date', params.start_date)
      if (params?.end_date) searchParams.append('end_date', params.end_date)
      if (params?.dept_id) searchParams.append('dept_id', params.dept_id)

      const url = `${API_BASE_URL}/api/shifts${searchParams.toString() ? '?' + searchParams.toString() : ''}`
      return fetch(url).then(res => res.json())
    }
  },

  absences: {
    getAll: (params?: { employee_id?: string; status?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.employee_id) searchParams.append('employee_id', params.employee_id)
      if (params?.status) searchParams.append('status', params.status)

      const url = `${API_BASE_URL}/api/absences${searchParams.toString() ? '?' + searchParams.toString() : ''}`
      return fetch(url).then(res => res.json())
    }
  },

  departments: {
    getAll: (opco_id?: string) => {
      const url = `${API_BASE_URL}/api/departments${opco_id ? '?opco_id=' + opco_id : ''}`
      return fetch(url).then(res => res.json())
    }
  },

  qualifications: {
    getAll: () => {
      return fetch(`${API_BASE_URL}/api/qualifications`).then(res => res.json())
    }
  }
}
