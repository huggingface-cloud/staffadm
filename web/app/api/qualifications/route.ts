import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const isValid = searchParams.get('is_valid')

    let query = supabase
      .from('employee_qualifications')
      .select(`
        *,
        employees(employee_code, first_name, last_name),
        qualification_types(name, details, validity_period_months)
      `)
      .order('acquired_date', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    if (isValid !== null) {
      query = query.eq('is_valid', isValid === 'true')
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
