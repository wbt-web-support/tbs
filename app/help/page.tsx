'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, ArrowRight, HelpCircle, UserPlus, LogIn, User, Shield, BarChart3, BookOpen, Plus, Settings, ChevronUp, Video, Edit, Lock, Clock, Pencil, Trash2, CheckSquare, Users, MessageSquare, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: HelpItem[];
  videoUrl?: string;
}

interface HelpItem {
  id: string;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  steps: (string | { text: string; videoUrl?: string })[];
  url?: string;
  videoUrl?: string;
  fields?: { name: string; type: string; required: boolean; description: string; videoUrl?: string }[];
}

// Video Popup Component
interface VideoPopupProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

const VideoPopup: React.FC<VideoPopupProps> = ({ isOpen, onClose, videoUrl, title }) => {
  if (!isOpen) return null;

  const getEmbedUrl = (url: string) => {
    // Handle Loom URLs
    if (url.includes('loom.com')) {
      const videoId = url.split('/').pop();
      return `https://www.loom.com/embed/${videoId}`;
    }
    // Handle YouTube URLs
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('/').pop()?.split('?')[0]
        : url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // Handle Vimeo URLs
    if (url.includes('vimeo.com')) {
      const videoId = url.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="aspect-video">
          <iframe
            src={getEmbedUrl(videoUrl)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

const helpSections: HelpSection[] = [
  {
    id: 'user-creation',
    title: 'Steps to Add a New User',
    description: 'Complete guide for creating new user accounts and linking analytics accounts',
    icon: UserPlus,
    color: 'gray',
    items: [
      {
        id: 'step-1',
        title: 'Sign in as Super Admin',
        description: 'Access the admin dashboard',
        icon: LogIn,
        steps: [
          'Go to the Sign In page',
          'Use credentials: test@webuildtrades.com / 123456',
          'You will be redirected to Admin Dashboard'
        ],
        url: '/sign-in'
      },
      {
        id: 'step-2',
        title: 'Add a New User',
        description: 'Navigate to user management and create account',
        icon: User,
        steps: [
          'Go to User Management page',
          'Click "Add User"',
          'Fill in user details',
          'Securely save the client\'s email and password',
          'Share credentials with the client'
        ],
        url: '/admin/users',
        fields: [
          { name: 'Email', type: 'email', required: true, description: 'Client\'s login ID for the portal' },
          { name: 'Password', type: 'password', required: true, description: 'Super Admin can reset this later if needed' },
          { name: 'Full Name', type: 'text', required: true, description: 'User\'s complete name' },
          { name: 'Business Name', type: 'text', required: true, description: 'Company or business name' },
          { name: 'Phone Number', type: 'tel', required: true, description: 'Contact phone number' },
          { name: 'WBT Onboarding Data', type: 'file/url', required: true, description: 'Attach PDF file or paste PDF URL from client\'s onboarding success email', videoUrl: 'https://www.loom.com/share/a9bd168ee1b84139888171c4afd2056c?sid=dca10436-1803-4e3d-8bd1-d86eba54165e' },
          { name: 'Google Review Link', type: 'url', required: true, description: 'Go to the business Google Maps page, click on the Reviews tab, and copy the URL from the browser address bar' }
        ]
      },
      {
        id: 'step-3',
        title: 'Connect Google Analytics Account',
        description: 'Ensure the Google Analytics account is properly connected for linking',
        icon: BarChart3,
        steps: [
          'Navigate to /admin/analytics',
          'Check if the Google Analytics account is connected',
          'If not connected, click "Connect Google Analytics" and use: Email: websupport@webuildtrades.com',
          'Note: This will be handled by the website team'
        ],
        url: '/admin/analytics'
      },
      {
        id: 'step-4',
        title: 'Link Google Analytics Properties to Clients',
        description: 'Manage user access to analytics properties by linking accounts',
        icon: User,
        steps: [
          'Click on "Manage Linked Accounts"',
          'Confirm that the "Link Analytics Properties" section appears',
          'Review the two columns: TBS Platform Users (admin users) and Google Analytics Properties (available accounts)',
          'To link accounts: Select the user in the left column, Select the analytics property in the right column, Click on "Link Account"',
          'If you don\'t find the account, request to add it from the website team'
        ],
        url: '/admin/analytics',
        videoUrl: 'https://www.loom.com/share/f21499a407124cbe9a08866b4c7df604?sid=2cf3257c-f04d-46b2-af8e-6a71d6f073ca'
      },
      {
        id: 'step-5',
        title: 'Review Linked Analytics Accounts',
        description: 'Verify and manage existing linked analytics accounts',
        icon: Shield,
        steps: [
          'Scroll down to the "Linked Accounts" section',
          'Verify that the linked account appears with company name as main heading',
          'View analytics property details and linking date',
          'Remove any linked account if necessary using the dropdown menu'
        ],
        url: '/admin/analytics'
      }
    ]
  },
  {
    id: 'modules-management',
    title: 'Modules Management',
    description: 'Complete guide for managing courses, modules, and lessons',
    icon: BookOpen,
    color: 'gray',
    items: [
      {
        id: 'mm-step-1',
        title: 'Access Course Management',
        description: 'Navigate to the modules management interface',
        icon: BookOpen,
        steps: [
          'From admin dashboard, go to /admin/courses',
          'Access the Course Management page',
          'View all available courses in the system'
        ],
        url: '/admin/courses'
      },
      {
        id: 'mm-step-2',
        title: 'Create a New Course',
        description: 'Set up a new course with basic information',
        icon: Plus,
        steps: [
          'Click "Add Course" button (if available)',
          'Enter course title and description',
          'Set course status (Active/Inactive)',
          'Save the course'
        ],
        url: '/admin/courses'
      },
      {
        id: 'mm-step-3',
        title: 'Manage Course Modules',
        description: 'Create and organise modules within a course',
        icon: Settings,
        steps: [
          'Click "Manage" on any course card',
          'View the modules view for that course',
          'Click "Add Module" to create new modules',
          'Fill in module title, description, and status',
          'Save the module'
        ],
        url: '/admin/courses'
      },
      {
        id: 'mm-step-4',
        title: 'Organize Module Order',
        description: 'Arrange modules in the desired sequence',
        icon: ChevronUp,
        steps: [
          'Use the up/down arrow buttons on each module',
          'Move modules to desired positions',
          'Order changes are automatically saved',
          'Modules are displayed in numerical order'
        ],
        url: '/admin/courses'
      },
      {
        id: 'mm-step-5',
        title: 'Create Course Lessons',
        description: 'Add video lessons to modules',
        icon: Video,
        steps: [
          'Expand a module to see its lessons',
          'Click "Add Lesson" within the module',
          'Fill in lesson details: title, description, video URL',
          'Select video type (Vimeo, Loom, YouTube, Custom)',
          'Set video duration in minutes',
          'Use the rich text editor for lesson descriptions',
          'Set lesson status (Draft/Published)',
          'Save the lesson'
        ],
        url: '/admin/courses'
      },
      {
        id: 'mm-step-6',
        title: 'Manage Lesson Content',
        description: 'Organise and edit lesson materials',
        icon: Edit,
        steps: [
          'Use the expandable lessons view in modules',
          'Reorder lessons using up/down arrows',
          'Edit lesson details by clicking the edit button',
          'Update video URLs, descriptions, and settings',
          'Delete lessons if needed'
        ],
        url: '/admin/courses'
      },
      {
        id: 'mm-step-7',
        title: 'Course Status Management',
        description: 'Control visibility and access to courses',
        icon: Lock,
        steps: [
          'Toggle course/module/lesson status between Active/Inactive',
          'Active items are visible to users',
          'Inactive items are hidden from user view',
          'Use the toggle switch in lesson creation/editing'
        ],
        url: '/admin/courses'
      }
    ]
  },
  {
    id: 'timeline-management',
    title: 'Timeline Management',
    description: 'Complete guide for managing timeline events and scheduling',
    icon: Clock,
    color: 'gray',
    items: [
      {
        id: 'tm-step-1',
        title: 'Access Timeline Management',
        description: 'Navigate to the timeline management interface',
        icon: Clock,
        steps: [
          'From admin dashboard, go to /admin/timeline',
          'Access the Manage Timeline Events page',
          'View all timeline events organised by week'
        ],
        url: '/admin/timeline'
      },
      {
        id: 'tm-step-2',
        title: 'Create Timeline Events',
        description: 'Add new events to the timeline schedule with required and optional fields',
        icon: Plus,
        steps: [
          'Click "Add Event" button',
          'Fill in required fields: Week Number, Event Name, Scheduled Date',
          'Add optional details: Duration, Description, Meeting Link',
          'Click "Create" to save the event'
        ],
        fields: [
          { name: 'Week Number', type: 'number', required: true, description: 'Sequential week number for the event (1, 2, 3, etc.)' },
          { name: 'Event Name', type: 'text', required: true, description: 'Title or name of the timeline event' },
          { name: 'Scheduled Date', type: 'date', required: true, description: 'Specific date when the event will occur' },
          { name: 'Duration (minutes)', type: 'number', required: false, description: 'Length of the event in minutes' },
          { name: 'Description', type: 'textarea', required: false, description: 'Detailed description of the event' },
          { name: 'Meeting Link', type: 'url', required: false, description: 'URL for virtual meetings (e.g., Google Meet, Zoom)' }
        ],
        url: '/admin/timeline'
      },
      {
        id: 'tm-step-3',
        title: 'Edit Timeline Events',
        description: 'Modify existing timeline events',
        icon: Pencil,
        steps: [
          'Click the edit (pencil) button on any event card',
          'Modify the event details as needed',
          'Update any fields: week number, name, date, duration, description, or meeting link',
          'Click "Update" to save changes'
        ],
        url: '/admin/timeline'
      }
    ]
  },
  {
    id: 'todo-management',
    title: 'To-Do List Management',
    description: 'Complete guide for managing to-do list items and team assignments',
    icon: CheckSquare,
    color: 'gray',
    items: [
      {
        id: 'todo-step-1',
        title: 'Access To-Do Management',
        description: 'Navigate to the to-do list management interface',
        icon: CheckSquare,
        steps: [
          'From admin dashboard, go to /admin/benefits',
          'Access the Manage To Do List Items page',
          'View the two main tabs: To Do List Items and User To Do List Management'
        ],
        url: '/admin/benefits'
      },
      {
        id: 'todo-step-2',
        title: 'Create To-Do List Items',
        description: 'Add new to-do items with calendar booking capabilities',
        icon: Plus,
        steps: [
          'Click "Add Benefit" button',
          'Enter To Do List Item Name (required)',
          'Add Notes (optional)',
          'Paste Calendar Booking Iframe code',
          'Click "Create" to save the item'
        ],
        fields: [
          { name: 'To Do List Item Name', type: 'text', required: true, description: 'Name or title of the to-do item' },
          { name: 'Notes', type: 'textarea', required: false, description: 'Additional details or instructions for the item' },
          { name: 'Calendar Booking Iframe', type: 'textarea', required: false, description: 'Complete iframe code for calendar booking widget (e.g., Leads Hub)' }
        ],
        url: '/admin/benefits'
      },
      {
        id: 'todo-step-3',
        title: 'Manage Team To-Do Lists',
        description: 'Assign and manage to-do items for different teams',
        icon: Users,
        steps: [
          'Switch to "User To Do List Management" tab',
          'Search for specific teams using the search bar',
          'View all teams and their to-do item status',
          'Toggle individual to-do items on/off for each team',
          'Use the switch to enable or disable items per team'
        ],
        url: '/admin/benefits'
      }
    ]
  },
  {
    id: 'prompts-management',
    title: 'Prompts Management',
    description: 'Complete guide for managing AI system prompts and dynamic templates',
    icon: MessageSquare,
    color: 'gray',
    items: [
      {
        id: 'pm-step-1',
        title: 'Access Prompts Management',
        description: 'Navigate to the prompts management interface',
        icon: MessageSquare,
        steps: [
          'From admin dashboard, go to /admin/prompt',
          'Access the Prompts Management page',
          'Note: Only Super Admin users can access this page',
          'View all system prompts and their current configurations'
        ],
        url: '/admin/prompt'
      },
      {
        id: 'pm-step-2',
        title: 'Edit System Prompts',
        description: 'Modify existing prompts used by system features',
        icon: Edit,
        steps: [
          'Click "Edit" button on any prompt card',
          'Modify the prompt description and text content',
          'Use dynamic fields for automatic data insertion',
          'Preview the final prompt with live updates',
          'Save changes (updates are live immediately)'
        ],
        fields: [
          { name: 'Prompt Key', type: 'text', required: true, description: 'Unique identifier for the prompt (read-only)' },
          { name: 'Description', type: 'text', required: true, description: 'Human-readable description of what the prompt does' },
          { name: 'Prompt Text', type: 'textarea', required: true, description: 'The actual AI prompt text with dynamic fields' }
        ],
        url: '/admin/prompt'
      },
      {
        id: 'pm-step-3',
        title: 'Use Dynamic Fields',
        description: 'Leverage special placeholders for automatic data insertion',
        icon: Settings,
        steps: [
          'Use {{companyContext}} for automatic company information',
          'Use {{responseFormat}} for structured response requirements',
          'Dynamic fields are replaced with real data when used',
          'Copy field codes using the copy button in the sidebar',
          'Preview how fields will look in the final prompt'
        ],
        url: '/admin/prompt'
      }
    ]
  }
];

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<string>('');
  const [activeItem, setActiveItem] = useState<string>('');
  const [videoPopup, setVideoPopup] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
  }>({
    isOpen: false,
    videoUrl: '',
    title: ''
  });


  const filteredSections = useMemo(() => {
    if (!searchTerm) return helpSections;
    
    return helpSections.map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(section => section.items.length > 0);
  }, [searchTerm]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToItem = (itemId: string) => {
    const element = document.getElementById(itemId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleSectionExpansion = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Keep all sections collapsed by default
  useEffect(() => {
    setExpandedSections(new Set());
  }, []);

  // Track scroll position to highlight active section and item
  useEffect(() => {
    const handleScroll = () => {
      const sections = helpSections.map(section => ({
        id: section.id,
        element: document.getElementById(section.id)
      }));
      
      const items = helpSections.flatMap(section => 
        section.items.map(item => ({
          id: item.id,
          element: document.getElementById(item.id)
        }))
      );

      // Find which section is currently in view
      let currentSection = '';
      let currentItem = '';

      // Check sections first
      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            currentSection = section.id;
            break;
          }
        }
      }

      // Check items
      for (const item of items) {
        if (item.element) {
          const rect = item.element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            currentItem = item.id;
            break;
          }
        }
      }

      setActiveSection(currentSection);
      setActiveItem(currentItem);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  const highlightSearchTerm = (text: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-blue-200 px-1 rounded">$1</mark>');
  };

  const openVideoPopup = (videoUrl: string, title: string) => {
    setVideoPopup({
      isOpen: true,
      videoUrl,
      title
    });
  };

  const closeVideoPopup = () => {
    setVideoPopup({
      isOpen: false,
      videoUrl: '',
      title: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <HelpCircle className="h-8 w-8 text-gray-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
            </div>
            <div className="flex items-center">
              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500" />
                <Input
                  type="text"
                  placeholder="Search navigation topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* Search Results Count */}
          {searchTerm && (
            <div className="pb-4">
              <p className="text-sm text-gray-600">
                Found {filteredSections.reduce((acc, section) => acc + section.items.length, 0)} navigation items
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8 max-w-[1400px] mx-auto">
          {/* Sidebar Navigation */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-20">
              <Card className="bg-white">
              
                <CardContent className="p-3">
                  <nav className="space-y-1">
                    {helpSections.map((section) => (
                      <div key={section.id}>
                                                <button
                          onClick={() => toggleSectionExpansion(section.id)}
                          className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center justify-between ${
                            activeSection === section.id 
                              ? 'text-blue-600 bg-blue-50 border-l-4 border-blue-600' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {section.title}
                          <span className="text-gray-400">
                            {expandedSections.has(section.id) ? '−' : '+'}
                          </span>
                        </button>
                        {/* Sub-items */}
                        {expandedSections.has(section.id) && (
                          <div className="ml-2 space-y-0">
                            {section.items.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => scrollToItem(item.id)}
                                className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors rounded ${
                                  activeItem === item.id 
                                    ? 'text-blue-600 bg-blue-50 font-medium' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span className={`font-bold ${activeItem === item.id ? 'text-blue-600' : 'text-blue-500'}`}>-  </span>
                                {item.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 max-w-6xl mx-auto">
            {/* Help Content */}
            <div className="space-y-20">
              {filteredSections.map((section) => (
                <div key={section.id} id={section.id} className="space-y-6">
                  {/* Section Header - Outside of Card */}
                  <div className="">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-3xl font-bold text-gray-900">{section.title}</h2>
                          {section.videoUrl && (
                            <button
                              onClick={() => openVideoPopup(section.videoUrl!, section.title)}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors bg-blue-500 rounded text-white"
                              title="Watch video"
                            >
                              <Video className="h-6 w-6 stroke-2" />
                            </button>
                          )}
                        </div>
                        <p className="text-base text-gray-600">{section.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section Items */}
                  <Card className="bg-white p-4 shadow-none">
                    <CardContent>
                    <div className="space-y-0">
                      {section.items.map((item) => (
                        <div key={item.id} id={item.id} className="">
                          <div className="flex items-start justify-between pt-10 border-b border-gray-200 pb-10">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                {item.icon && (
                                  <item.icon className="h-8 w-8 text-white mr-3 bg-blue-600 rounded-xl p-2" />
                                )}
                                <div className="flex items-center gap-3">
                                  <h3 className="text-2xl font-semibold text-gray-900">
                                    {item.title}
                                  </h3>
                                  {item.videoUrl && (
                                    <button
                                      onClick={() => openVideoPopup(item.videoUrl!, item.title)}
                                      className="p-1.5 bg-blue-500 rounded text-white hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors bg-blue-500 rounded text-white"
                                      title="Watch video"
                                    >
                                      <Video className="h-5 w-5 stroke-2" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-gray-600 mb-4" 
                                  dangerouslySetInnerHTML={{ 
                                    __html: highlightSearchTerm(item.description) 
                                  }} />
                              
                              {/* Steps */}
                              <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center">
                                  Steps to Follow
                                </h4>
                                <div className="space-y-3">
                                  {item.steps.map((step, index) => {
                                    const stepText = typeof step === 'string' ? step : step.text;
                                    const stepVideoUrl = typeof step === 'object' ? step.videoUrl : undefined;
                                    
                                    return (
                                      <div key={index} className="flex items-start">
                                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                                          <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <p className="text-sm text-gray-600 flex-1" 
                                              dangerouslySetInnerHTML={{ 
                                                __html: highlightSearchTerm(stepText) 
                                              }} />
                                          {stepVideoUrl && (
                                            <button
                                              onClick={() => openVideoPopup(stepVideoUrl, `Step ${index + 1}: ${stepText}`)}
                                              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex-shrink-0 bg-blue-500 rounded text-white"
                                              title="Watch video"
                                            >
                                              <Play className="h-4 w-4 stroke-2" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                                                              {/* Fields */}
                                {item.fields && (
                                  <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex  items-center">
                                      <FileText className="h-4 w-4 mr-2 text-blue-600" />
                                      Required Fields
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                      {item.fields.map((field, index) => (
                                        <div key={index} className="flex items-start">
                                          <div className="flex-shrink-0 w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2"></div>
                                          <div className="flex items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                              <span className="text-sm font-medium text-gray-900">
                                                {field.name}
                                              </span>
                                              <span className="text-sm text-gray-600 ml-1">
                                                - {field.description}
                                              </span>
                                            </div>
                                            {field.videoUrl && (
                                              <button
                                                onClick={() => openVideoPopup(field.videoUrl!, `${field.name} - ${field.description}`)}
                                                className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex-shrink-0 bg-blue-500 rounded text-white"
                                                title="Watch video"
                                              >
                                                <Play className="h-3 w-3 stroke-2" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                              {/* URL Link */}
                              {item.url && (
                                <div className="mt-4">
                                  <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 underline font-bold flex items-center"
                                  >
                                    Go to {item.title}
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

          
          </div>
        </div>
      </div>

      {/* Video Popup */}
      <VideoPopup
        isOpen={videoPopup.isOpen}
        onClose={closeVideoPopup}
        videoUrl={videoPopup.videoUrl}
        title={videoPopup.title}
      />
    </div>
  );
}
