/**
 * KRA Percentage Calculation Utilities
 * 
 * Implements the correct weighted percentage calculation for KRA evaluations
 * Based on the principle: For each goal, convert score to percentage (points/max_points)
 * then multiply by goal weight, and sum all contributions
 */

export interface GoalEvaluation {
  weight: number;
  points: number;
  maxPoints: number;
}

export interface KRAGoalData {
  goal_id: string;
  weight: number;
  level_5_points: number; // max points
  awarded_points?: number;
}

export interface KRAEvaluationData {
  goal: KRAGoalData;
  awarded_points: number;
}

/**
 * Calculate the total KRA score using weighted percentage method
 * New approach: (sum of actual weighted points / sum of maximum weighted points) * 100
 * @param goals Array of goal evaluations with weight, points, and maxPoints
 * @returns Overall percentage score (0-100)
 */
export function calculateTotalScore(goals: GoalEvaluation[]): number {
  if (!goals || goals.length === 0) return 0;

  let actual = 0;
  let maximum = 0;

  goals.forEach(goal => {
    actual += goal.points * goal.weight;
    maximum += goal.maxPoints * goal.weight;
  });

  if (maximum === 0) return 0;
  return (actual / maximum) * 100;
}

/**
 * Calculate KRA percentage from evaluation data
 * @param evaluations Array of KRA evaluations with goal and awarded points
 * @returns Overall percentage score (0-100)
 */
export function calculateKRAPercentage(evaluations: KRAEvaluationData[]): number {
  if (!evaluations || evaluations.length === 0) return 0;

  const goals: GoalEvaluation[] = evaluations.map(evaluation => ({
    weight: evaluation.goal.weight,
    points: evaluation.awarded_points,
    maxPoints: evaluation.goal.level_5_points
  }));

  return calculateTotalScore(goals);
}

/**
 * Get performance rating based on percentage
 * @param percentage Overall percentage score
 * @returns Performance rating string
 */
export function getPerformanceRating(percentage: number): string {
  if (percentage >= 90) return 'Far Exceeded Expectations';
  if (percentage >= 75) return 'Exceeds Expectations';
  if (percentage >= 60) return 'Meets Expectations';
  if (percentage >= 40) return 'Below Expectations';
  if (percentage > 0) return 'Poor Performance';
  return 'Not Evaluated';
}

/**
 * Calculate individual goal contribution to overall percentage
 * @param goalWeight Weight of the goal (e.g., 25 for 25%)
 * @param awardedPoints Points awarded for the goal
 * @param maxPoints Maximum possible points for the goal
 * @returns Weighted points contribution for this goal
 */
export function calculateGoalContribution(
  goalWeight: number, 
  awardedPoints: number, 
  maxPoints: number
): { actualWeighted: number; maxWeighted: number } {
  return {
    actualWeighted: awardedPoints * goalWeight,
    maxWeighted: maxPoints * goalWeight
  };
}

/**
 * Validate KRA calculation inputs
 * @param evaluations Array of evaluations to validate
 * @returns Validation result with any errors
 */
export function validateKRACalculation(evaluations: KRAEvaluationData[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!evaluations || evaluations.length === 0) {
    errors.push('No evaluations provided');
    return { isValid: false, errors, warnings };
  }

  const totalWeight = evaluations.reduce((sum, evaluation) => sum + evaluation.goal.weight, 0);
  
  if (totalWeight === 0) {
    errors.push('Total weight of all goals is zero');
  }
  // Note: Total weight doesn't need to be 100 with the new calculation method

  evaluations.forEach((evaluation, index) => {
    const { goal, awarded_points } = evaluation;
    
    if (goal.weight < 0) {
      errors.push(`Goal ${index + 1}: Weight cannot be negative`);
    }
    
    if (goal.level_5_points < 0) {
      errors.push(`Goal ${index + 1}: Max points cannot be negative`);
    }
    
    if (awarded_points < 0) {
      errors.push(`Goal ${index + 1}: Awarded points cannot be negative`);
    }
    
    if (awarded_points > goal.level_5_points) {
      warnings.push(`Goal ${index + 1}: Awarded points (${awarded_points}) exceed max points (${goal.level_5_points})`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Example usage and test function
 */
export function testKRACalculation(): void {
  // Example from the user's reference:
  const goals: GoalEvaluation[] = [
    { weight: 25, points: 30, maxPoints: 35 },
    { weight: 25, points: 25, maxPoints: 35 },
    { weight: 25, points: 10, maxPoints: 35 },
    { weight: 15, points: 20, maxPoints: 25 },
    { weight: 10, points: 0, maxPoints: 10 }
  ];

  const result = calculateTotalScore(goals);
  console.log('KRA Calculation Test Result:', result);
  console.log('Expected result: 62.1%');
  
  // Manual calculation for verification:
  // actual = (30*25) + (25*25) + (10*25) + (20*15) + (0*10) = 750 + 625 + 250 + 300 + 0 = 1925
  // maximum = (35*25) + (35*25) + (35*25) + (25*15) + (10*10) = 875 + 875 + 875 + 375 + 100 = 3100
  // percentage = (1925 / 3100) * 100 = 62.096... ≈ 62.1%
  
  const actual = (30*25) + (25*25) + (10*25) + (20*15) + (0*10);
  const maximum = (35*25) + (35*25) + (35*25) + (25*15) + (10*10);
  console.log('Manual calculation:', { actual, maximum, percentage: (actual/maximum)*100 });
}
