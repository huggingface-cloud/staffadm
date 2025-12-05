import { supabase } from './supabase'

export interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  is_active: boolean
  dept_id: string
  contracts: Array<{
    weekly_hours: number
    max_consecutive_days: number | null
    min_rest_hours: number | null
    is_active: boolean
  }>
  employee_qualifications: Array<{
    qualification_type_id: string
    is_valid: boolean
    expiry_date: string | null
  }>
  employee_role_assignments: Array<{
    role_id: string
  }>
  employee_anomalies: Array<{
    anomaly_type: string
    start_date: string
    end_date: string | null
    restrictions: string | null
    is_active: boolean
  }>
}

export interface Shift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  dept_id: string
  location: string | null
  required_headcount: number
  shift_requirements: Array<{
    role_id: string
    required_count: number
    skill_level: string
  }>
}

export interface Absence {
  employee_id: string
  start_date: string
  end_date: string
  status: string
}

export interface RosterAssignment {
  shift_id: string
  employee_id: string
  employee: Employee
  confidence: 'perfect' | 'good' | 'suboptimal'
  warnings: string[]
}

export interface UnassignableReason {
  shift_id: string
  shift: Shift
  required_count: number
  assigned_count: number
  gap: number
  reasons: {
    type: 'no_qualified_staff' | 'insufficient_staff' | 'all_on_absence' | 'contract_limits' | 'anomalies' | 'rest_period_violation'
    count: number
    details: string
    affected_employees?: string[]
  }[]
}

export interface RosteringResult {
  assignments: RosterAssignment[]
  unassignable: UnassignableReason[]
  summary: {
    total_shifts: number
    fully_assigned: number
    partially_assigned: number
    unassigned: number
    total_required: number
    total_assigned: number
    coverage_percentage: number
  }
}

export class RosteringEngine {
  private employees: Employee[] = []
  private shifts: Shift[] = []
  private absences: Absence[] = []
  private roleQualificationMap: Map<string, string[]> = new Map()
  private existingRosters: Map<string, string[]> = new Map() // employee_id -> shift_ids

  async initialize(startDate: string, endDate: string, deptId?: string) {
    // Fetch employees with all related data
    let employeeQuery = supabase
      .from('employees')
      .select(`
        *,
        contracts(weekly_hours, max_consecutive_days, min_rest_hours, is_active),
        employee_qualifications(qualification_type_id, is_valid, expiry_date),
        employee_role_assignments(role_id),
        employee_anomalies(anomaly_type, start_date, end_date, restrictions, is_active)
      `)
      .eq('is_active', true)

    if (deptId) {
      employeeQuery = employeeQuery.eq('dept_id', deptId)
    }

    const { data: employees } = await employeeQuery
    this.employees = employees || []

    // Fetch shifts with requirements
    let shiftQuery = supabase
      .from('shifts')
      .select(`
        *,
        shift_requirements(role_id, required_count, skill_level)
      `)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .neq('status', 'cancelled')

    if (deptId) {
      shiftQuery = shiftQuery.eq('dept_id', deptId)
    }

    const { data: shifts } = await shiftQuery
    this.shifts = shifts || []

    // Fetch absences
    const { data: absences } = await supabase
      .from('absences')
      .select('employee_id, start_date, end_date, status')
      .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
      .in('status', ['approved', 'pending'])

    this.absences = absences || []

    // Fetch role qualifications mapping
    const { data: roleQuals } = await supabase
      .from('role_qualifications')
      .select('role_id, qualification_type_id, skill_level')

    roleQuals?.forEach((rq) => {
      if (!this.roleQualificationMap.has(rq.role_id)) {
        this.roleQualificationMap.set(rq.role_id, [])
      }
      this.roleQualificationMap.get(rq.role_id)!.push(rq.qualification_type_id)
    })

    // Fetch existing roster assignments
    const { data: existingRosters } = await supabase
      .from('rosters')
      .select('employee_id, shift_id')
      .in('shift_id', this.shifts.map(s => s.id))

    existingRosters?.forEach((roster) => {
      if (!this.existingRosters.has(roster.employee_id)) {
        this.existingRosters.set(roster.employee_id, [])
      }
      this.existingRosters.get(roster.employee_id)!.push(roster.shift_id)
    })
  }

