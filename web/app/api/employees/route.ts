import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const opcoId = searchParams.get('opco_id')
    const deptId = searchParams.get('dept_id')

    let query = supabase
      .from('employees')
      .select(`
        *,
        operating_companies(name, code),
        departments(name, code),
        contracts(contract_type, start_date, end_date, is_active),
        employee_role_assignments(
          employee_roles(role_name)
        )
      `)
      .order('created_at', { ascending: false })

    if (opcoId) {
      query = query.eq('opco_id', opcoId)
    }

    if (deptId) {
      query = query.eq('dept_id', deptId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
