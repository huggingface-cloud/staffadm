/**
 * Next.js API Route for Roster Optimization
 * File: app/api/roster/optimize/route.ts
 *
 * This handles the integration between Next.js frontend and Python optimizer
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Python optimizer API endpoint (can be a separate microservice or lambda)
const OPTIMIZER_API_URL = process.env.OPTIMIZER_API_URL || 'http://localhost:8000';

interface OptimizationRequest {
  startDate: string;
  endDate: string;
  departmentFilter?: string;
  userId?: string;
  description?: string;
}

/**
 * POST /api/roster/optimize
 * Triggers roster optimization for a date range
 */
export async function POST(request: NextRequest) {
  try {
    const body: OptimizationRequest = await request.json();

    // Validate input
    if (!body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Create optimization job record
    const { data: job, error: jobError } = await supabase
      .from('optimization_jobs')
      .insert({
        user_id: body.userId,
        start_date: body.startDate,
        end_date: body.endDate,
        status: 'queued',
        description: body.description,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create optimization job' },
        { status: 500 }
      );
    }

    // For small datasets: run immediately
    // For large datasets: queue the job
    const shouldRunImmediately = await checkDatasetSize(body.startDate, body.endDate);

    if (shouldRunImmediately) {
      // Run optimization immediately (blocking)
      const result = await runOptimization(job.id, body);

      return NextResponse.json({
        jobId: job.id,
        status: 'completed',
        result,
      });
    } else {
      // Queue for background processing
      await queueOptimizationJob(job.id, body);

      return NextResponse.json({
        jobId: job.id,
        status: 'queued',
        message: 'Optimization queued. Check status using GET /api/roster/optimize/:jobId',
      });
    }
  } catch (error) {
    console.error('Optimization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/roster/optimize/:jobId
 * Check optimization job status and retrieve results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;

    // Fetch job status
    const { data: job, error } = await supabase
      .from('optimization_runs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Fetch roster assignments if completed
    let roster = null;
    if (job.status === 'Optimal') {
      const { data: assignments } = await supabase
        .from('roster_assignments')
        .select('*')
        .eq('optimization_run_id', jobId);

      roster = assignments;
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      objectiveValue: job.objective_value,
      statistics: job.statistics,
      uncoveredShiftsCount: job.uncovered_shifts_count,
      roster,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================================================================
// HELPER FUNCTIONS
// ======================================================================

async function checkDatasetSize(startDate: string, endDate: string): Promise<boolean> {
  /**
   * Determine if we should run optimization immediately or queue it.
   * Threshold: <500 employees and <2000 shifts = immediate
   */

  const { count: employeeCount } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true });

  const { count: shiftCount } = await supabase
    .from('shift_requirements')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', startDate)
    .lte('start_time', endDate);

  return (employeeCount || 0) < 500 && (shiftCount || 0) < 2000;
}

async function runOptimization(
  jobId: string,
  request: OptimizationRequest
): Promise<any> {
  /**
   * Call Python optimizer API to run optimization
   */

  try {
    // Update job status
    await supabase
      .from('optimization_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // Call Python optimizer
    const response = await fetch(`${OPTIMIZER_API_URL}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: request.startDate,
        end_date: request.endDate,
        department_filter: request.departmentFilter,
      }),
    });

    if (!response.ok) {
      throw new Error(`Optimizer API error: ${response.statusText}`);
    }

    const result = await response.json();

    // Save results to database
    await supabase
      .from('optimization_runs')
      .update({
        status: result.status,
        objective_value: result.objective_value,
        roster_data: result.roster,
        uncovered_shifts: result.uncovered_shifts,
        uncovered_shifts_count: result.uncovered_shifts.length,
        statistics: result.statistics,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Save individual assignments
    const assignments = [];
    for (const entry of result.roster) {
      for (const shift of entry.shifts_assigned) {
        assignments.push({
          optimization_run_id: jobId,
          employee_id: entry.employee_id,
          shift_id: shift.shift_id,
          start_time: shift.start_time,
          duration_hours: shift.duration_h,
          role: shift.role,
        });
      }
    }

    if (assignments.length > 0) {
      await supabase.from('roster_assignments').insert(assignments);
    }

    return result;
  } catch (error) {
    // Mark job as failed
    await supabase
      .from('optimization_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw error;
  }
}

async function queueOptimizationJob(
  jobId: string,
  request: OptimizationRequest
): Promise<void> {
  /**
   * Queue job for background processing
   * Options:
   * 1. Use Supabase pg_cron to poll for queued jobs
   * 2. Use external queue service (BullMQ, AWS SQS, etc.)
   * 3. Use Supabase Edge Functions with background invocation
   */

  // Example: Using Supabase queue table
  await supabase.from('optimization_queue').insert({
    job_id: jobId,
    payload: request,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // Alternative: Call background worker API
  // await fetch(`${OPTIMIZER_API_URL}/queue`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ jobId, ...request }),
  // });
}
