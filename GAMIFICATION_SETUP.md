# 🎮 TBS Gamification System Setup

This guide will help you implement the leaderboard and points system in your TBS application.

## 🗄️ **1. Database Setup**

First, run the migration to create the necessary tables:

```bash
# Run the gamification migration
supabase db reset --linked  # If you want to reset everything
# OR
supabase migration up  # To apply just the new migration
```

The migration creates:
- `user_points` table - stores user points, levels, and streaks
- `point_activities` table - tracks individual point-earning activities
- `leaderboard_view` - optimized view for leaderboard queries
- Helper functions for point calculation and awarding

## 🚀 **2. Test the System**

### **Manual Testing:**
1. **Visit the dashboard** - You should see the new leaderboard in the bottom section
2. **Complete a timeline event** - You should get a "🎉 +50 points!" toast notification
3. **Check the leaderboard** - Your points should appear

### **Add Test Data (Optional):**
```sql
-- Add some test points to see the leaderboard in action
SELECT add_user_points(
  auth.uid(), 
  'test_activity', 
  'test_1', 
  150, 
  'Test points for setup'
);
```

## 📊 **3. Available Point Values**

Current point system:

| Activity | Points |
|----------|---------|
| Daily Login | 10 |
| Timeline Event Completion | 50 |
| Scorecard Green Status | 25 |
| Scorecard Light Green | 15 |
| Battle Plan Section | 100 |
| Machine Setup | 200 |
| Playbook Completion | 150 |
| Team Member Added | 30 |
| Meeting Scheduled | 40 |
| Innovation Idea | 60 |
| Profile Completion | 75 |

## 🎯 **4. How to Add Points to Other Features**

### **Example 1: Battle Plan Completion**
```typescript
import { trackActivity } from "@/utils/points";

// When user completes a battle plan section
const handleSectionComplete = async () => {
  const pointsAwarded = await trackActivity.battlePlanSection('mission_statement');
  if (pointsAwarded) {
    toast.success('🎉 Battle plan section completed! +100 points!');
  }
};
```

### **Example 2: Scorecard Green Status**
```typescript
// When scorecard metric turns green
const handleScorecardUpdate = async (scorecardId: string, status: string) => {
  if (status === 'Green') {
    const pointsAwarded = await trackActivity.scorecardGreen(scorecardId);
    if (pointsAwarded) {
      toast.success('🎉 Metric achieved green status! +25 points!');
    }
  }
};
```

### **Example 3: Machine Setup**
```typescript
// When user completes machine setup
const handleMachineSetup = async (machineId: string, machineType: string) => {
  const pointsAwarded = await trackActivity.machineSetup(machineId, machineType);
  if (pointsAwarded) {
    toast.success(`🎉 ${machineType} machine setup complete! +200 points!`);
  }
};
```

## 🏆 **5. Leaderboard Features**

The leaderboard shows:
- **All-time rankings** with total points
- **Monthly leaders** based on current month points  
- **Weekly leaders** based on current week points
- **User levels** calculated automatically (1000 points per level)
- **Streak tracking** for consecutive daily activities
- **Rank positions** with special icons for top 3

## 🎨 **6. Customization Options**

### **Change Point Values:**
Edit `utils/points.ts` and modify the `POINT_VALUES` object:

```typescript
export const POINT_VALUES = {
  TIMELINE_COMPLETION: 75,  // Changed from 50
  SCORECARD_GREEN: 50,      // Changed from 25
  // ... other values
};
```

### **Add New Activity Types:**
1. Add to `ACTIVITY_TYPES` in `utils/points.ts`
2. Add corresponding point value to `POINT_VALUES`
3. Create a new tracking method in the `PointsManager` class
4. Add to the `trackActivity` helper object

### **Modify Level Calculation:**
Edit the `calculate_user_level` function in the migration:

```sql
-- Change from 1000 points per level to 500 points per level
CREATE OR REPLACE FUNCTION calculate_user_level(points INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN GREATEST(1, (points / 500) + 1);
END;
$$ LANGUAGE plpgsql;
```

## 🔧 **7. Troubleshooting**

### **Leaderboard not showing:**
- Check browser console for errors
- Verify migration was applied successfully
- Check RLS policies are enabled

### **Points not being awarded:**
- Check browser console for `trackActivity` errors
- Verify user is authenticated
- Check if activity has already been awarded (no duplicates)

### **Database permission errors:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('user_points', 'point_activities');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON user_points TO authenticated;
GRANT SELECT, INSERT ON point_activities TO authenticated;
```

## 🎯 **8. Next Steps**

Now that the basic system is working, you can:

1. **Add more activity tracking** throughout the app
2. **Create achievement badges** for milestones
3. **Add team competitions** and challenges  
4. **Implement point redemption** for rewards
5. **Create notification system** for point celebrations
6. **Add progress visualization** with charts and graphs

## 📈 **9. Performance Notes**

- The system uses database functions to prevent duplicate point awards
- Leaderboard queries are optimized with indexes
- Point calculations happen asynchronously to avoid blocking UI
- Consider implementing caching for high-traffic applications

---

**Congratulations! 🎉** Your TBS platform now has a fully functional gamification system with leaderboards and point tracking! 