"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Settings,
  ChevronDown,
  RefreshCw,
  Unplug,
  Link,
  CheckCircle,
} from 'lucide-react';

interface ConnectionPopupProps {
  isConnected: boolean;
  connectedProperty?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onChangeProperty: () => void;
  onRefresh: () => void;
}

export default function ConnectionPopup({ 
  isConnected, 
  connectedProperty, 
  onConnect, 
  onDisconnect, 
  onChangeProperty, 
  onRefresh 
}: ConnectionPopupProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isConnected ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              Connected
            </>
          ) : (
            <>
              <Settings className="h-4 w-4" />
              Connect
            </>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          {isConnected ? (
            <>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Google Analytics Connected</h4>
                {connectedProperty && (
                  <p className="text-xs text-gray-600">
                    Property: {connectedProperty}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Button
                  onClick={onRefresh}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Data
                </Button>
                
                <Button
                  onClick={onChangeProperty}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Change Property
                </Button>
                
                <Button
                  onClick={onDisconnect}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Unplug className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Connect Google Analytics</h4>
                <p className="text-xs text-gray-600 mb-4">
                  Connect your Google Analytics account to view your website data.
                </p>
              </div>
              
              <Button
                onClick={onConnect}
                className="w-full gap-2"
                size="sm"
              >
                <Link className="h-4 w-4" />
                Connect Account
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
} 