import { createClient } from "@/utils/supabase/client";

// Point values for different activities
export const POINT_VALUES = {
  TIMELINE_COMPLETION: 50,
  SCORECARD_GREEN: 25,
  SCORECARD_LIGHT_GREEN: 15,
  BATTLE_PLAN_SECTION: 100,
  MACHINE_SETUP: 200,
  PLAYBOOK_COMPLETION: 150,
  DAILY_LOGIN: 10,
  PROFILE_COMPLETION: 75,
  TEAM_MEMBER_ADDED: 30,
  MEETING_SCHEDULED: 40,
  INNOVATION_IDEA: 60,
  REVIEW_RESPONDED: 35,
} as const;

// Activity types that correspond to database activity_type field
export const ACTIVITY_TYPES = {
  TIMELINE_COMPLETION: 'timeline_completion',
  SCORECARD_UPDATE: 'scorecard_update',
  BATTLE_PLAN_SECTION: 'battle_plan_section',
  MACHINE_SETUP: 'machine_setup',
  PLAYBOOK_COMPLETION: 'playbook_completion',
  DAILY_LOGIN: 'daily_login',
  PROFILE_COMPLETION: 'profile_completion',
  TEAM_MEMBER_ADDED: 'team_member_added',
  MEETING_SCHEDULED: 'meeting_scheduled',
  INNOVATION_IDEA: 'innovation_idea',
  REVIEW_RESPONDED: 'review_responded',
} as const;

interface PointsService {
  awardPoints: (
    activityType: string,
    activityId: string,
    points: number,
    description?: string
  ) => Promise<boolean>;
  getUserPoints: () => Promise<any>;
  getLeaderboard: (limit?: number) => Promise<any[]>;
}

export class PointsManager implements PointsService {
  private supabase;
  private userId: string | null = null;

  constructor() {
    this.supabase = createClient();
  }

  private async ensureUser(): Promise<string> {
    if (!this.userId) {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      this.userId = user.id;
    }
    return this.userId;
  }

  /**
   * Award points to the current user for a specific activity
   */
  async awardPoints(
    activityType: string,
    activityId: string,
    points: number,
    description?: string
  ): Promise<boolean> {
    try {
      const userId = await this.ensureUser();
      
      const { data, error } = await this.supabase.rpc('add_user_points', {
        p_user_id: userId,
        p_activity_type: activityType,
        p_activity_id: activityId,
        p_points: points,
        p_description: description
      });

      if (error) {
        console.error('Error awarding points:', error);
        return false;
      }

      // Return true if points were successfully awarded (not a duplicate)
      return data === true;
    } catch (error) {
      console.error('Error in awardPoints:', error);
      return false;
    }
  }

  /**
   * Get current user's point information
   */
  async getUserPoints() {
    try {
      const userId = await this.ensureUser();
      
      const { data, error } = await this.supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {
        total_points: 0,
        level: 1,
        weekly_points: 0,
        monthly_points: 0,
        current_streak: 0,
        longest_streak: 0
      };
    } catch (error) {
      console.error('Error fetching user points:', error);
      return null;
    }
  }

  /**
   * Get leaderboard data
   */
  async getLeaderboard(limit: number = 10) {
    try {
      const { data, error } = await this.supabase
        .from('leaderboard_view')
        .select('*')
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Track daily login - should be called on dashboard load
   */
  async trackDailyLogin(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    return this.awardPoints(
      ACTIVITY_TYPES.DAILY_LOGIN,
      `login_${today}`,
      POINT_VALUES.DAILY_LOGIN,
      'Daily platform visit'
    );
  }

  /**
   * Track timeline event completion
   */
  async trackTimelineCompletion(timelineId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.TIMELINE_COMPLETION,
      `timeline_${timelineId}`,
      POINT_VALUES.TIMELINE_COMPLETION,
      'Timeline event completed'
    );
  }

  /**
   * Track scorecard metric update to green status
   */
  async trackScorecardGreen(scorecardId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.SCORECARD_UPDATE,
      `scorecard_green_${scorecardId}`,
      POINT_VALUES.SCORECARD_GREEN,
      'Scorecard metric achieved green status'
    );
  }

