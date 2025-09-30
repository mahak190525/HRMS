# Sandwich Leave Implementation

This document describes the comprehensive sandwich leave calculation system implemented in the HRMS application.

## Business Rules

The sandwich leave system implements the following business rules:

### 1. Friday + Saturday + Sunday Pattern (Case 1)
- **Pattern**: Leave applied for Friday + Saturday + Sunday (3 consecutive days)
- **Deduction**: 4 days from leave balance
- **Reason**: Creates a 4-day weekend by bridging a weekend

### 2. Saturday + Sunday + Monday Pattern (Case 2)
- **Pattern**: Leave applied for Saturday + Sunday + Monday (3 consecutive days)  
- **Deduction**: 4 days from leave balance
- **Reason**: Creates a 4-day weekend by bridging a weekend

### 3. Friday to Monday Continuous (4-day block)
- **Pattern**: Leave applied from Friday to Monday (4 consecutive days)
- **Deduction**: 4 days from leave balance
- **Reason**: Direct 4-day leave spanning a weekend

### 4. Individual Friday/Monday Leaves (Non-continuous)
- **Pattern**: Separate applications for Friday and the following Monday
- **Deduction**: 2 days each (4 days total across both applications)
- **Reason**: Treated as sandwich leave to prevent gaming the system

### 5. Single Friday or Monday with Prior Approval
- **Pattern**: Single day leave on Friday or Monday
- **Condition**: Application approved AND applied in advance (not sudden)
- **Deduction**: 1 day only
- **Reason**: Legitimate single-day leave with proper approval

### 6. Single Friday or Monday - Sudden/Unapproved
- **Pattern**: Single day leave on Friday or Monday
- **Condition**: Sudden leave (applied on/after leave date) OR unapproved
- **Deduction**: 3 days penalty
- **Reason**: Discourages sudden Friday/Monday leaves

## Holiday Handling

The system properly excludes national holidays from deduction calculations:

- **Holiday Exclusion**: Days marked as national holidays (is_optional = false) are not counted toward leave deduction
- **Working Days Calculation**: Only actual working days (excluding weekends and holidays) are considered for base deduction
- **Sandwich Penalties Apply**: Even if holidays fall within a sandwich pattern, the sandwich penalty rules still apply

## Technical Implementation

### Frontend Components

#### 1. Sandwich Leave Calculator (`src/utils/sandwichLeaveCalculator.ts`)
- Core calculation logic implementing all business rules
- Holiday-aware working day calculations
- Support for half-day leaves
- Sudden leave detection

#### 2. Leave Application Form Enhancement (`src/pages/dashboard/LeaveApplication.tsx`)
- Real-time sandwich leave preview
- Visual indicators for sandwich leave detection
- Detailed breakdown of calculation components
- Warning alerts for sandwich leave patterns

#### 3. API Hooks (`src/hooks/useSandwichLeave.ts`)
- `useSandwichLeavePreview()` - Real-time calculation preview
- Integration with existing leave management hooks
- Error handling and loading states

### Backend Implementation

#### 1. Database Functions
- `calculate_sandwich_leave_deduction()` - Main calculation function
- `preview_sandwich_leave_calculation()` - Preview calculation for UI
- `is_friday()`, `is_monday()`, `is_weekend()` - Day detection helpers
- `is_national_holiday()` - Holiday checking
- `count_working_days()` - Working day calculation excluding weekends and holidays

#### 2. Database Schema Enhancements
- `sandwich_deducted_days` column in `leave_applications` table
- `sandwich_reason` column for storing calculation reasoning
- `is_sandwich_leave` boolean flag for easy filtering

#### 3. Triggers and Automation
- Automatic sandwich leave calculation on leave approval
- Leave balance updates reflecting actual deducted days
- Audit trail for all sandwich leave calculations

### API Integration

#### 1. Leave API (`src/services/api.ts`)
```typescript
async previewSandwichLeaveCalculation(
  userId: string,
  startDate: string,
  endDate: string,
  isHalfDay: boolean = false
)
```

#### 2. Holidays API
```typescript
async getAllHolidays(year?: number)
```

## User Interface Features

### 1. Real-time Preview
- Automatic calculation as user selects dates
- Clear indication of sandwich leave detection
- Breakdown of working days, weekends, holidays, and penalties

### 2. Visual Indicators
- Green alerts for normal leave calculations
- Yellow/orange alerts for sandwich leave detection
- Clear explanation of why sandwich rules apply

### 3. Detailed Breakdown
- Total days in range
- Actual working days
- Weekend days (excluded)
- Holiday days (excluded)
- Sandwich penalty days (if applicable)

## Example Scenarios

### Scenario 1: Friday-Monday Weekend Sandwich
```
Dates: Friday, Sept 26 to Monday, Sept 29, 2025
Calculation:
- Total days: 4
- Working days: 2 (Friday + Monday)
- Weekend days: 2 (Saturday + Sunday)
- Deducted days: 4 (sandwich penalty)
- Reason: "Sandwich leave: Friday to Monday continuous (4 days deducted)"
```

### Scenario 2: Leave with Holiday
```
Dates: Tuesday, Oct 1 to Thursday, Oct 3, 2025 (Gandhi Jayanti on Oct 2)
Calculation:
- Total days: 3
- Working days: 2 (Tuesday + Thursday)
- Holiday days: 1 (Wednesday - Gandhi Jayanti)
- Weekend days: 0
- Deducted days: 2 (actual working days)
- Reason: "Regular leave (actual working days excluding holidays)"
```

### Scenario 3: Sudden Friday Leave
```
Dates: Friday, Sept 26, 2025 (applied on same day)
Calculation:
- Total days: 1
- Working days: 1
- Sudden leave: Yes
- Deducted days: 3 (penalty for sudden Friday leave)
- Reason: "Single Friday/Monday leave (unapproved/sudden - 3 days penalty)"
```

## Configuration and Maintenance

### 1. Holiday Management
- Holidays are managed in the `holidays` table
- Support for optional vs mandatory holidays
- Annual holiday calendar updates

### 2. Business Rule Adjustments
- Calculation logic is centralized for easy updates
- Database functions can be updated without frontend changes
- Clear separation between UI and business logic

### 3. Reporting and Analytics
- All sandwich leave applications are flagged in the database
- Historical data preserved for audit purposes
- Analytics on sandwich leave patterns and trends

## Testing and Validation

The implementation includes comprehensive testing scenarios:

1. **Basic Sandwich Patterns**: Friday-Monday, Fri+Weekend, Weekend+Monday
2. **Holiday Interactions**: Leaves spanning holidays
3. **Edge Cases**: Half days, sudden leaves, individual Friday/Monday pairs
4. **Boundary Conditions**: Year boundaries, long weekends
5. **Performance**: Large date ranges, multiple user scenarios

## Future Enhancements

Potential improvements to consider:

1. **Flexible Business Rules**: Configuration-driven sandwich leave policies
2. **Department-specific Rules**: Different rules for different departments
3. **Integration with Attendance**: Automatic sandwich detection based on actual attendance
4. **Advanced Analytics**: Predictive analytics for sandwich leave patterns
5. **Mobile Optimization**: Enhanced mobile experience for leave applications

This implementation provides a robust, user-friendly, and maintainable sandwich leave system that enforces business rules while providing transparency to users about how their leave is calculated.
