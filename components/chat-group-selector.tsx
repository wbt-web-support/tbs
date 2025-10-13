"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, Settings, TrendingUp, MessageCircle, DollarSign, Users, Building2 } from 'lucide-react';

export type ChatGroup = 'general' | 'innovation' | 'operations' | 'growth' | 'financials' | 'competitors' | 'business-foundations';

interface ChatGroupSelectorProps {
  selectedGroup: ChatGroup;
  onGroupChange: (group: ChatGroup) => void;
  className?: string;
}

const groupConfig = {
  general: {
    label: 'General',
    icon: MessageCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    hoverColor: 'hover:bg-gray-100'
  },
  innovation: {
    label: 'Innovation',
    icon: Lightbulb,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:bg-purple-100'
  },
  operations: {
    label: 'Operations',
    icon: Settings,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:bg-blue-100'
  },
  growth: {
    label: 'Growth',
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    hoverColor: 'hover:bg-green-100'
  },
  financials: {
    label: 'Financials',
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    hoverColor: 'hover:bg-emerald-100'
  },
  competitors: {
    label: 'Competitors',
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    hoverColor: 'hover:bg-orange-100'
  },
  'business-foundations': {
    label: 'Business Foundations',
    icon: Building2,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    hoverColor: 'hover:bg-indigo-100'
  }
};

export function ChatGroupSelector({ 
  selectedGroup, 
  onGroupChange, 
  className = '' 
}: ChatGroupSelectorProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex gap-2">
        {Object.entries(groupConfig).map(([key, config]) => {
          const group = key as ChatGroup;
          const Icon = config.icon;
          const isSelected = selectedGroup === group;
          
          return (
            <Button
              key={group}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={`
                flex items-center gap-2 px-3 py-2
                ${isSelected 
                  ? `${config.bgColor} ${config.borderColor} border-2 text-gray-900` 
                  : `${config.hoverColor} text-gray-600 hover:text-gray-900`
                }
                transition-all duration-200
              `}
              onClick={() => onGroupChange(group)}
            >
              <Icon className={`h-4 w-4 ${isSelected ? config.color : 'text-gray-500'}`} />
              <span className="font-medium">{config.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
