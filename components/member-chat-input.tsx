"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatImage = {
  previewUrl: string;
  url: string | null;
  path: string | null;
  uploading: boolean;
  error: string | null;
};

interface MemberChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  chatImages: ChatImage[];
  onSendMessage: () => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  showGreeting?: boolean;
  placeholder?: string;
  maxImages?: number;
}

export function MemberChatInput({
  inputText,
  setInputText,
  isLoading,
  chatImages,
  onSendMessage,
  onImageChange,
  onRemoveImage,
  showGreeting = false,
  placeholder = "Type your message...",
  maxImages = 5,
}: MemberChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200); // Max height 200px
      textarea.style.height = `${newHeight}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() || chatImages.length > 0) {
        onSendMessage();
      }
    }
  };

  const canSend = !isLoading && (inputText.trim() || chatImages.length > 0);

  return (
    <div className="w-full">
      {/* Input Container */}
      <div
        className={cn(
          "relative bg-white rounded-2xl border-1 transition-all duration-200 !border-gray-200 border shadow-xl",
          isFocused
            ? "border-blue-500 ring-1 ring-blue-500/20"
            : "border-gray-200 hover:border-gray-300"
        )}
      >
        {/* Image Previews */}
        {chatImages.length > 0 && (
          <div className="flex items-center gap-2 px-3 md:px-4 pt-3 pb-2 flex-wrap border-b border-gray-100">
            {chatImages.map((img, idx) => (
              <div key={img.previewUrl} className="relative group">
                <img
                  src={img.previewUrl}
                  alt="Preview"
                  className="h-16 w-16 md:h-20 md:w-20 rounded-xl border-2 border-gray-200 object-cover"
                />
                {img.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(idx)}
                  disabled={isLoading}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-all shadow-lg opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
                {img.error && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs rounded-b-xl px-1 py-0.5 text-center truncate">
                    Error
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Textarea Container */}
        <div className="relative flex items-end gap-2 p-3 md:p-4">
          {/* Attach Button - Left */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={chatImages.length >= maxImages || isLoading}
            className={cn(
              "flex-shrink-0 p-2 rounded-xl transition-all",
              chatImages.length >= maxImages || isLoading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600 active:scale-95"
            )}
            title={
              chatImages.length >= maxImages
                ? `Maximum ${maxImages} images`
                : "Attach image"
            }
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className={cn(
              "flex-1 min-h-[40px] max-h-[200px] w-full resize-none bg-transparent border-0 focus:outline-none text-[15px] md:text-base text-gray-900 placeholder:text-gray-400",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "leading-relaxed py-2"
            )}
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#e5e7eb transparent",
            }}
          />

          {/* Send Button - Right */}
          <button
            type="button"
            onClick={onSendMessage}
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 p-2 rounded-xl transition-all flex items-center justify-center",
              canSend
                ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-sm"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
            title="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Character/Image Counter (optional) */}
        {(inputText.length > 0 || chatImages.length > 0) && (
          <div className="px-4 pb-2 flex items-center justify-between text-xs text-gray-400">
            <span>
              {chatImages.length > 0 && `${chatImages.length}/${maxImages} images`}
            </span>
            <span>{inputText.length > 500 && `${inputText.length} characters`}</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={onImageChange}
        multiple
        disabled={chatImages.length >= maxImages || isLoading}
      />
    </div>
  );
}

