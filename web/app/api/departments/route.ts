import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const opcoId = searchParams.get('opco_id')

    let query = supabase
      .from('departments')
      .select(`
        *,
        operating_companies(name, code),
        employee_roles(id, role_name, description)
      `)
      .order('name', { ascending: true })

    if (opcoId) {
      query = query.eq('opco_id', opcoId)
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
