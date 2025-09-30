import { secondSupabase } from './secondSupabase';

// Explicitly export interfaces
export interface TimeEntry {
  id: string;
  user_id: string;
  start_time: string;
  duration: number; // Duration in seconds stored in second database
  created_at: string;
  updated_at: string;
}

// Duration calculation result interface
export interface DurationInfo {
  seconds: number;
  hours: number;
  formatted: string;
  isOngoing: boolean;
}

export interface UserTimeData {
  totalHoursToday: number;
  totalHoursThisWeek: number;
  totalHoursThisMonth: number;
  todayEntries: TimeEntry[];
  weeklyEntries: TimeEntry[];
  monthlyEntries: TimeEntry[];
  error?: string; // Optional error message
}

// Export the API object
export const secondTimeApi = {
  // Debug function to check database structure - back to Supabase client
  async debugDatabase(): Promise<void> {
    try {
      console.log('=== DEBUGGING SECOND DATABASE ===');
      
      // Try to access profiles table directly
      try {
        const { data: profileCount, error: countError } = await secondSupabase
          .from('profiles')
          .select('*')
          .limit(5);
        
        if (countError) {
          console.log('Profiles table error:', countError);
        } else {
          console.log('Profiles table accessible, count:', profileCount?.length || 0);
          if (profileCount && profileCount.length > 0) {
            console.log('Sample profile:', profileCount[0]);
          }
        }
      } catch (e) {
        console.log('Profiles table not accessible:', e);
      }
      
      // Try to access time_entries table directly
      try {
        const { data: timeCount, error: timeError } = await secondSupabase
          .from('time_entries')
          .select('*')
          .limit(5);
        
        if (timeError) {
          console.log('Time entries table error:', timeError);
        } else {
          console.log('Time entries table accessible, count:', timeCount?.length || 0);
          if (timeCount && timeCount.length > 0) {
            console.log('Sample time entry:', timeCount[0]);
          }
        }
      } catch (e) {
        console.log('Time entries table not accessible:', e);
      }
      
      console.log('=== END DEBUG ===');
    } catch (error) {
      console.log('Debug function error:', error);
    }
  },

  // Get user ID from profiles table using email - back to Supabase client
  async getUserIdByEmail(email: string): Promise<string | null> {
    try {
      console.log('Looking for email in profiles table:', email);
      
      // First, let's check what's in the profiles table
      console.log('Checking profiles table structure...');
      
      // Try a simple select first
      const { data: allProfiles, error: allError } = await secondSupabase
        .from('profiles')
        .select('*')
        .limit(5);
      
      if (allError) {
        console.error('Error accessing profiles table:', allError);
        return null;
      }
      
      console.log('Profiles table accessible, total profiles found:', allProfiles?.length || 0);
      if (allProfiles && allProfiles.length > 0) {
        console.log('Sample profile structure:', allProfiles[0]);
        console.log('Sample profile email:', allProfiles[0].email);
      }
      
      // Now try our specific query with case-insensitive email comparison
      console.log('Executing specific query for email:', email);
      const { data: profiles, error: profileError } = await secondSupabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase());

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      console.log('Query result - profiles found:', profiles?.length || 0);
      console.log('Raw query response:', profiles);

      // Check if we got any profiles
      if (profiles && profiles.length > 0) {
        console.log('Found user ID from profiles table:', profiles[0].id);
        return profiles[0].id;
      }

      console.log('Profile not found for email:', email);
      console.log('Profiles returned:', profiles);
      return null;
    } catch (error) {
      console.error('Error in getUserIdByEmail:', error);
      return null;
    }
  },

  // Get latest time entry for a specific user - back to Supabase client
  async getLatestTimeEntry(userId: string): Promise<TimeEntry | null> {
    try {
      console.log('=== getLatestTimeEntry START ===');
      console.log('Fetching latest time entry for user:', userId);
      
      // Optimized query - fetch only necessary fields: id, user_id, start_time, duration
      console.log('Executing optimized query for user:', userId);
      
      const { data: entries, error } = await secondSupabase
        .from('time_entries')
        .select('id, user_id, start_time, duration, created_at, updated_at')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(1);

      console.log('Query result - error:', error);
      console.log('Query result - entries:', entries);

      if (error) {
        console.error('❌ Error fetching latest time entry:', error);
        return null;
      }

      // Check if we got any entries
      if (entries && entries.length > 0) {
        console.log('✅ Latest time entry found:', entries[0]);
        console.log('=== getLatestTimeEntry END ===');
        return entries[0];
      }

      console.log('⚠️ No time entries found for user:', userId);
      console.log('=== getLatestTimeEntry END ===');
      return null;
    } catch (error) {
      console.error('❌ Exception in getLatestTimeEntry:', error);
      console.log('=== getLatestTimeEntry END ===');
      return null;
    }
  },

  // Get duration in seconds directly from database duration column
  getDurationSeconds(entry: TimeEntry): number {
    // Duration is stored in seconds in the second database
    return entry.duration || 0;
  },

  // Calculate duration in hours from database duration
  getDurationHours(entry: TimeEntry): number {
    const durationSeconds = this.getDurationSeconds(entry);
    return durationSeconds / 3600; // Convert seconds to hours
  },

  // Legacy functions for backward compatibility (deprecated - use getDurationSeconds/Hours instead)
  calculateDurationSeconds(startTime: string, endTime?: string): number {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    
    const durationMs = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(durationMs / 1000));
  },

  calculateDurationHours(startTime: string, endTime?: string): number {
    const durationSeconds = this.calculateDurationSeconds(startTime, endTime);
    return durationSeconds / 3600;
  },

  // Format duration seconds into human readable format
  formatDuration(durationSeconds: number): string {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  },

  // Get comprehensive duration information for a time entry using database duration
  getDurationInfo(entry: TimeEntry): DurationInfo {
    const seconds = this.getDurationSeconds(entry);
    const hours = this.getDurationHours(entry);
    const formatted = this.formatDuration(seconds);
    
    // Check if this is an ongoing session by comparing start_time + duration with current time
    const startTime = new Date(entry.start_time);
    const endTime = new Date(startTime.getTime() + (seconds * 1000));
    const now = new Date();
    const isOngoing = Math.abs(now.getTime() - endTime.getTime()) < 60000; // Within 1 minute suggests ongoing

    return {
      seconds,
      hours,
      formatted,
      isOngoing
    };
  },

  // Legacy function for backward compatibility (deprecated - use getDurationInfo(entry) instead)
  getDurationInfoLegacy(startTime: string, endTime?: string): DurationInfo {
    const seconds = this.calculateDurationSeconds(startTime, endTime);
    const hours = this.calculateDurationHours(startTime, endTime);
    const formatted = this.formatDuration(seconds);
    const isOngoing = !endTime;

    return {
      seconds,
      hours,
      formatted,
      isOngoing
    };
  },

  // Calculate total hours from time entries using database duration
  calculateTotalHours(entries: TimeEntry[]): number {
    return entries.reduce((total, entry) => {
      const durationHours = this.getDurationHours(entry);
      return total + durationHours;
    }, 0);
  },

  // Get comprehensive time data for a user
  async getUserTimeData(email: string): Promise<UserTimeData | null> {
    try {
      console.log('=== getUserTimeData START ===');
      console.log('Attempting to fetch user ID for email:', email);
      
      const userId = await this.getUserIdByEmail(email);
      console.log('✅ User ID result:', userId);
      
      if (!userId) {
        // console.error('❌ User not found in second database');
        console.log('=== getUserTimeData END ===');
        // Return a proper error response instead of null
        return {
          totalHoursToday: 0,
          totalHoursThisWeek: 0,
          totalHoursThisMonth: 0,
          todayEntries: [],
          weeklyEntries: [],
          monthlyEntries: [],
          error: 'User not found in time tracking database'
        };
      }

      console.log('🔄 Fetching latest time entry for user:', userId);
      console.log('🔄 Calling getLatestTimeEntry...');
      
      const latestEntry = await this.getLatestTimeEntry(userId);
      console.log('🔄 getLatestTimeEntry returned:', latestEntry);
      
      if (!latestEntry) {
        console.log('⚠️ No time entries found for user');
        console.log('=== getUserTimeData END ===');
        return {
          totalHoursToday: 0,
          totalHoursThisWeek: 0,
          totalHoursThisMonth: 0,
          todayEntries: [],
          weeklyEntries: [],
          monthlyEntries: [],
          error: 'No time tracking data found for this user'
        };
      }

      // Check if the latest entry is within 12 hours of current time
      const now = new Date();
      const startTime = new Date(latestEntry.start_time);
      const timeDiffMs = now.getTime() - startTime.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
      
      console.log('Latest entry start time:', startTime.toISOString());
      console.log('Current time:', now.toISOString());
      console.log('Time difference (hours):', timeDiffHours);

      // Only include the entry if it's within 12 hours
      let todayEntries: TimeEntry[] = [];
      let totalHoursToday = 0;
      
      if (timeDiffHours <= 12 && timeDiffHours >= 0) {
        todayEntries = [latestEntry];
        totalHoursToday = this.getDurationHours(latestEntry);
        
        console.log('Entry is within 12 hours, duration from database:', latestEntry.duration, 'seconds');
        console.log('Calculated duration hours:', totalHoursToday, 'hours');
        console.log('Duration in readable format:', this.formatDuration(latestEntry.duration));
      } else {
        console.log('Entry is outside 12-hour window or in the future');
        return {
          totalHoursToday: 0,
          totalHoursThisWeek: 0,
          totalHoursThisMonth: 0,
          todayEntries: [],
          weeklyEntries: [],
          monthlyEntries: [],
          error: `Latest time entry is ${timeDiffHours.toFixed(1)} hours old (outside 12-hour window)`
        };
      }

      return {
        totalHoursToday,
        totalHoursThisWeek: totalHoursToday,
        totalHoursThisMonth: totalHoursToday,
        todayEntries,
        weeklyEntries: todayEntries,
        monthlyEntries: todayEntries
      };
    } catch (error) {
      console.error('Error in getUserTimeData:', error);
      return null;
    }
  }
};
