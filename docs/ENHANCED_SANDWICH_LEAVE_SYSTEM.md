# Enhanced Sandwich Leave Calculation System

## Overview
I have implemented a comprehensive sandwich leave calculation system that handles all the business rules you specified. The system automatically calculates leave balance deductions based on sophisticated rules that detect sandwich leave patterns and apply appropriate penalties.

## Business Rules Implemented

### 1. Continuous Friday to Monday Leave
- **Pattern**: Friday → Saturday → Sunday → Monday (4 consecutive days)
- **Deduction**: 4 days
- **Rule**: Treats weekend as working days when sandwiched between leave days

### 2. Friday + Weekend Pattern
- **Pattern**: Friday → Saturday → Sunday (3 consecutive days)
- **Deduction**: 4 days
- **Rule**: Sandwich leave penalty for taking Friday with weekend

### 3. Weekend + Monday Pattern
- **Pattern**: Saturday → Sunday → Monday (3 consecutive days)
- **Deduction**: 4 days
- **Rule**: Sandwich leave penalty for taking Monday with weekend

### 4. Separate Friday and Monday Applications
- **Pattern**: Friday leave + Monday leave (3 days apart)
- **Deduction**: 2 days each application (4 days total)
- **Rule**: Detects related applications and treats as sandwich leave

### 5. Single Friday/Monday with Approval
- **Pattern**: Single Friday OR single Monday (approved)
- **Deduction**: 1 day
- **Rule**: Normal deduction for approved single-day leave

### 6. Single Friday/Monday without Approval
- **Pattern**: Single Friday OR single Monday (pending/rejected)
- **Deduction**: 3 days (sandwich penalty)
- **Rule**: Penalty for unapproved Friday/Monday leave

### 7. Holiday Exclusion
- **Rule**: National holidays are automatically excluded from deduction calculations
- **Implementation**: Uses `holidays` table to identify national holidays
- **Benefit**: Employees don't get penalized for official holidays

## Technical Implementation

### Database Functions

#### 1. `calculate_sandwich_leave_deduction()`
- Main calculation function that implements all business rules
- Takes user ID, dates, half-day flag, status, and application time
- Returns actual days, deducted days, sandwich flag, and reason

#### 2. `preview_sandwich_leave_calculation()`
- Preview function for UI to show calculations before submission
- Provides detailed breakdown including weekends, holidays, and penalties
- Returns business rules explanation for user education

#### 3. `find_related_friday_monday_applications()`
- Detects separate Friday/Monday applications that form sandwich patterns
- Returns related applications with relationship type and combined deduction

#### 4. `update_leave_balance_on_status_change()`
- **Trigger function that automatically updates balances when leave is approved**
- Uses enhanced sandwich calculation for accurate deductions
- Handles status changes (approved ↔ pending/rejected/withdrawn)
- Creates balance records if they don't exist

#### 5. `recalculate_all_approved_leave_balances()`
- Admin function to recalculate all existing approved applications
- Updates both application records and balance deductions
- Provides detailed logging of changes made

#### 6. Helper Functions
- `is_friday()`, `is_monday()`: Day of week detection
- `is_weekend()`: Weekend detection
- `is_national_holiday()`: Holiday detection using holidays table
- `count_working_days()`: Counts working days excluding weekends and holidays

### Frontend Enhancements

#### 1. Enhanced Leave Application Form
- Real-time sandwich leave calculation preview
- Shows detailed breakdown of deduction rules
- Warns about related Friday/Monday applications
- Displays business rules for user education

#### 2. Leave Management Dashboard
- Enhanced application display with sandwich leave badges
- Detailed view showing calculation breakdown
- Visual indicators for different penalty types
- Color-coded alerts for sandwich leave patterns

#### 3. Smart Hooks
- `useSandwichLeavePreview()`: Real-time calculation preview
- `useRelatedFridayMondayApplications()`: Detects related applications
- `useRecalculateAllApprovedLeaveBalances()`: Admin tool for balance recalculation
- Enhanced type definitions for better TypeScript support

## Key Features

### 1. Real-time Calculation
- Users see exact deduction before submitting application
- Prevents surprises and improves transparency
- Shows impact of business rules clearly

### 2. Smart Detection
- Automatically detects sandwich leave patterns
- Identifies related applications across different dates
- Handles complex scenarios like separate Friday/Monday applications

### 3. Holiday-Aware
- Excludes national holidays from penalty calculations
- Fair treatment during holiday periods
- Reduces unnecessary penalties

### 4. Status-Aware Penalties
- Different rules for approved vs unapproved leave
- Encourages proper advance planning
- Reduces last-minute leave applications

### 5. Dynamic Balance Updates
- **Automatic balance deduction when leave is approved**
- Uses correct sandwich leave calculation for deduction
- Handles positive and negative balances appropriately
- Restores balance if leave is rejected/withdrawn

### 6. Comprehensive UI
- Visual indicators for all calculation types
- Educational content about business rules
- Clear breakdown of how deductions are calculated
- Admin tools for balance recalculation

## Usage Examples

### Example 1: Continuous Friday-Monday
```
Application: Friday (Dec 8) to Monday (Dec 11)
Calculation: 4 days deducted (sandwich leave)
Reason: "Sandwich leave: Continuous Friday to Monday (4 days deducted)"
```

### Example 2: Separate Applications
```
Application 1: Friday (Dec 8) - 2 days deducted
Application 2: Monday (Dec 11) - 2 days deducted
Total: 4 days deducted across both applications
Reason: "Sandwich leave: Separate Friday/Monday applications"
```

### Example 3: Single Approved Friday
```
Application: Friday (Dec 8) - Approved
Calculation: 1 day deducted
Reason: "Single Friday/Monday leave (approved - 1 day)"
```

### Example 4: Single Unapproved Monday
```
Application: Monday (Dec 11) - Pending
Calculation: 3 days deducted (penalty)
Reason: "Single Friday/Monday leave (unapproved - 3 days sandwich penalty)"
```

### Example 5: Holiday Exclusion
```
Application: Thursday to Tuesday (includes Friday holiday)
Calculation: Only working days counted, holiday excluded
Reason: "Regular leave (actual working days excluding holidays)"
```

## Migration Files

1. **`20250916000001_enhanced_sandwich_leave_calculation.sql`**
   - Enhanced calculation functions
   - Improved business rule implementation
   - Better holiday handling

## Benefits

1. **Transparency**: Users know exactly what will be deducted
2. **Fairness**: Holidays are excluded from penalties
3. **Accuracy**: Complex patterns are detected automatically
4. **Efficiency**: Real-time calculations prevent errors
5. **Education**: Users learn about leave policies through the UI
6. **Compliance**: Enforces company leave policies automatically

## Future Enhancements

1. **Configurable Rules**: Make business rules configurable per company
2. **Regional Holidays**: Support for different holiday calendars
3. **Team-based Rules**: Different rules for different teams/departments
4. **Analytics**: Reporting on sandwich leave patterns
5. **Mobile Optimization**: Enhanced mobile experience for leave applications

This enhanced system provides a robust, fair, and transparent way to handle sandwich leave calculations while educating users about leave policies and encouraging proper leave planning.