  async assignShifts(): Promise<RosteringResult> {
    const assignments: RosterAssignment[] = []
    const unassignable: UnassignableReason[] = []

    for (const shift of this.shifts) {
      const shiftAssignments = await this.assignShift(shift)

      const totalRequired = shift.shift_requirements.reduce(
        (sum, req) => sum + req.required_count,
        0
      )

      if (shiftAssignments.length < totalRequired) {
        const reasons = this.analyzeShortage(shift, shiftAssignments)
        unassignable.push({
          shift_id: shift.id,
          shift,
          required_count: totalRequired,
          assigned_count: shiftAssignments.length,
          gap: totalRequired - shiftAssignments.length,
          reasons,
        })
      }

      assignments.push(...shiftAssignments)
    }

    const summary = this.calculateSummary(assignments, unassignable)

    return { assignments, unassignable, summary }
  }

  private async assignShift(shift: Shift): Promise<RosterAssignment[]> {
    const assignments: RosterAssignment[] = []
    const alreadyAssigned = new Set<string>()

    for (const requirement of shift.shift_requirements) {
      const eligibleEmployees = this.findEligibleEmployees(
        shift,
        requirement.role_id,
        requirement.skill_level
      )

      // Sort by suitability
      const rankedEmployees = eligibleEmployees.map((emp) => ({
        employee: emp,
        score: this.calculateSuitabilityScore(emp, shift, requirement),
      }))
      rankedEmployees.sort((a, b) => b.score.total - a.score.total)

      let assigned = 0
      for (const { employee, score } of rankedEmployees) {
        if (assigned >= requirement.required_count) break
        if (alreadyAssigned.has(employee.id)) continue

        const warnings = this.getAssignmentWarnings(employee, shift)

        let confidence: 'perfect' | 'good' | 'suboptimal' = 'perfect'
        if (warnings.length > 0) {
          confidence = warnings.some(w => w.includes('CRITICAL')) ? 'suboptimal' : 'good'
        }

        assignments.push({
          shift_id: shift.id,
          employee_id: employee.id,
          employee,
          confidence,
          warnings,
        })

        alreadyAssigned.add(employee.id)
        assigned++
      }
    }

    return assignments
  }

  private findEligibleEmployees(
    shift: Shift,
    roleId: string,
    skillLevel: string
  ): Employee[] {
    return this.employees.filter((emp) => {
      // Check department
      if (emp.dept_id !== shift.dept_id) return false

      // Check if employee has this role
      const hasRole = emp.employee_role_assignments.some(
        (ra) => ra.role_id === roleId
      )
      if (!hasRole) return false

      // Check if on absence
      if (this.isOnAbsence(emp.id, shift.shift_date)) return false

      // Check active contract
      const activeContract = emp.contracts.find((c) => c.is_active)
      if (!activeContract) return false

      // Check qualifications based on skill level
      const requiredQuals = this.roleQualificationMap.get(roleId) || []
      if (skillLevel === 'Minimum') {
        // For minimum, just need the role assignment (checked above)
        return true
      } else {
        // For recommended, need all qualifications
        const hasAllQuals = requiredQuals.every((qualId) =>
          emp.employee_qualifications.some(
            (eq) => eq.qualification_type_id === qualId && eq.is_valid
          )
        )
        return hasAllQuals
      }
    })
  }

  private calculateSuitabilityScore(
    employee: Employee,
    shift: Shift,
    requirement: any
  ) {
    let total = 0
    const details: any = {}

    // Has all recommended qualifications
    const requiredQuals = this.roleQualificationMap.get(requirement.role_id) || []
    const hasAllQuals = requiredQuals.every((qualId) =>
      employee.employee_qualifications.some(
        (eq) => eq.qualification_type_id === qualId && eq.is_valid
      )
    )
    if (hasAllQuals) {
      total += 50
      details.qualifications = 50
    } else if (requirement.skill_level === 'Minimum') {
      total += 25
      details.qualifications = 25
    }

    // No active anomalies
    const activeAnomalies = employee.employee_anomalies.filter((a) => a.is_active)
    if (activeAnomalies.length === 0) {
      total += 20
      details.no_anomalies = 20
    } else {
      details.has_anomalies = -10
      total -= 10
    }

    // Not overworked (check existing roster assignments)
    const employeeShifts = this.existingRosters.get(employee.id) || []
    if (employeeShifts.length < 5) {
      total += 15
      details.workload = 15
    } else if (employeeShifts.length > 10) {
      total -= 10
      details.overworked = -10
    }

    // Rest period compliance
    const hasRestPeriodIssue = this.checkRestPeriodViolation(employee, shift)
    if (!hasRestPeriodIssue) {
      total += 15
      details.rest_period = 15
    }

    return { total, details }
  }

