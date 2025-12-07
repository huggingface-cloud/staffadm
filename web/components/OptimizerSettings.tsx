'use client'

import { useState, useEffect } from 'react'

interface OptimizerConfig {
  id?: string
  name: string
  description: string
  is_active: boolean

  // Hard Constraints
  min_rest_hours: number
  max_shift_duration_hours: number
  max_consecutive_shifts: number
  max_work_days_per_week: number
  qual_expiry_threshold_days: number

  // Soft Penalties
  coverage_weight: number
  cross_dept_penalty: number
  fairness_penalty_per_hour: number
  overtime_penalty_per_hour: number

  // Targets
  target_hours_week: number

  // Solver Settings
  use_gurobi: boolean
  time_limit_sec: number
  mip_gap: number
}

const DEFAULT_CONFIG: OptimizerConfig = {
  name: '',
  description: '',
  is_active: false,
  min_rest_hours: 11,
  max_shift_duration_hours: 14,
  max_consecutive_shifts: 5,
  max_work_days_per_week: 6,
  qual_expiry_threshold_days: 90,
  coverage_weight: 1000,
  cross_dept_penalty: 100,
  fairness_penalty_per_hour: 10,
  overtime_penalty_per_hour: 50,
  target_hours_week: 35,
  use_gurobi: false,
  time_limit_sec: 120,
  mip_gap: 0.01
}

const PRESET_CONFIGS = {
  'Default Configuration': {
    ...DEFAULT_CONFIG,
    name: 'Default Configuration',
    description: 'Standard optimizer settings for balanced scheduling'
  },
  'Aggressive Coverage': {
    ...DEFAULT_CONFIG,
    name: 'Aggressive Coverage',
    description: 'Maximize shift coverage, allow more overtime',
    coverage_weight: 2000,
    fairness_penalty_per_hour: 5,
    overtime_penalty_per_hour: 25,
    time_limit_sec: 180
  },
  'Work-Life Balance': {
    ...DEFAULT_CONFIG,
    name: 'Work-Life Balance',
    description: 'Prioritize employee wellbeing with stricter limits',
    max_consecutive_shifts: 4,
    max_work_days_per_week: 5,
    coverage_weight: 800,
    fairness_penalty_per_hour: 20,
    overtime_penalty_per_hour: 100,
    target_hours_week: 32
  }
}

