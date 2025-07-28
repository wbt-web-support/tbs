"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface CustomCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export default function CustomCheckbox({ 
  checked, 
  onCheckedChange, 
  className = "", 
  disabled = false 
}: CustomCheckboxProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    if (!disabled) {
      onCheckedChange(!checked);
    }
  };

  const handleMouseDown = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`
        relative inline-flex h-4 w-4 items-center justify-center rounded border-2 transition-all duration-200
        ${checked 
          ? 'border-blue-600 bg-blue-600 text-white' 
          : 'border-gray-300 bg-white text-transparent'
        }
        ${disabled 
          ? 'cursor-not-allowed opacity-50' 
          : 'cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        }
        ${isPressed && !disabled ? 'scale-95' : ''}
        ${className}
      `}
    >
      {checked && (
        <Check className="h-3 w-3" />
      )}
    </button>
  );
} 