  private getAssignmentWarnings(employee: Employee, shift: Shift): string[] {
    const warnings: string[] = []

    // Check anomalies
    const activeAnomalies = employee.employee_anomalies.filter((a) => {
      if (!a.is_active) return false
      const shiftDate = new Date(shift.shift_date)
      const startDate = new Date(a.start_date)
      const endDate = a.end_date ? new Date(a.end_date) : null
      return shiftDate >= startDate && (!endDate || shiftDate <= endDate)
    })

    activeAnomalies.forEach((anomaly) => {
      warnings.push(
        `${anomaly.anomaly_type}${anomaly.restrictions ? ': ' + anomaly.restrictions : ''}`
      )
    })

    // Check expiring qualifications
    employee.employee_qualifications.forEach((qual) => {
      if (qual.expiry_date) {
        const daysUntilExpiry = Math.floor(
          (new Date(qual.expiry_date).getTime() - new Date(shift.shift_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
        if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
          warnings.push(`Qualification expires in ${daysUntilExpiry} days`)
        } else if (daysUntilExpiry <= 0) {
          warnings.push(`CRITICAL: Qualification expired`)
        }
      }
    })

    // Check rest period
    if (this.checkRestPeriodViolation(employee, shift)) {
      warnings.push('CRITICAL: Rest period violation')
    }

    // Check weekly hours
    const employeeShifts = this.existingRosters.get(employee.id) || []
    const activeContract = employee.contracts.find((c) => c.is_active)
    if (activeContract && employeeShifts.length > 0) {
      const weeklyHours = this.calculateWeeklyHours(employee.id, shift.shift_date)
      if (weeklyHours > activeContract.weekly_hours) {
        warnings.push(`Exceeds weekly hours limit (${weeklyHours}/${activeContract.weekly_hours}h)`)
      }
    }

    return warnings
  }

  private isOnAbsence(employeeId: string, shiftDate: string): boolean {
    return this.absences.some((absence) => {
      if (absence.employee_id !== employeeId) return false
      const shift = new Date(shiftDate)
      const start = new Date(absence.start_date)
      const end = new Date(absence.end_date)
      return shift >= start && shift <= end
    })
  }

  private checkRestPeriodViolation(employee: Employee, shift: Shift): boolean {
    const activeContract = employee.contracts.find((c) => c.is_active)
    if (!activeContract?.min_rest_hours) return false

    const employeeShifts = this.existingRosters.get(employee.id) || []
    const assignedShifts = this.shifts.filter((s) => employeeShifts.includes(s.id))

    for (const prevShift of assignedShifts) {
      const prevEnd = new Date(`${prevShift.shift_date}T${prevShift.end_time}`)
      const currentStart = new Date(`${shift.shift_date}T${shift.start_time}`)
      const hoursBetween = (currentStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60)

      if (hoursBetween < activeContract.min_rest_hours && hoursBetween > 0) {
        return true
      }
    }

    return false
  }

  private calculateWeeklyHours(employeeId: string, shiftDate: string): number {
    // Calculate hours for the week containing shiftDate
    const date = new Date(shiftDate)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const employeeShifts = this.existingRosters.get(employeeId) || []
    const weekShifts = this.shifts.filter((s) => {
      if (!employeeShifts.includes(s.id)) return false
      const shiftDate = new Date(s.shift_date)
      return shiftDate >= weekStart && shiftDate <= weekEnd
    })

    return weekShifts.reduce((total, shift) => {
      const start = new Date(`${shift.shift_date}T${shift.start_time}`)
      const end = new Date(`${shift.shift_date}T${shift.end_time}`)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      return total + hours
    }, 0)
  }

  private analyzeShortage(shift: Shift, assignments: RosterAssignment[]) {
    const reasons: UnassignableReason['reasons'] = []

    const totalRequired = shift.shift_requirements.reduce(
      (sum, req) => sum + req.required_count,
      0
    )

    // Check each requirement
    for (const req of shift.shift_requirements) {
      const requiredQuals = this.roleQualificationMap.get(req.role_id) || []

      // Find employees with the role
      const employeesWithRole = this.employees.filter((emp) =>
        emp.employee_role_assignments.some((ra) => ra.role_id === req.role_id)
      )

      if (employeesWithRole.length === 0) {
        reasons.push({
          type: 'no_qualified_staff',
          count: req.required_count,
          details: `No employees have the required role`,
        })
        continue
      }

      // Check qualifications
      const employeesWithQuals = employeesWithRole.filter((emp) =>
        requiredQuals.every((qualId) =>
          emp.employee_qualifications.some(
            (eq) => eq.qualification_type_id === qualId && eq.is_valid
          )
        )
      )

      if (employeesWithQuals.length < req.required_count) {
        reasons.push({
          type: 'no_qualified_staff',
          count: req.required_count - employeesWithQuals.length,
          details: `Only ${employeesWithQuals.length}/${req.required_count} employees have required qualifications`,
        })
      }

      // Check absences
      const onAbsence = employeesWithQuals.filter((emp) =>
        this.isOnAbsence(emp.id, shift.shift_date)
      )

      if (onAbsence.length > 0) {
        reasons.push({
          type: 'all_on_absence',
          count: onAbsence.length,
          details: `${onAbsence.length} qualified employee(s) on absence`,
          affected_employees: onAbsence.map((e) => `${e.first_name} ${e.last_name}`),
        })
      }

      // Check contract limits
      const contractIssues = employeesWithQuals.filter((emp) => {
        const activeContract = emp.contracts.find((c) => c.is_active)
        if (!activeContract) return true
        const weeklyHours = this.calculateWeeklyHours(emp.id, shift.shift_date)
        return weeklyHours >= activeContract.weekly_hours
      })

      if (contractIssues.length > 0) {
        reasons.push({
          type: 'contract_limits',
          count: contractIssues.length,
          details: `${contractIssues.length} employee(s) at weekly hour limit`,
          affected_employees: contractIssues.map((e) => `${e.first_name} ${e.last_name}`),
        })
      }

      // Check anomalies
      const withAnomalies = employeesWithQuals.filter((emp) =>
        emp.employee_anomalies.some((a) => a.is_active)
      )

      if (withAnomalies.length > 0) {
        reasons.push({
          type: 'anomalies',
          count: withAnomalies.length,
          details: `${withAnomalies.length} employee(s) have active restrictions`,
          affected_employees: withAnomalies.map((e) => `${e.first_name} ${e.last_name}`),
        })
      }
    }

    // General shortage
    if (reasons.length === 0 && assignments.length < totalRequired) {
      reasons.push({
        type: 'insufficient_staff',
        count: totalRequired - assignments.length,
        details: `Need ${totalRequired - assignments.length} more employee(s)`,
      })
    }

    return reasons
  }

  private calculateSummary(
    assignments: RosterAssignment[],
    unassignable: UnassignableReason[]
  ) {
    const totalShifts = this.shifts.length
    const fullyAssigned = this.shifts.filter((shift) => {
      const required = shift.shift_requirements.reduce(
        (sum, req) => sum + req.required_count,
        0
      )
      const assigned = assignments.filter((a) => a.shift_id === shift.id).length
      return assigned >= required
    }).length

    const partiallyAssigned = unassignable.filter((u) => u.assigned_count > 0).length
    const unassigned = unassignable.filter((u) => u.assigned_count === 0).length

    const totalRequired = this.shifts.reduce(
      (sum, shift) =>
        sum +
        shift.shift_requirements.reduce((s, req) => s + req.required_count, 0),
      0
    )
    const totalAssigned = assignments.length
    const coveragePercentage = totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 0

    return {
      total_shifts: totalShifts,
      fully_assigned: fullyAssigned,
      partially_assigned: partiallyAssigned,
      unassigned,
      total_required: totalRequired,
      total_assigned: totalAssigned,
      coverage_percentage: Math.round(coveragePercentage * 100) / 100,
    }
  }
}
