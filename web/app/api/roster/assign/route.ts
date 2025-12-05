import { NextResponse } from 'next/server'
import { RosteringEngine } from '@/lib/rosteringEngine'

export async function POST(request: Request) {
  try {
    const { start_date, end_date, dept_id } = await request.json()

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    const engine = new RosteringEngine()
    await engine.initialize(start_date, end_date, dept_id)

    const result = await engine.assignShifts()

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Rostering error:', error)
    return NextResponse.json(
      { error: 'Failed to generate roster assignments' },
      { status: 500 }
    )
  }
}