export default function OptimizerSettings() {
  const [configs, setConfigs] = useState<OptimizerConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [currentConfig, setCurrentConfig] = useState<OptimizerConfig>(DEFAULT_CONFIG)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'constraints' | 'penalties' | 'solver'>('constraints')

  // Mock data - replace with actual API call
  useEffect(() => {
    // Simulate loading configs
    const mockConfigs: OptimizerConfig[] = [
      { ...PRESET_CONFIGS['Default Configuration'], id: '1', is_active: true },
      { ...PRESET_CONFIGS['Aggressive Coverage'], id: '2', is_active: false },
      { ...PRESET_CONFIGS['Work-Life Balance'], id: '3', is_active: false }
    ]
    setConfigs(mockConfigs)
    setSelectedConfigId('1')
    setCurrentConfig(mockConfigs[0])
  }, [])

  const handleSelectConfig = (configId: string) => {
    const config = configs.find(c => c.id === configId)
    if (config) {
      setSelectedConfigId(configId)
      setCurrentConfig(config)
      setIsEditing(false)
    }
  }

  const handleLoadPreset = (presetName: keyof typeof PRESET_CONFIGS) => {
    setCurrentConfig({
      ...PRESET_CONFIGS[presetName],
      id: undefined,
      is_active: false
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (currentConfig.id) {
      // Update existing
      setConfigs(configs.map(c => c.id === currentConfig.id ? currentConfig : c))
    } else {
      // Create new
      const newConfig = { ...currentConfig, id: String(configs.length + 1) }
      setConfigs([...configs, newConfig])
      setSelectedConfigId(newConfig.id)
    }

    setIsSaving(false)
    setIsEditing(false)
    alert('Configuration saved successfully!')
  }

  const handleActivate = async () => {
    const updated = configs.map(c => ({
      ...c,
      is_active: c.id === selectedConfigId
    }))
    setConfigs(updated)
    setCurrentConfig({ ...currentConfig, is_active: true })
    alert('Configuration activated!')
  }

  const handleCreateNew = () => {
    setCurrentConfig({ ...DEFAULT_CONFIG, id: undefined })
    setIsEditing(true)
    setSelectedConfigId('')
  }

  const handleDelete = async () => {
    if (confirm(`Delete configuration "${currentConfig.name}"?`)) {
      setConfigs(configs.filter(c => c.id !== selectedConfigId))
      const remaining = configs.filter(c => c.id !== selectedConfigId)
      if (remaining.length > 0) {
        setSelectedConfigId(remaining[0].id!)
        setCurrentConfig(remaining[0])
      } else {
        handleCreateNew()
      }
    }
  }

  const SliderInput = ({ label, value, onChange, min, max, step = 1, unit = '', help }: {
    label: string
    value: number
    onChange: (val: number) => void
    min: number
    max: number
    step?: number
    unit?: string
    help?: string
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        disabled={!isEditing}
      />
      {help && <p className="text-xs text-gray-500">{help}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Optimizer Configuration</h2>
        <p className="text-sm text-gray-600">
          Manage and customize roster optimization settings. Adjust constraints, penalties, and solver parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Config Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Configurations</h3>
              <button
                onClick={handleCreateNew}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                title="Create new configuration"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Config List */}
            <div className="space-y-2 mb-4">
              {configs.map(config => (
                <button
                  key={config.id}
                  onClick={() => handleSelectConfig(config.id!)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedConfigId === config.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{config.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{config.description}</div>
                    </div>
                    {config.is_active && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Load Preset */}
            <div className="border-t pt-4">
              <label className="text-xs font-medium text-gray-600 uppercase">Load Preset</label>
              <select
                onChange={(e) => e.target.value && handleLoadPreset(e.target.value as keyof typeof PRESET_CONFIGS)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                defaultValue=""
              >
                <option value="">Select a preset...</option>
                {Object.keys(PRESET_CONFIGS).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content - Config Editor */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            {/* Config Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={currentConfig.name}
                        onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
                        placeholder="Configuration name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-semibold text-lg"
                      />
                      <textarea
                        value={currentConfig.description}
                        onChange={(e) => setCurrentConfig({ ...currentConfig, description: e.target.value })}
                        placeholder="Description"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-gray-900">{currentConfig.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{currentConfig.description}</p>
                    </>
                  )}
                </div>

                <div className="ml-4 flex gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md"
                      >
                        Edit
                      </button>
                      {!currentConfig.is_active && selectedConfigId && (
                        <button
                          onClick={handleActivate}
                          className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          Activate
                        </button>
                      )}
                      {selectedConfigId && configs.length > 1 && (
                        <button
                          onClick={handleDelete}
                          className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving || !currentConfig.name}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Section Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {[
                  { id: 'constraints', label: 'Hard Constraints', icon: '🔒' },
                  { id: 'penalties', label: 'Soft Penalties', icon: '⚖️' },
                  { id: 'solver', label: 'Solver Settings', icon: '⚙️' }
                ].map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as any)}
                    className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      activeSection === section.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{section.icon}</span>
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="p-6">
              {activeSection === 'constraints' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <strong>Hard Constraints</strong> are rules that must be satisfied. Violations will prevent assignments.
                  </div>

                  <SliderInput
                    label="Minimum Rest Hours"
                    value={currentConfig.min_rest_hours}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, min_rest_hours: val })}
                    min={8}
                    max={16}
                    unit=" hours"
                    help="Minimum hours of rest required between shifts"
                  />

                  <SliderInput
                    label="Maximum Shift Duration"
                    value={currentConfig.max_shift_duration_hours}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, max_shift_duration_hours: val })}
                    min={8}
                    max={24}
                    unit=" hours"
                    help="Maximum allowed duration for a single shift"
                  />

                  <SliderInput
                    label="Maximum Consecutive Shifts"
                    value={currentConfig.max_consecutive_shifts}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, max_consecutive_shifts: val })}
                    min={1}
                    max={7}
                    unit=" days"
                    help="Maximum number of consecutive days an employee can work"
                  />

                  <SliderInput
                    label="Maximum Work Days Per Week"
                    value={currentConfig.max_work_days_per_week}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, max_work_days_per_week: val })}
                    min={1}
                    max={7}
                    unit=" days"
                    help="Maximum number of days worked in a 7-day period"
                  />

                  <SliderInput
                    label="Qualification Expiry Threshold"
                    value={currentConfig.qual_expiry_threshold_days}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, qual_expiry_threshold_days: val })}
                    min={0}
                    max={180}
                    step={30}
                    unit=" days"
                    help="Days before expiry to stop using a qualification"
                  />
                </div>
              )}

              {activeSection === 'penalties' && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                    <strong>Soft Penalties</strong> guide the optimizer toward better solutions. Higher values = stronger preference.
                  </div>

                  <SliderInput
                    label="Coverage Weight (Priority)"
                    value={currentConfig.coverage_weight}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, coverage_weight: val })}
                    min={100}
                    max={5000}
                    step={100}
                    help="Higher = prioritize filling all shifts over other concerns"
                  />

                  <SliderInput
                    label="Target Hours Per Week"
                    value={currentConfig.target_hours_week}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, target_hours_week: val })}
                    min={20}
                    max={48}
                    unit=" hours"
                    help="Ideal weekly hours for work distribution fairness"
                  />

                  <SliderInput
                    label="Fairness Penalty"
                    value={currentConfig.fairness_penalty_per_hour}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, fairness_penalty_per_hour: val })}
                    min={0}
                    max={50}
                    unit=" per hour"
                    help="Penalty for deviating from target hours (higher = more balanced distribution)"
                  />

                  <SliderInput
                    label="Overtime Penalty"
                    value={currentConfig.overtime_penalty_per_hour}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, overtime_penalty_per_hour: val })}
                    min={0}
                    max={200}
                    step={5}
                    unit=" per hour"
                    help="Penalty for working over contracted hours (higher = avoid overtime)"
                  />

                  <SliderInput
                    label="Cross-Department Penalty"
                    value={currentConfig.cross_dept_penalty}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, cross_dept_penalty: val })}
                    min={0}
                    max={500}
                    step={10}
                    help="Penalty for assigning employees outside their department"
                  />
                </div>
              )}

              {activeSection === 'solver' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                    <strong>Solver Settings</strong> control the optimization algorithm performance and accuracy.
                  </div>

                  <SliderInput
                    label="Time Limit"
                    value={currentConfig.time_limit_sec}
                    onChange={(val) => setCurrentConfig({ ...currentConfig, time_limit_sec: val })}
                    min={30}
                    max={600}
                    step={30}
                    unit=" seconds"
                    help="Maximum time allowed to find a solution"
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">MIP Gap Tolerance</label>
                    <select
                      value={currentConfig.mip_gap}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, mip_gap: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      disabled={!isEditing}
                    >
                      <option value={0.001}>0.1% (Very tight - slower)</option>
                      <option value={0.01}>1% (Recommended)</option>
                      <option value={0.05}>5% (Faster, less optimal)</option>
                      <option value={0.1}>10% (Very fast)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      How close to optimal the solution must be. Lower = more optimal but slower.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Use Gurobi Solver</label>
                      <button
                        onClick={() => setCurrentConfig({ ...currentConfig, use_gurobi: !currentConfig.use_gurobi })}
                        disabled={!isEditing}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          currentConfig.use_gurobi ? 'bg-blue-600' : 'bg-gray-200'
                        } ${!isEditing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            currentConfig.use_gurobi ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {currentConfig.use_gurobi
                        ? 'Using commercial Gurobi solver (requires license, faster)'
                        : 'Using free GLPK solver (slower for large problems)'}
                    </p>
                  </div>

                  {/* Performance Estimate */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <h4 className="font-medium text-blue-900 mb-2">Performance Estimate</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                      <div>
                        <div className="text-xs opacity-75">Small (100 emp, 500 shifts)</div>
                        <div className="font-semibold">~{Math.ceil(currentConfig.time_limit_sec / 30)}min</div>
                      </div>
                      <div>
                        <div className="text-xs opacity-75">Large (1000 emp, 5000 shifts)</div>
                        <div className="font-semibold">~{currentConfig.time_limit_sec / 60}min - {currentConfig.time_limit_sec / 30}min</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="font-medium">About Optimizer Settings</div>
            <div className="text-xs mt-1 opacity-75">
              These settings control how the MIP (Mixed Integer Programming) optimizer balances shift coverage, fairness, and constraints.
              Only one configuration can be active at a time. Changes take effect on the next optimization run.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
