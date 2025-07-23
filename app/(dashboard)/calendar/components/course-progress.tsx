"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { getUserTeamId, getTeamLessonProgress, getTeamModuleProgress, updateLessonProgress as updateLessonProgressUtil } from "@/utils/supabase/courses";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  Award,
  PlayCircle,
  Lock,
  Calendar,
  Target,
  ChevronDown,
  ChevronRight,
  Video,
  User,
  Menu,
  X,
  Circle,
  CheckCircle2,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
};

type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order_index: number;
  is_active: boolean;
};

type CourseLesson = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  video_url: string;
  video_type: string;
  video_duration_seconds: number;
  order_index: number;
  is_active: boolean;
};

type UserProgress = {
  lesson_id: string;
  is_completed: boolean;
  progress_percentage: number;
  watch_time_seconds: number;
  last_watched_at: string;
};

type ModuleProgress = {
  module_id: string;
  is_completed: boolean;
  progress_percentage: number;
  completed_at?: string;
};

// Removed CourseEnrollment type - no longer needed

type VideoPlayerProps = {
  videoUrl: string;
  videoType: string;
  lessonTitle: string;
  onProgress: (currentTime: number, duration: number) => void;
  onComplete: () => void;
};

const VideoPlayer = ({ videoUrl, videoType, lessonTitle, onProgress, onComplete }: VideoPlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);

  const getEmbedUrl = (url: string, type: string) => {
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
  };

  return (
    <div className="relative aspect-video bg-black overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <Spinner className="h-8 w-8 text-white" />
        </div>
      )}
      <iframe
        src={getEmbedUrl(videoUrl, videoType)}
        title={lessonTitle}
        className="w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
};

