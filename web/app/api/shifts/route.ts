import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const opcoId = searchParams.get('opco_id')
    const deptId = searchParams.get('dept_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
      .from('shifts')
      .select(`
        *,
        operating_companies(name, code),
        departments(name, code),
        shift_requirements(
          required_count,
          skill_level,
          employee_roles(role_name)
        )
      `)
      .order('shift_date', { ascending: false })

    if (opcoId) {
      query = query.eq('opco_id', opcoId)
    }

    if (deptId) {
      query = query.eq('dept_id', deptId)
    }

    if (startDate) {
      query = query.gte('shift_date', startDate)
    }

    if (endDate) {
      query = query.lte('shift_date', endDate)
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
