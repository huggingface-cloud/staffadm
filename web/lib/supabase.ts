import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      operating_companies: {
        Row: {
          id: string
          name: string
          code: string
          created_at: string
        }
      }
      departments: {
        Row: {
          id: string
          opco_id: string
          parent_dept_id: string | null
          name: string
          code: string
          created_at: string
        }
      }
      employees: {
        Row: {
          id: string
          opco_id: string
          dept_id: string
          employee_code: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          joining_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      contracts: {
        Row: {
          id: string
          employee_id: string
          contract_type: string
          start_date: string
          end_date: string | null
          weekly_hours: number
          max_consecutive_days: number | null
          min_rest_hours: number | null
          is_active: boolean
          created_at: string
        }
      }
      qualification_types: {
        Row: {
          id: string
          opco_id: string
          name: string
          details: string | null
          validity_period_months: number | null
          is_mandatory: boolean
        }
      }
      employee_qualifications: {
        Row: {
          id: string
          employee_id: string
          qualification_type_id: string
          acquired_date: string
          expiry_date: string | null
          is_valid: boolean
          created_at: string
        }
      }
      employee_roles: {
        Row: {
          id: string
          dept_id: string
          role_name: string
          description: string | null
          created_at: string
        }
      }
      employee_role_assignments: {
        Row: {
          id: string
          employee_id: string
          role_id: string
          assigned_at: string
        }
      }
      employee_anomalies: {
        Row: {
          id: string
          employee_id: string
          anomaly_type: string
          start_date: string
          end_date: string | null
          restrictions: string | null
          comments: string | null
          is_active: boolean
          created_at: string
        }
      }
      shifts: {
        Row: {
          id: string
          opco_id: string
          dept_id: string
          shift_date: string
          start_time: string
          end_time: string
          location: string | null
          required_headcount: number
          status: string
          created_at: string
          updated_at: string
        }
      }
      shift_requirements: {
        Row: {
          id: string
          shift_id: string
          role_id: string
          required_count: number
          skill_level: string
        }
      }
      rosters: {
        Row: {
          id: string
          shift_id: string
          employee_id: string
          assigned_by: string
          assigned_at: string
          status: string
          notes: string | null
          updated_at: string
        }
      }
      absences: {
        Row: {
          id: string
          employee_id: string
          absence_type: string
          start_date: string
          end_date: string
          reason: string | null
          status: string
          requested_at: string
          approved_by: string | null
          approved_at: string | null
        }
      }
    }
  }
}
