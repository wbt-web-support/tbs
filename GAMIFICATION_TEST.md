# 🎮 Gamification System - Test Guide

## **Current Implementation (Simplified)**

We've simplified the system to properly handle just 2 activities first:

### **1. Daily Login** (+10 points)
- **Automatic**: Points awarded when user visits dashboard
- **Once per day**: Same day logins don't give extra points
- **Locations**: `/dashboard` and `/new-dashboard`

### **2. Timeline Completion** (+50 points / -50 points)
- **Complete event**: +50 points
- **Uncomplete event**: -50 points removed
- **Location**: `/chq-timeline`

## **How to Test**

### **Step 1: Apply the Migrations**
Run these migrations in order:
1. `20250128000000_create_gamification_system.sql` - Creates tables
2. `20250128000002_refresh_leaderboard_view.sql` - Fixes schema cache
3. `20250128000003_add_remove_points_function.sql` - Adds point removal
4. `20250128000004_improve_remove_points_tracking.sql` - Improves tracking

### **Step 2: Test Daily Login**
1. Visit `/dashboard` or `/new-dashboard`
2. Check browser console for: `🎉 Daily login points awarded!`
3. Check leaderboard - should show 10 points
4. Refresh page - should NOT get more points (once per day)

### **Step 3: Test Timeline Completion**
1. Go to `/chq-timeline`
2. Complete an event - see toast: `🎉 Event completed! +50 points earned!`
3. Check leaderboard - should show 60 points total (10 + 50)
4. **Uncomplete the same event** - see toast: `Event marked as incomplete - 50 points removed`
5. Check leaderboard - should show 10 points again

## **What's Working**
- ✅ Daily login tracking (once per day)
- ✅ Timeline completion awards points
- ✅ Timeline uncompletion removes points
- ✅ Duplicate prevention (can't get points twice for same action)
- ✅ Leaderboard updates in real-time
- ✅ Weekly/Monthly point tracking (now properly updated on removal!)
- ✅ Streak tracking
- ✅ **NEW: Point removal history** (negative points stored for audit trail)
- ✅ **NEW: Accurate weekly/monthly totals** (considers when points were earned)

## **What's NOT Added Yet**
We removed these to simplify and will add them one by one:
- ❌ Scorecard green status
- ❌ Battle plan sections
- ❌ Machine setup
- ❌ Team member additions
- ❌ Meeting scheduling
- ❌ Innovation ideas
- ❌ Profile completion

## **Next Steps**

Once daily login and timeline are working perfectly, we can add the next activity. For example:

```typescript
// In utils/points.ts, uncomment:
BATTLE_PLAN_SECTION: 100,

// Add the method:
async trackBattlePlanSection(sectionName: string): Promise<boolean> {
  return this.awardPoints(
    ACTIVITY_TYPES.BATTLE_PLAN_SECTION,
    `battle_plan_${sectionName}`,
    POINT_VALUES.BATTLE_PLAN_SECTION,
    `Battle plan section completed: ${sectionName}`
  );
}

// Then in the battle plan component, add:
await trackActivity.battlePlanSection('mission_statement');
```

## **Database Queries for Testing**

```sql
-- Check user points
SELECT * FROM user_points WHERE user_id = auth.uid();

-- Check activities (will now show both positive and negative entries)
SELECT * FROM point_activities 
WHERE user_id = auth.uid() 
ORDER BY earned_at DESC;

-- View net points per activity (shows totals after additions/removals)
SELECT * FROM user_activity_net_points 
WHERE user_id = auth.uid();

-- View leaderboard
SELECT * FROM leaderboard_view;

-- Manually test point removal
SELECT remove_user_points(
  auth.uid(), 
  'timeline_completion', 
  'timeline_[EVENT_ID]'
);

-- Fix weekly/monthly totals if needed
SELECT recalculate_user_periodic_points(auth.uid());
```

## **What's New in the Improved System**

### **1. Point Removal History**
When you uncomplete an activity, the system now:
- Keeps the original positive point record
- Adds a new NEGATIVE point record (e.g., -50)
- Shows full history in `point_activities` table

Example after completing then uncompleting a timeline event:
```
+50 points - Timeline event completed (2024-01-28 10:00)
-50 points - Points removed for undoing: timeline_completion (2024-01-28 10:05)
```

### **2. Accurate Weekly/Monthly Tracking**
- If you earned points **last week** and remove them **this week**:
  - Total points: Reduced ✓
  - This week's points: NOT reduced ✓ (correct!)
  - Last week's points: Would be reduced if viewing last week
  
- If you earned points **this week** and remove them **this week**:
  - Total points: Reduced ✓
  - This week's points: Also reduced ✓ (correct!)

### **3. Net Points View**
The new `user_activity_net_points` view shows:
- Net points per activity (additions - removals)
- How many times earned vs removed
- Useful for debugging and analytics 