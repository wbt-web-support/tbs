import { createClient } from "./client";

export type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CourseLesson = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  video_url: string;
  video_type: string;
  video_duration_seconds: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserProgress = {
  id: string;
  user_id: string;
  lesson_id: string;
  is_completed: boolean;
  progress_percentage: number;
  watch_time_seconds: number;
  completed_at?: string;
  last_watched_at: string;
  created_at: string;
  updated_at: string;
};

export type UserModuleProgress = {
  id: string;
  user_id: string;
  module_id: string;
  is_completed: boolean;
  progress_percentage: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

export type UserCourseEnrollment = {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  is_completed: boolean;
  progress_percentage: number;
  completed_at?: string;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
};

export async function getActiveCourse() {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data as Course;
}

export async function getCourseModules(courseId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_active', true)
    .order('order_index');

  if (error) throw error;
  return data as CourseModule[];
}

export async function getModuleLessons(moduleId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('course_lessons')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_active', true)
    .order('order_index');

  if (error) throw error;
  return data as CourseLesson[];
}

export async function getUserCourseProgress(userId: string, courseId: string) {
  const supabase = createClient();
  
  // Get course enrollment
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('user_course_enrollment')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (enrollmentError && enrollmentError.code !== 'PGRST116') {
    throw enrollmentError;
  }

  // Get modules for this course
  const modules = await getCourseModules(courseId);
  const moduleIds = modules.map(m => m.id);

  // Get all lessons for these modules
  const lessonsPromises = moduleIds.map(moduleId => getModuleLessons(moduleId));
  const allLessons = (await Promise.all(lessonsPromises)).flat();
  const lessonIds = allLessons.map(l => l.id);

  // Get user progress for all lessons
  const { data: lessonsProgress, error: lessonsError } = await supabase
    .from('user_course_progress')
    .select('*')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds);

  if (lessonsError) throw lessonsError;

  // Get module progress
  const { data: moduleProgress, error: moduleError } = await supabase
    .from('user_module_progress')
    .select('*')
    .eq('user_id', userId)
    .in('module_id', moduleIds);

  if (moduleError) throw moduleError;

  return {
    enrollment: enrollment as UserCourseEnrollment | null,
    lessonsProgress: lessonsProgress as UserProgress[],
    moduleProgress: moduleProgress as UserModuleProgress[],
    modules,
    lessons: allLessons
  };
}

// Get user's team_id for course progress tracking
export async function getUserTeamId(): Promise<string> {
  const supabase = createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('No authenticated user');
  }

  // Try to get team_id from business_info
  const { data: userInfo, error: userInfoError } = await supabase
    .from('business_info')
    .select('team_id')
    .eq('user_id', user.id)
    .single();

  // If no business_info record or no team_id, fall back to user.id
  if (userInfoError || !userInfo?.team_id) {
    return user.id;
  }

  return userInfo.team_id;
}

// Update lesson progress using team_id
export async function updateLessonProgress(
  lessonId: string, 
  progressPercentage: number, 
  watchTime: number, 
  isCompleted: boolean = false
) {
  const supabase = createClient();
  const teamId = await getUserTeamId();

  const { error } = await supabase
    .from('user_course_progress')
    .upsert({
      user_id: teamId, // Using team_id for shared progress
      team_id: teamId,
      lesson_id: lessonId,
      progress_percentage: progressPercentage,
      watch_time_seconds: watchTime,
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      last_watched_at: new Date().toISOString()
    }, {
      onConflict: 'team_id,lesson_id'
    });

  if (error) throw error;
}

// Get team progress for lessons
export async function getTeamLessonProgress(lessonIds: string[]) {
  const supabase = createClient();
  const teamId = await getUserTeamId();

  const { data, error } = await supabase
    .from('user_course_progress')
    .select('*')
    .eq('team_id', teamId)
    .in('lesson_id', lessonIds);

  if (error) throw error;
  return data || [];
}

// Get team progress for modules
export async function getTeamModuleProgress(moduleIds: string[]) {
  const supabase = createClient();
  const teamId = await getUserTeamId();

  const { data, error } = await supabase
    .from('user_module_progress')
    .select('*')
    .eq('team_id', teamId)
    .in('module_id', moduleIds);

  if (error) throw error;
  return data || [];
}

export async function enrollUserInCourse(userId: string, courseId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('user_course_enrollment')
    .upsert({
      user_id: userId,
      course_id: courseId,
      enrolled_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserCourseEnrollment;
}

export async function markLessonAsComplete(lessonId: string) {
  return updateLessonProgress(lessonId, 100, 0, true);
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getVideoEmbedUrl(url: string, type: string): string {
  switch (type) {
    case 'vimeo':
      const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return vimeoId ? `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0` : url;
    case 'loom':
      const loomId = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)?.[1];
      return loomId ? `https://www.loom.com/embed/${loomId}` : url;
    case 'youtube':
      const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
      return youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1` : url;
    default:
      return url;
  }
}

export function calculateOverallProgress(
  lessonsProgress: UserProgress[],
  totalLessons: number
): number {
  if (totalLessons === 0) return 0;
  
  const completedLessons = lessonsProgress.filter(p => p.is_completed).length;
  return Math.round((completedLessons / totalLessons) * 100);
}

export function isLessonUnlocked(
  lesson: CourseLesson,
  allLessons: CourseLesson[],
  userProgress: UserProgress[]
): boolean {
  // Get lessons in the same module
  const moduleLessons = allLessons
    .filter(l => l.module_id === lesson.module_id)
    .sort((a, b) => a.order_index - b.order_index);

  const lessonIndex = moduleLessons.findIndex(l => l.id === lesson.id);
  
  // First lesson is always unlocked
  if (lessonIndex === 0) return true;
  
  // Check if all previous lessons are completed
  const previousLessons = moduleLessons.slice(0, lessonIndex);
  return previousLessons.every(l => 
    userProgress.find(p => p.lesson_id === l.id)?.is_completed
  );
} 