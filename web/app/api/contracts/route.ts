import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const isActive = searchParams.get('is_active')

    let query = supabase
      .from('contracts')
      .select(`
        *,
        employees(
          employee_code,
          first_name,
          last_name,
          departments(name, code)
        )
      `)
      .order('start_date', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
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
