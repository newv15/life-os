import { describe, expect, it } from 'vitest'
import { createProjectSchema, updateProjectSchema } from '@/lib/validation/project'
import { createGoalSchema, goalProgress, updateGoalSchema } from '@/lib/validation/goal'

const GOAL = '44444444-4444-4444-8444-444444444444'

describe('createProjectSchema', () => {
  it('trims the name and starts a project as active', () => {
    const project = createProjectSchema.parse({ name: '  Sito Yume  ' })

    expect(project.name).toBe('Sito Yume')
    expect(project.status).toBe('active')
    expect(project.priority).toBe('medium')
    expect(project.goalId).toBeNull()
  })

  it('rejects a name that is only whitespace', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('links to a goal', () => {
    expect(createProjectSchema.parse({ name: 'X', goalId: GOAL }).goalId).toBe(GOAL)
  })

  it('reads dates as calendar days, not instants', () => {
    const project = createProjectSchema.parse({
      name: 'X',
      startedOn: '2026-09-01',
      deadline: '2026-12-31',
    })

    // A project deadline is a day, not a moment: storing an instant would make
    // it shift by an hour twice a year for no reason.
    expect(project.startedOn).toBe('2026-09-01')
    expect(project.deadline).toBe('2026-12-31')
  })

  it('rejects a deadline before the start', () => {
    const result = createProjectSchema.safeParse({
      name: 'X',
      startedOn: '2026-12-31',
      deadline: '2026-09-01',
    })

    expect(result.success).toBe(false)
  })

  it('accepts a project with no dates at all', () => {
    const project = createProjectSchema.parse({ name: 'X' })
    expect(project.startedOn).toBeNull()
    expect(project.deadline).toBeNull()
  })
})

describe('updateProjectSchema', () => {
  it('changes one field at a time', () => {
    expect(updateProjectSchema.parse({ status: 'done' })).toEqual({ status: 'done' })
  })

  it('applies the same date rule to an edit', () => {
    const result = updateProjectSchema.safeParse({
      startedOn: '2026-12-31',
      deadline: '2026-09-01',
    })
    expect(result.success).toBe(false)
  })
})

describe('createGoalSchema', () => {
  it('needs a title and a horizon', () => {
    const goal = createGoalSchema.parse({ title: 'Mettere da parte 10.000', horizon: 'yearly' })

    expect(goal.title).toBe('Mettere da parte 10.000')
    expect(goal.horizon).toBe('yearly')
    expect(goal.status).toBe('active')
  })

  it('rejects a horizon that is not one of the four', () => {
    expect(createGoalSchema.safeParse({ title: 'X', horizon: 'decennale' }).success).toBe(false)
  })

  it('reads numeric targets written the Italian way', () => {
    const goal = createGoalSchema.parse({
      title: 'Risparmio',
      horizon: 'yearly',
      targetValue: '10.000',
      currentValue: '2.500,50',
    })

    expect(goal.targetValue).toBe(10000)
    expect(goal.currentValue).toBe(2500.5)
  })

  it('allows a goal with no number attached to it', () => {
    // "Read more" has no target value; it is driven by milestones instead.
    const goal = createGoalSchema.parse({ title: 'Leggere di più', horizon: 'monthly' })

    expect(goal.targetValue).toBeNull()
    expect(goal.currentValue).toBe(0)
  })

  it('accepts a negative current value, since a balance can be below zero', () => {
    const goal = createGoalSchema.parse({
      title: 'Uscire dal rosso',
      horizon: 'quarterly',
      currentValue: '-450',
      targetValue: '0',
    })

    expect(goal.currentValue).toBe(-450)
    expect(goal.targetValue).toBe(0)
  })

  it('rejects a target that is not a number', () => {
    expect(
      createGoalSchema.safeParse({ title: 'X', horizon: 'yearly', targetValue: 'tanti' }).success,
    ).toBe(false)
  })
})

describe('goalProgress', () => {
  const goal = (start: number, current: number, target: number | null) => ({
    start_value: start,
    current_value: current,
    target_value: target,
  })

  it('measures from where the goal started, not from zero', () => {
    // Started at 2.000, aiming at 10.000, now at 6.000: that is halfway,
    // not 60%. Counting money that was already there as progress would
    // flatter every goal that did not start empty.
    expect(goalProgress(goal(2000, 6000, 10000))).toBe(50)
  })

  it('is zero at the start and a hundred at the target', () => {
    expect(goalProgress(goal(2000, 2000, 10000))).toBe(0)
    expect(goalProgress(goal(2000, 10000, 10000))).toBe(100)
  })

  it('does not go past a hundred when the target is beaten', () => {
    expect(goalProgress(goal(0, 12000, 10000))).toBe(100)
  })

  it('does not go below zero when things move backwards', () => {
    expect(goalProgress(goal(2000, 1000, 10000))).toBe(0)
  })

  it('works when the goal is to reduce something', () => {
    // From 5.000 of debt down to zero, now at 2.000: 60% of the way.
    expect(goalProgress(goal(-5000, -2000, 0))).toBe(60)
  })

  it('has no percentage when there is no target to measure against', () => {
    expect(goalProgress(goal(0, 3, null))).toBeNull()
  })

  it('reads the strings the database returns for numeric columns', () => {
    expect(
      goalProgress({ start_value: '0', current_value: '25.5', target_value: '51' }),
    ).toBe(50)
  })
})

describe('updateGoalSchema', () => {
  it('records progress on its own', () => {
    expect(updateGoalSchema.parse({ currentValue: '8.000' })).toEqual({ currentValue: 8000 })
  })

  it('can close a goal', () => {
    expect(updateGoalSchema.parse({ status: 'done' }).status).toBe('done')
  })
})
