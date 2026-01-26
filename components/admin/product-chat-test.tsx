"use client";

import { useState, useRef, useEffect } from "react";
import { useProductChat, Message } from "@/hooks/use-product-chat";
import { 
  Send, 
  RefreshCw, 
  MessageSquare, 
  Loader2, 
  User, 
  Bot, 
  ExternalLink,
  ChevronDown,
  Settings2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductChatTest() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, reset, loading, error, sessionId } = useProductChat();
  const [temperature, setTemperature] = useState(0.7);
  const [model, setModel] = useState("gpt-4o-mini");
  const [k, setK] = useState(4);
  const [category, setCategory] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const currentInput = input;
    setInput("");
    
    try {
      const options: any = {
        temperature,
        chat_model: model,
        k
      };

      if (category !== "all") {
        options.filters = { category };
      }

      await sendMessage(currentInput, options);
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border rounded-xl overflow-hidden bg-background shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Product Chatbot Tester</h3>
            <p className="text-[10px] text-muted-foreground">Test API integration and responses</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-4 space-y-4">
              <DropdownMenuLabel>Chat Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Temperature: {temperature}</Label>
                </div>
                <Slider 
                  value={[temperature]} 
                  min={0} 
                  max={2} 
                  step={0.1} 
                  onValueChange={(vals) => setTemperature(vals[0])} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Category Filter</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="boiler">Boilers</SelectItem>
                    <SelectItem value="ac">Air Conditioning</SelectItem>
                    <SelectItem value="ashp">Heat Pumps (ASHP)</SelectItem>
                    <SelectItem value="battery_storage">Battery Storage</SelectItem>
                    <SelectItem value="solar">Solar PV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                    <SelectItem value="gpt-4">GPT-4 (Powerful)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Context Count (k): {k}</Label>
                </div>
                <Slider 
                  value={[k]} 
                  min={1} 
                  max={20} 
                  step={1} 
                  onValueChange={(vals) => setK(vals[0])} 
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={reset}
            title="Reset Chat"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 opacity-50">
              <Bot className="w-10 h-10" />
              <p className="text-sm font-medium">No messages yet. Ask me about your products!</p>
              <p className="text-xs">
                {category === 'all' 
                  ? 'Try: "What boilers do we have?" or "Show me solar panels"' 
                  : `Currently searching only in: ${category.replace('_', ' ')}`}
              </p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`mt-1 p-1.5 rounded-lg shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-muted/50 border rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.sources.map((source, sIdx) => (
                      <Badge key={sIdx} variant="outline" className="text-[10px] bg-background/50 py-0 px-2 flex items-center gap-1">
                        {source.title}
                        <ExternalLink className="w-2 h-2" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 rounded-lg bg-muted shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl rounded-tl-none bg-muted/50 border text-sm flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                AI is thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/10">
        <div className="relative">
          <Input
            placeholder="Ask about products..."
            className="pr-12 h-11 bg-background"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <Button 
            size="icon" 
            className="absolute right-1 top-1 h-9 w-9"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between">
           <div className="flex gap-2">
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
              {sessionId ? `Session: ${sessionId.substring(0, 8)}...` : 'New Conversation'}
            </p>
            {category !== "all" && (
              <Badge variant="secondary" className="text-[8px] h-3 px-1 bg-purple-100 text-purple-700 border-none uppercase">
                Filter: {category.replace('_', ' ')}
              </Badge>
            )}
          </div>
          {error && <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider">API Error</p>}
        </div>
      </div>
    </div>
  );
}