export default function CourseProgress() {
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>([]);
  // Removed enrollment state - no longer needed
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<CourseLesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchCourseData();
  }, []);

  const fetchCourseData = async () => {
    try {
      // Fetch course (assuming there's only one active course)
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      if (!courseData) {
        setLoading(false);
        return;
      }

      // Fetch modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseData.id)
        .eq('is_active', true)
        .order('order_index');

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Fetch lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('course_lessons')
        .select('*')
        .in('module_id', modulesData?.map(m => m.id) || [])
        .eq('is_active', true)
        .order('order_index');

      if (lessonsError) throw lessonsError;
      setLessons(lessonsData || []);

      // Auto-select first lesson if none selected and expand first module
      if (!selectedLesson && lessonsData && lessonsData.length > 0) {
        setSelectedLesson(lessonsData[0]);
        setExpandedModules(new Set([lessonsData[0].module_id]));
      } else if (modulesData && modulesData.length > 0) {
        // At least expand the first module to show lessons
        setExpandedModules(new Set([modulesData[0].id]));
      }

      // Fetch team progress using utility functions
      const progressData = await getTeamLessonProgress(lessonsData?.map(l => l.id) || []);
      setUserProgress(progressData);

      // Fetch module progress using utility functions
      const moduleProgressData = await getTeamModuleProgress(modulesData?.map(m => m.id) || []);
      setModuleProgress(moduleProgressData);

    } catch (error: any) {
      console.error('Error fetching course data:', error);
      toast({
        title: "Error loading course",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateLessonProgress = async (lessonId: string, progressPercentage: number, watchTime: number, isCompleted: boolean = false) => {
    try {
      // Use utility function for updating progress
      await updateLessonProgressUtil(lessonId, progressPercentage, watchTime, isCompleted);

      // Update local state
      setUserProgress(prev => {
        const existingIndex = prev.findIndex(p => p.lesson_id === lessonId);
        const newProgress = {
          lesson_id: lessonId,
          is_completed: isCompleted,
          progress_percentage: progressPercentage,
          watch_time_seconds: watchTime,
          last_watched_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newProgress;
          return updated;
        } else {
          return [...prev, newProgress];
        }
      });

      if (isCompleted) {
        toast({
          title: "Lesson completed!",
          description: "Great job! Keep up the momentum.",
        });
      } else if (progressPercentage === 0) {
        toast({
          title: "Lesson marked as incomplete",
          description: "You can restart this lesson anytime.",
        });
      }

    } catch (error: any) {
      console.error('Error updating progress:', error);
      toast({
        title: "Error updating progress",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const markLessonComplete = async (lessonId: string) => {
    await updateLessonProgress(lessonId, 100, 0, true);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return "0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getLessonProgress = (lessonId: string): UserProgress | undefined => {
    return userProgress.find(p => p.lesson_id === lessonId);
  };

  const getModuleProgress = (moduleId: string): ModuleProgress | undefined => {
    return moduleProgress.find(p => p.module_id === moduleId);
  };

  const isLessonUnlocked = (lesson: CourseLesson): boolean => {
    const lessonIndex = lessons
      .filter(l => l.module_id === lesson.module_id)
      .sort((a, b) => a.order_index - b.order_index)
      .findIndex(l => l.id === lesson.id);
    
    if (lessonIndex === 0) return true;
    
    const previousLessons = lessons
      .filter(l => l.module_id === lesson.module_id)
      .sort((a, b) => a.order_index - b.order_index)
      .slice(0, lessonIndex);
    
    return previousLessons.every(l => getLessonProgress(l.id)?.is_completed);
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const calculateCourseProgress = (): number => {
    if (lessons.length === 0) return 0;
    const completedLessons = lessons.filter(lesson => 
      getLessonProgress(lesson.id)?.is_completed
    ).length;
    return (completedLessons / lessons.length) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Course Available</h3>
          <p className="text-gray-500 max-w-sm">There is no active course at the moment. Check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-20 right-4 z-50 lg:hidden bg-white border border-gray-200 rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors"
      >
        {isSidebarOpen ? (
          <X className="h-5 w-5 text-gray-600" />
        ) : (
          <Menu className="h-5 w-5 text-gray-600" />
        )}
      </button>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area - Video and Lesson Info */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50">
        {selectedLesson ? (
          <>
            {/* Video Player - Large and Prominent */}
            <div className="bg-gray-50 relative">
              <div className="max-w-7xl mx-auto">
              <VideoPlayer
                videoUrl={selectedLesson.video_url}
                videoType={selectedLesson.video_type}
                lessonTitle={selectedLesson.title}
                onProgress={(currentTime, duration) => {
                  const percentage = (currentTime / duration) * 100;
                  updateLessonProgress(selectedLesson.id, percentage, currentTime);
                }}
                onComplete={() => {
                  markLessonComplete(selectedLesson.id);
                }}
              />
              </div>
            </div>

            {/* Lesson Content */}
            <div className="max-w-7xl mx-auto w-full px-6 py-8">
              {/* Lesson Header */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
              <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-3">{selectedLesson.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(selectedLesson.video_duration_seconds || 0)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {selectedLesson.video_type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
              </div>
              
              <div className="flex gap-3">
                {getLessonProgress(selectedLesson.id)?.is_completed ? (
                  <Button 
                    onClick={() => updateLessonProgress(selectedLesson.id, 0, 0, false)}
                    variant="outline"
                      className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => markLessonComplete(selectedLesson.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Complete
                  </Button>
                )}
              </div>
            </div>

            {/* Description */}
            {selectedLesson.description && (
                <div className="prose prose-lg max-w-none">
                  <div 
                    className="text-gray-700 leading-relaxed flex flex-col gap-3"
                    style={{
                      lineHeight: '1.8',
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: selectedLesson.description.replace(/<br\s*\/?>/gi, '<br style="margin-bottom: 1em;">') 
                    }}
                  />
              </div>
            )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Welcome to the Course</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Select a lesson from the course outline to begin your learning journey. 
                Track your progress as you complete each lesson.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Course Content Sidebar */}
      <div className={cn(
        "w-[420px] h-auto bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out sticky top-0",
        "lg:relative lg:translate-x-0", // Always visible on desktop
        "fixed top-0 right-0 z-40", // Fixed position on mobile
        isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0" // Slide in/out on mobile
      )}>
        <div className="flex flex-col h-full">
        {/* Course Header */}
          <div className="py-3 px-4 border-b border-gray-100 flex-shrink-0 bg-blue-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">{course.title}</h2>
            {/* Close button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-blue-100 rounded-full transition-colors"
            >
                <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
            
            <div className="space-y-3">
              
              <div className="relative">
                <Progress value={calculateCourseProgress()} className="h-1 bg-white" />
                <div className="absolute inset-0 bg-blue-500 rounded-full" 
                     style={{ width: `${calculateCourseProgress()}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{lessons.filter(l => getLessonProgress(l.id)?.is_completed).length} of {lessons.length} lessons complete</span>
                <span>{Math.round((lessons.filter(l => getLessonProgress(l.id)?.is_completed).length / lessons.length) * 100) || 0}%</span>
              </div>
          </div>
        </div>

        {/* Modules and Lessons */}
        <ScrollArea className="flex-1 h-0">
            <div className="py-2">
            {modules.map((module, moduleIndex) => {
              const moduleLessons = lessons
                .filter(l => l.module_id === module.id)
                .sort((a, b) => a.order_index - b.order_index);
              
              const moduleProgressData = getModuleProgress(module.id);
              const isExpanded = expandedModules.has(module.id);
              const completedCount = moduleLessons.filter(l => getLessonProgress(l.id)?.is_completed).length;
              const totalDuration = moduleLessons.reduce((acc, lesson) => acc + (lesson.video_duration_seconds || 0), 0);
                const moduleProgressPercentage = moduleLessons.length > 0 ? (completedCount / moduleLessons.length) * 100 : 0;
              
              return (
                  <div key={module.id} className="mb-2">
                  {/* Module Header */}
                  <button
                    onClick={() => toggleModule(module.id)}
                      className="w-full flex items-center justify-between p-4 mx-2 bg-gray-100 hover:bg-gray-50 transition-colors text-left rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-blue-700">{moduleIndex + 1}</span>
                        </div>
                      <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm">{module.title}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-500">
                              {completedCount} of {moduleLessons.length} lessons
                            </p>
                            <p className="text-xs text-gray-500">
                              {totalDuration > 0 ? formatDuration(totalDuration) : '0min'}
                        </p>
                      </div>
                        </div>
                        <div className="flex items-center justify-center flex-shrink-0">
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Lessons */}
                  {isExpanded && (
                      <div className="ml-6 mr-2 mt-2 space-y-1">
                      {moduleLessons.map((lesson, lessonIndex) => {
                        const lessonProgressData = getLessonProgress(lesson.id);
                        const isUnlocked = isLessonUnlocked(lesson);
                        const isSelected = selectedLesson?.id === lesson.id;
                        
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => {
                              if (isUnlocked) {
                                setSelectedLesson(lesson);
                                // Close sidebar on mobile after lesson selection
                                setIsSidebarOpen(false);
                              }
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 text-left transition-all rounded-lg",
                              isSelected 
                                  ? "bg-blue-100 border border-blue-200" 
                                  : "hover:bg-gray-50 border border-transparent",
                              !isUnlocked && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center justify-center flex-shrink-0">
                              {lessonProgressData?.is_completed ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                              ) : isUnlocked ? (
                                <PlayCircle className="w-6 h-6 text-blue-600" />
                              ) : (
                                <Lock className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            
                              <div className="flex-1 min-w-0">
                                <h4 className={cn(
                                  "font-medium text-sm",
                                  isSelected ? "text-blue-900" : "text-gray-900"
                                )}>
                                  {lesson.title}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDuration(lesson.video_duration_seconds || 0)}</span>
                                </div>
                              </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        </div>
      </div>


    </div>
  );
} 