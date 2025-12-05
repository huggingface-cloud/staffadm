import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shiftId = searchParams.get('shift_id')
    const employeeId = searchParams.get('employee_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('rosters')
      .select(`
        *,
        shifts(
          shift_date,
          start_time,
          end_time,
          location,
          departments(name, code)
        ),
        employees(employee_code, first_name, last_name)
      `)
      .order('assigned_at', { ascending: false })

    if (shiftId) {
      query = query.eq('shift_id', shiftId)
    }

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    if (status) {
      query = query.eq('status', status)
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
