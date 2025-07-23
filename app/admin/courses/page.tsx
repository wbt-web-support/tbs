"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReusableTiptapEditor from "@/components/reusable-tiptap-editor";
import { 
  Plus, 
  Edit, 
  Trash2, 
  BookOpen, 
  PlayCircle, 
  Clock,
  ChevronUp,
  ChevronDown,
  Video,
  Lock,
  Unlock,
  ArrowLeft,
  Settings,
  Users,
  BarChart3,
  ChevronRight,
  Play,
  X
} from "lucide-react";

type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
  created_at: string;
};

type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
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
  created_at: string;
};

type DialogState = {
  isOpen: boolean;
  type: 'course' | 'module' | 'lesson';
  mode: 'create' | 'edit';
  data?: any;
};

type ViewState = 'courses' | 'modules' | 'lessons';

const VIDEO_TYPES = [
  { value: 'vimeo', label: 'Vimeo' },
  { value: 'loom', label: 'Loom' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'custom', label: 'Custom URL' }
];

// Video Preview Component for Lesson Dialog
const VideoPreview = ({ videoUrl, videoType }: { videoUrl: string; videoType: string }) => {
  const getEmbedUrl = (url: string, type: string) => {
    if (!url) return '';
    
    switch (type) {
      case 'vimeo':
        const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        return vimeoId ? `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0` : url;
      case 'loom':
        const loomId = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)?.[1];
        return loomId ? `https://www.loom.com/embed/${loomId}` : url;
      case 'youtube':
        const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
        return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : url;
      default:
        return url;
    }
  };

  const embedUrl = getEmbedUrl(videoUrl, videoType);

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <Video className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium">Video Preview</p>
          <p className="text-xs">Enter a video URL to see preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden">
      <iframe
        src={embedUrl}
        title="Video Preview"
        className="w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default function CourseManagementPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('courses');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [allLessons, setAllLessons] = useState<CourseLesson[]>([]);
  
  const [dialog, setDialog] = useState<DialogState>({ 
    isOpen: false, 
    type: 'course', 
    mode: 'create' 
  });
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [lessonDescription, setLessonDescription] = useState("");

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse && currentView === 'modules') {
      fetchModules(selectedCourse.id);
    }
  }, [selectedCourse, currentView]);

  useEffect(() => {
    if (selectedModule && currentView === 'lessons') {
      fetchLessons(selectedModule.id);
    }
  }, [selectedModule, currentView]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching courses",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (error) throw error;
      setModules(data || []);

      // Also fetch all lessons for these modules
      if (data && data.length > 0) {
        const moduleIds = data.map(m => m.id);
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('course_lessons')
          .select('*')
          .in('module_id', moduleIds)
          .order('order_index');

        if (lessonsError) throw lessonsError;
        setAllLessons(lessonsData || []);
      } else {
        setAllLessons([]);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching modules",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchLessons = async (moduleId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index');

      if (error) throw error;
      setLessons(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching lessons",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (dialog.type === 'course') {
        if (dialog.mode === 'create') {
          const { error } = await supabase
            .from('courses')
            .insert([formData]);
          if (error) throw error;
          toast({ title: "Course created successfully" });
          fetchCourses();
        } else {
          const { error } = await supabase
            .from('courses')
            .update(formData)
            .eq('id', dialog.data.id);
          if (error) throw error;
          toast({ title: "Course updated successfully" });
          fetchCourses();
        }
      } else if (dialog.type === 'module') {
        const moduleData = {
          ...formData,
          course_id: selectedCourse?.id,
          order_index: dialog.mode === 'create' ? modules.length : formData.order_index
        };
        
        if (dialog.mode === 'create') {
          const { error } = await supabase
            .from('course_modules')
            .insert([moduleData]);
          if (error) throw error;
          toast({ title: "Module created successfully" });
        } else {
          const { error } = await supabase
            .from('course_modules')
            .update(moduleData)
            .eq('id', dialog.data.id);
          if (error) throw error;
          toast({ title: "Module updated successfully" });
        }
        fetchModules(selectedCourse!.id);
      } else if (dialog.type === 'lesson') {
        const currentModuleLessons = selectedModule ? getModuleLessons(selectedModule.id) : lessons;
        const lessonData = {
          ...formData,
          description: lessonDescription, // Use TipTap editor content
          module_id: selectedModule?.id,
          order_index: dialog.mode === 'create' ? currentModuleLessons.length : formData.order_index
        };
        
        if (dialog.mode === 'create') {
          const { error } = await supabase
            .from('course_lessons')
            .insert([lessonData]);
          if (error) throw error;
          toast({ title: "Lesson created successfully" });
        } else {
          const { error } = await supabase
            .from('course_lessons')
            .update(lessonData)
            .eq('id', dialog.data.id);
          if (error) throw error;
          toast({ title: "Lesson updated successfully" });
        }
        
        if (currentView === 'lessons') {
          fetchLessons(selectedModule!.id);
        } else {
          // Refresh modules view with updated lessons
          fetchModules(selectedCourse!.id);
        }
      }

      setDialog({ isOpen: false, type: 'course', mode: 'create' });
      setFormData({});
      setLessonDescription('');
    } catch (error: any) {
      toast({
        title: "Error saving",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      let table = '';
      switch (type) {
        case 'course':
          table = 'courses';
          break;
        case 'module':
          table = 'course_modules';
          break;
        case 'lesson':
          table = 'course_lessons';
          break;
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully` });
      
      // Refresh appropriate data
      if (type === 'course') {
        fetchCourses();
        setSelectedCourse(null);
        setCurrentView('courses');
              } else if (type === 'module') {
          fetchModules(selectedCourse!.id);
        } else if (type === 'lesson') {
          if (currentView === 'lessons') {
            fetchLessons(selectedModule!.id);
          } else {
            // Refresh modules view with updated lessons
            fetchModules(selectedCourse!.id);
          }
        }
    } catch (error: any) {
      toast({
        title: "Error deleting",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const moveItem = async (type: string, id: string, direction: 'up' | 'down') => {
    try {
      let items: any[] = [];
      let table = '';
      
      if (type === 'module') {
        items = modules;
        table = 'course_modules';
      } else if (type === 'lesson') {
        items = lessons;
        table = 'course_lessons';
      }

      const currentIndex = items.findIndex(item => item.id === id);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      if (targetIndex < 0 || targetIndex >= items.length) return;

      // Update order_index for both items
      const updates = [
        { id: items[currentIndex].id, order_index: targetIndex },
        { id: items[targetIndex].id, order_index: currentIndex }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from(table)
          .update({ order_index: update.order_index })
          .eq('id', update.id);
        
        if (error) throw error;
      }

      // Refresh data
      if (type === 'module') {
        fetchModules(selectedCourse!.id);
      } else if (type === 'lesson') {
        if (currentView === 'lessons') {
          fetchLessons(selectedModule!.id);
        } else {
          // Refresh modules view with updated lessons
          fetchModules(selectedCourse!.id);
        }
      }
      
    } catch (error: any) {
      toast({
        title: "Error reordering",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openDialog = (type: 'course' | 'module' | 'lesson', mode: 'create' | 'edit', data?: any) => {
    setDialog({ isOpen: true, type, mode, data });
    setFormData(data || {});
    if (type === 'lesson') {
      setLessonDescription(data?.description || '');
    }
  };

  const toggleModuleExpansion = (moduleId: string) => {
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

  const getModuleLessons = (moduleId: string) => {
    return allLessons
      .filter(lesson => lesson.module_id === moduleId)
      .sort((a, b) => a.order_index - b.order_index);
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

  const getBreadcrumb = () => {
    if (currentView === 'courses') return 'All Courses';
    if (currentView === 'modules') return `${selectedCourse?.title} / Modules`;
    if (currentView === 'lessons') return `${selectedCourse?.title} / ${selectedModule?.title} / Lessons`;
    return '';
  };

  const getAddButtonText = () => {
    // if (currentView === 'courses') return 'Add Course';
    if (currentView === 'modules') return 'Add Module';
    if (currentView === 'lessons') return 'Add Lesson';
    return 'Add';
  };

  const getAddButtonType = (): 'course' | 'module' | 'lesson' => {
    if (currentView === 'courses') return 'course';
    if (currentView === 'modules') return 'module';
    return 'lesson';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {currentView !== 'courses' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (currentView === 'lessons') {
                    setCurrentView('modules');
                    setSelectedModule(null);
                  } else if (currentView === 'modules') {
                    setCurrentView('courses');
                    setSelectedCourse(null);
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Course Management</h1>
          </div>
          <p className="text-gray-500">{getBreadcrumb()}</p>
        </div>
        {currentView !== 'courses' && (
          <Button 
            onClick={() => openDialog(getAddButtonType(), 'create')} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {getAddButtonText()}
          </Button>
        )}
      </div>

      {/* Content */}
      {currentView === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">{course.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant={course.is_active ? "default" : "secondary"}>
                    {course.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(course.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCourse(course);
                      setCurrentView('modules');
                    }}
                    className="flex-1"
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDialog('course', 'edit', course)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete('course', course.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {courses.length === 0 && (
            <div className="col-span-full text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
              <p className="text-gray-500 mb-4">Create your first course to get started</p>
              {/* Removed Add Course button here */}
            </div>
          )}
        </div>
      )}

             {currentView === 'modules' && selectedCourse && (
         <div className="space-y-4">
           {modules.map((module, index) => {
             const moduleLessons = getModuleLessons(module.id);
             const isExpanded = expandedModules.has(module.id);
             
             return (
               <Card key={module.id}>
                 <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                         {index + 1}
                       </div>
                       <div>
                         <h3 className="font-semibold text-lg">{module.title}</h3>
                         <p className="text-gray-600 text-sm">{module.description}</p>
                         <div className="flex items-center gap-4 mt-2">
                           <Badge variant={module.is_active ? "default" : "secondary"}>
                             {module.is_active ? 'Active' : 'Inactive'}
                           </Badge>
                           <span className="text-xs text-gray-500">
                             {moduleLessons.length} lesson{moduleLessons.length !== 1 ? 's' : ''}
                           </span>
                           <span className="text-xs text-gray-500">
                             Created {new Date(module.created_at).toLocaleDateString()}
                           </span>
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex items-center gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => toggleModuleExpansion(module.id)}
                       >
                         {isExpanded ? (
                           <ChevronDown className="h-4 w-4 mr-1" />
                         ) : (
                           <ChevronRight className="h-4 w-4 mr-1" />
                         )}
                         {isExpanded ? 'Hide' : 'Show'} Lessons
                       </Button>
                       
                       <Button
                         variant="outline"
                         className="hidden"
                         size="sm"
                         onClick={() => {
                           setSelectedModule(module);
                           setCurrentView('lessons');
                         }}
                       >
                         <PlayCircle className="h-4 w-4 mr-1" />
                         Manage
                       </Button>
                       
                       <div className="flex gap-1">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => moveItem('module', module.id, 'up')}
                           disabled={index === 0}
                         >
                           <ChevronUp className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => moveItem('module', module.id, 'down')}
                           disabled={index === modules.length - 1}
                         >
                           <ChevronDown className="h-4 w-4" />
                         </Button>
                       </div>
                       
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => openDialog('module', 'edit', module)}
                       >
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => handleDelete('module', module.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>

                   {/* Expandable Lessons Section */}
                   {isExpanded && (
                     <div className="mt-6 pt-6 border-t border-gray-200">
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="font-medium text-gray-900 flex items-center gap-2">
                           <Video className="h-4 w-4" />
                           Lessons in this module
                         </h4>
                         <Button
                           size="sm"
                           onClick={() => {
                             setSelectedModule(module);
                             openDialog('lesson', 'create');
                           }}
                           className="h-8"
                         >
                           <Plus className="h-3 w-3 mr-1" />
                           Add Lesson
                         </Button>
                       </div>
                       
                       {moduleLessons.length === 0 ? (
                         <div className="text-center py-8 text-gray-500">
                           <Video className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                           <p className="text-sm">No lessons in this module yet</p>
                           <Button
                             size="sm"
                             variant="outline"
                             className="mt-2"
                             onClick={() => {
                               setSelectedModule(module);
                               openDialog('lesson', 'create');
                             }}
                           >
                             <Plus className="h-3 w-3 mr-1" />
                             Add First Lesson
                           </Button>
                         </div>
                       ) : (
                         <div className="space-y-3">
                           {moduleLessons.map((lesson, lessonIndex) => (
                             <div
                               key={lesson.id}
                               className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                             >
                               <div className="flex items-center gap-3">
                                 <div className="bg-green-100 text-green-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                                   {lessonIndex + 1}
                                 </div>
                                 <div>
                                   <h5 className="font-medium text-gray-900 text-sm">{lesson.title}</h5>
                                   <div className="flex items-center gap-3 mt-1">
                                     <Badge variant="outline" className="text-xs">
                                       {lesson.video_type}
                                     </Badge>
                                     <div className="flex items-center gap-1 text-xs text-gray-500">
                                       <Clock className="h-3 w-3" />
                                       {formatDuration(lesson.video_duration_seconds)}
                                     </div>
                                     <Badge variant={lesson.is_active ? "default" : "secondary"} className="text-xs">
                                       {lesson.is_active ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                     </Badge>
                                   </div>
                                 </div>
                               </div>
                               
                               <div className="flex items-center gap-1">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => {
                                     const currentLessons = getModuleLessons(module.id);
                                     moveItem('lesson', lesson.id, 'up');
                                   }}
                                   disabled={lessonIndex === 0}
                                 >
                                   <ChevronUp className="h-3 w-3" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => {
                                     const currentLessons = getModuleLessons(module.id);
                                     moveItem('lesson', lesson.id, 'down');
                                   }}
                                   disabled={lessonIndex === moduleLessons.length - 1}
                                 >
                                   <ChevronDown className="h-3 w-3" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => {
                                     setSelectedModule(module);
                                     openDialog('lesson', 'edit', lesson);
                                   }}
                                 >
                                   <Edit className="h-3 w-3" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleDelete('lesson', lesson.id)}
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   )}
                 </CardContent>
               </Card>
             );
           })}
           
           {modules.length === 0 && (
             <div className="text-center py-12">
               <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
               <p className="text-gray-500 mb-4">Add the first module to {selectedCourse.title}</p>
               <Button onClick={() => openDialog('module', 'create')}>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Module
               </Button>
             </div>
           )}
         </div>
       )}

      {currentView === 'lessons' && selectedModule && (
        <div className="space-y-4">
          {lessons.map((lesson, index) => (
            <Card key={lesson.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{lesson.title}</h3>
                      <p className="text-gray-600 text-sm">{lesson.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="outline">{lesson.video_type}</Badge>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          {formatDuration(lesson.video_duration_seconds)}
                        </div>
                        <Badge variant={lesson.is_active ? "default" : "secondary"}>
                          {lesson.is_active ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem('lesson', lesson.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem('lesson', lesson.id, 'down')}
                        disabled={index === lessons.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDialog('lesson', 'edit', lesson)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete('lesson', lesson.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {lessons.length === 0 && (
            <div className="text-center py-12">
              <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No lessons yet</h3>
              <p className="text-gray-500 mb-4">Add the first lesson to {selectedModule.title}</p>
              <Button onClick={() => openDialog('lesson', 'create')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lesson
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialog for Creating/Editing Courses and Modules */}
      {dialog.type !== 'lesson' && (
        <Dialog open={dialog.isOpen} onOpenChange={(open) => setDialog(prev => ({ ...prev, isOpen: open }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialog.mode === 'create' ? 'Create' : 'Edit'} {dialog.type.charAt(0).toUpperCase() + dialog.type.slice(1)}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={`Enter ${dialog.type} title`}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={`Enter ${dialog.type} description`}
                  rows={3}
                />
              </div>

              {dialog.type === 'course' && (
                <div>
                  <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
                  <Input
                    id="thumbnail_url"
                    value={formData.thumbnail_url || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                    placeholder="Enter thumbnail URL"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active !== false}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formData.title}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
                {dialog.mode === 'create' ? 'Create' : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Enhanced Dialog for Creating/Editing Lessons */}
      {dialog.type === 'lesson' && (
        <Dialog open={dialog.isOpen} onOpenChange={(open) => setDialog(prev => ({ ...prev, isOpen: open }))}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-2xl font-semibold">
                  {dialog.mode === 'create' ? 'Create New Lesson' : 'Edit Lesson'}
                </DialogTitle>
              
              </div>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-6">
              {/* Left Column - Video Preview */} 
              <div className="space-y-6" >
                <div>
                  <Label className="text-lg font-medium mb-4 block">Video Preview</Label>
                  <VideoPreview 
                    videoUrl={formData.video_url || ''} 
                    videoType={formData.video_type || 'vimeo'} 
                  />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="video_url" className="text-sm font-medium">Video URL</Label>
                    <Input
                      id="video_url"
                      value={formData.video_url || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                      placeholder="Enter video URL (Vimeo, Loom, YouTube, etc.)"
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="video_type" className="text-sm font-medium">Video Type</Label>
                      <Select
                        value={formData.video_type || 'vimeo'}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, video_type: value }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VIDEO_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="video_duration_seconds" className="text-sm font-medium">Duration (minutes)</Label>
                      <Input
                        id="video_duration_seconds"
                        type="number"
                        value={formData.video_duration_seconds ? Math.round(formData.video_duration_seconds / 60) : ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, video_duration_seconds: (parseInt(e.target.value) || 0) * 60 }))}
                        placeholder="e.g., 15"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Lesson Details */}
              <div className="space-y-6 col-span-2">
                <div>
                  <Label htmlFor="lesson_title" className="text-lg font-medium mb-2 block">Lesson Title</Label>
                  <Input
                    id="lesson_title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter lesson title"
                    className="text-lg"
                  />
                </div>

                <div>
                  <Label className="text-lg font-medium mb-2 block">Lesson Description</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <ReusableTiptapEditor
                      content={lessonDescription}
                      onChange={setLessonDescription}
                      placeholder="Write a comprehensive lesson description..."
                      showToolbar={true}
                      showBubbleMenu={true}
                      showSlashCommands={true}
                      showStatusBar={false}
                      editorHeight="400px"
                      className="min-h-[400px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="lesson_is_active"
                    checked={formData.is_active !== false}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded h-4 w-4"
                  />
                  <Label htmlFor="lesson_is_active" className="text-sm font-medium">
                    Publish this lesson (make it visible to students)
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-6">
              <div className="flex gap-3 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialog(prev => ({ ...prev, isOpen: false }));
                    setFormData({});
                    setLessonDescription('');
                  }}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formData.title || !lessonDescription.trim()}
                  className="bg-blue-600 hover:bg-blue-700 px-6"
                >
                  {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  {dialog.mode === 'create' ? 'Create Lesson' : 'Update Lesson'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 