  /**
   * Track scorecard metric update to light green status
   */
  async trackScorecardLightGreen(scorecardId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.SCORECARD_UPDATE,
      `scorecard_light_green_${scorecardId}`,
      POINT_VALUES.SCORECARD_LIGHT_GREEN,
      'Scorecard metric achieved light green status'
    );
  }

  /**
   * Track battle plan section completion
   */
  async trackBattlePlanSection(sectionName: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.BATTLE_PLAN_SECTION,
      `battle_plan_${sectionName}`,
      POINT_VALUES.BATTLE_PLAN_SECTION,
      `Battle plan section completed: ${sectionName}`
    );
  }

  /**
   * Track machine setup completion
   */
  async trackMachineSetup(machineId: string, machineType: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.MACHINE_SETUP,
      `machine_${machineId}`,
      POINT_VALUES.MACHINE_SETUP,
      `${machineType} machine setup completed`
    );
  }

  /**
   * Track playbook completion
   */
  async trackPlaybookCompletion(playbookId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.PLAYBOOK_COMPLETION,
      `playbook_${playbookId}`,
      POINT_VALUES.PLAYBOOK_COMPLETION,
      'Playbook completed'
    );
  }

  /**
   * Track team member addition
   */
  async trackTeamMemberAdded(memberId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.TEAM_MEMBER_ADDED,
      `team_member_${memberId}`,
      POINT_VALUES.TEAM_MEMBER_ADDED,
      'Team member added to chain of command'
    );
  }

  /**
   * Track meeting scheduled
   */
  async trackMeetingScheduled(meetingId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.MEETING_SCHEDULED,
      `meeting_${meetingId}`,
      POINT_VALUES.MEETING_SCHEDULED,
      'Meeting scheduled'
    );
  }

  /**
   * Track innovation idea submission
   */
  async trackInnovationIdea(sessionId: string): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.INNOVATION_IDEA,
      `innovation_${sessionId}`,
      POINT_VALUES.INNOVATION_IDEA,
      'Innovation idea submitted'
    );
  }

  /**
   * Track profile completion
   */
  async trackProfileCompletion(): Promise<boolean> {
    return this.awardPoints(
      ACTIVITY_TYPES.PROFILE_COMPLETION,
      'profile_complete',
      POINT_VALUES.PROFILE_COMPLETION,
      'Profile completed'
    );
  }
}

// Export a singleton instance
export const pointsManager = new PointsManager();

// Helper functions for easy use throughout the app
export const trackActivity = {
  dailyLogin: () => pointsManager.trackDailyLogin(),
  timelineCompletion: (id: string) => pointsManager.trackTimelineCompletion(id),
  scorecardGreen: (id: string) => pointsManager.trackScorecardGreen(id),
  scorecardLightGreen: (id: string) => pointsManager.trackScorecardLightGreen(id),
  battlePlanSection: (section: string) => pointsManager.trackBattlePlanSection(section),
  machineSetup: (id: string, type: string) => pointsManager.trackMachineSetup(id, type),
  playbookCompletion: (id: string) => pointsManager.trackPlaybookCompletion(id),
  teamMemberAdded: (id: string) => pointsManager.trackTeamMemberAdded(id),
  meetingScheduled: (id: string) => pointsManager.trackMeetingScheduled(id),
  innovationIdea: (id: string) => pointsManager.trackInnovationIdea(id),
  profileCompletion: () => pointsManager.trackProfileCompletion(),
};

// Utility to show point celebration/notification
export const celebratePoints = (points: number, activity: string) => {
  // You can integrate with your toast/notification system here
  console.log(`🎉 +${points} points for ${activity}!`);
  
  // Example with a simple toast (you'll need to implement this based on your toast system)
  // toast.success(`🎉 +${points} points for ${activity}!`);
}; 