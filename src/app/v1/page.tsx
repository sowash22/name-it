'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Moon, Sun, Mic, Heart, Copy, Sparkles, RotateCcw, Plus } from 'lucide-react';
import { analytics } from '@/lib/analytics';

interface SpeechRecognitionEvent extends Event {
  results: {
    item(index: number): {
      item(index: number): {
        transcript: string;
      };
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onstart: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: (event: Event) => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    SpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface PetName {
  id: string;
  name: string;
  meaning?: string;
  origin?: string;
  feedback: 'love' | 'like' | 'dislike' | null;
}

export default function Home() {
  // Minimal mode master switch
  const minimalMode = process.env.NEXT_PUBLIC_MINIMAL_MODE === 'true';
  // Show description field based on env
  const showDescription = process.env.NEXT_PUBLIC_DESCRIPTION === 'true';
  // Show toggles based on env
  const showToggles = process.env.NEXT_PUBLIC_TOGGLES !== 'false';
  // Allowed file types from env
  const allowedFileTypes = (process.env.NEXT_PUBLIC_FILE_TYPES || '').split(',').map(t => t.trim()).filter(Boolean);
  // Helper to determine upload label
  const showPhotosAndVideosLabel = allowedFileTypes.includes('image') && allowedFileTypes.includes('video');
  const [petDescription, setPetDescription] = useState('');
  const [petTypes, setPetTypes] = useState<string[]>([]);
  const [nameStyles, setNameStyles] = useState<string[]>([]);
  const [petCharacteristics, setPetCharacteristics] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [generatedNames, setGeneratedNames] = useState<PetName[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Speech recognition setup
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setIsListening(true);
        analytics.trackVoiceInput('start');
        // setToast({ message: 'Listening...', type: 'success' });
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = Array.from({ length: event.results.length }, (_, i) => 
          event.results.item(i).item(0).transcript
        ).join('');
        setPetDescription(results);
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        analytics.trackError('speech_recognition', event.error);
        setToast({ message: 'Error with speech recognition', type: 'error' });
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        analytics.trackVoiceInput('stop');
        setToast(null);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    } else {
      setToast({ message: 'Speech recognition not supported in this browser', type: 'error' });
    }
  };
  
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setToast(null);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    analytics.trackThemeToggle(newTheme);
  };

  // API call to generate names
  const generateNames = async () => {
    setIsGenerating(true);
    
    // Track form submission and preferences
    analytics.trackFormSubmission('pet_names', !!petDescription.trim(), uploadedImages.length > 0);
    analytics.trackNameGeneration(petTypes, nameStyles, petCharacteristics);
    
    try {
      const requestBody = {
        petDescription: petDescription.trim() || '',
        petTypes,
        nameStyles,
        petCharacteristics,
        uploadedImages,
        previosulyGeneratedNames: generatedNames.map((name) => {
          return name?.name || ''
        })
      };
      
      const response = await fetch('/api/generate-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate names');
      }
      
      const data = await response.json();
      
      // Convert API response to our local format
      const selectedNames = data.names.map((name: { 
        id?: string; 
        name: string; 
        meaning?: string; 
        origin?: string;
      }, index: number) => ({
        id: name.id || `name-${index}`,
        name: name.name,
        meaning: name.meaning || '',
        origin: name.origin || '',
        feedback: null
      }));
      
      setGeneratedNames(selectedNames);
      
      // Scroll to results after a short delay to ensure the content is rendered
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        // Track when results are shown
        analytics.trackPageInteraction('show_results', 'names_generated');
      }, 100);
      
    } catch (error) {
      console.error('Error generating names:', error);
      analytics.trackError('name_generation', 'api_failure');
      setToast({ message: 'Failed to generate names. Please try again.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const newImages: string[] = [];
    const maxImages = Math.min(files.length, 3);
    
    for (let i = 0; i < maxImages; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newImages.push(e.target.result as string);
          if (newImages.length === maxImages) {
            setUploadedImages(prev => [...prev, ...newImages].slice(0, 3));
            analytics.trackImageUpload(newImages.length);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const [activeTab] = useState<'all' | 'shortlist'>('all');
  
  const handleFeedback = (nameId: string, feedback: 'love' | 'like' | 'dislike') => {
    setGeneratedNames(prev => {
      const updated = prev.map(name => 
        name.id === nameId 
          ? { ...name, feedback: name.feedback === feedback ? null : feedback }
          : name
      );
      return updated;
    });

    // Track feedback
    const name = generatedNames.find(n => n.id === nameId);
    if (name) {
      analytics.trackNameFeedback(feedback, name.name);
    }

    // Manage shortlist
    if (feedback === 'love') {
      setGeneratedNames(prev => {
        const name = prev.find(n => n.id === nameId);
        if (name) {
          // Add to shortlist if not already there
          setShortlistedNames(current => {
            const exists = current.some(n => n.id === name.id);
            if (!exists) {
              analytics.trackShortlistAction('add', name.name);
              setToast({ 
                message: 'Added to favorites ❤️', 
                type: 'success' 
              });
              return [...current, { ...name, feedback: 'love' }];
            }
            return current;
          });
        }
        return prev;
      });
    } else {
      // Remove from shortlist if exists
      setShortlistedNames(current => {
        const nameToRemove = current.find(n => n.id === nameId);
        if (nameToRemove) {
          analytics.trackShortlistAction('remove', nameToRemove.name);
        }
        return current.filter(name => name.id !== nameId);
      });
    }
    
    setTimeout(() => setToast(null), 2000);
  };

  const copyName = (name: string) => {
    navigator.clipboard.writeText(name);
    analytics.trackNameCopy(name);
    setToast({ message: `"${name}" copied to clipboard!`, type: 'success' });
    setTimeout(() => setToast(null), 2000);
  };

  // State for shortlist modal
  const [showShortlistModal, setShowShortlistModal] = useState(false);
  const [shortlistedNames, setShortlistedNames] = useState<PetName[]>([]);

  // Load shortlisted names from localStorage on mount
  useEffect(() => {
    const savedNames = localStorage.getItem('shortlistedPetNames');
    if (savedNames) {
      try {
        const parsed = JSON.parse(savedNames);
        setShortlistedNames(parsed);
      } catch (error) {
        console.error('Error loading shortlisted names from localStorage:', error);
      }
    }
    
    // Track page load
    analytics.trackPageInteraction('page_load', 'v1');
  }, []);

  // Update localStorage when shortlist changes
  useEffect(() => {
    localStorage.setItem('shortlistedPetNames', JSON.stringify(shortlistedNames));
  }, [shortlistedNames]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-rose-50/30 via-orange-50/20 to-amber-50/40 dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950">
      {/* Floating orbs for visual appeal */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-pink-300/10 to-rose-300/10 dark:from-pink-500/5 dark:to-rose-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-gradient-to-r from-orange-300/10 to-amber-300/10 dark:from-orange-500/5 dark:to-amber-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-r from-yellow-300/10 to-orange-300/10 dark:from-yellow-500/5 dark:to-orange-500/5 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-2xl text-sm font-medium shadow-2xl backdrop-blur-md transition-all duration-500 border ${
          toast.type === 'success' 
            ? 'bg-emerald-500/90 text-white border-emerald-400/20 shadow-emerald-500/25' 
            : 'bg-red-500/90 text-white border-red-400/20 shadow-red-500/25'
        }`}>
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✨' : '⚠️'}</span>
            {toast.message}
          </div>
        </div>
      )}
      
      <div className="max-w-lg mx-auto px-6 py-12 relative z-10">
        {/* Theme and Shortlist Toggles */}
        <div className="absolute top-6 right-6 flex gap-3">
          <button
            onClick={() => {
              setShowShortlistModal(true);
              analytics.trackShortlistAction('view');
              analytics.trackPageInteraction('open_shortlist', 'modal');
              analytics.trackButtonClick('open_shortlist', 'header');
              analytics.trackButtonClick('open_shortlist', 'header');
              analytics.trackButtonClick('open_shortlist', 'header');
              analytics.trackButtonClick('open_shortlist', 'header');
            }}
            className="relative p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-rose-500 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 shadow-xl shadow-rose-500/10 hover:shadow-2xl hover:shadow-rose-500/20 transform hover:scale-110 border border-white/20 dark:border-slate-700/50"
            aria-label="Show shortlisted names"
          >
            <Heart className="w-5 h-5 fill-current" />
            {shortlistedNames.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                {shortlistedNames.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              toggleTheme();
              analytics.trackButtonClick('toggle_theme', 'header');
              analytics.trackButtonClick('toggle_theme', 'header');
              analytics.trackButtonClick('toggle_theme', 'header');
              analytics.trackButtonClick('toggle_theme', 'header');
            }}
            className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-amber-600 dark:text-amber-400 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 shadow-xl shadow-amber-500/10 hover:shadow-2xl hover:shadow-amber-500/20 transform hover:scale-110 border border-white/20 dark:border-slate-700/50"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Header: Always show */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-rose-400 via-pink-500 to-purple-600 rounded-3xl shadow-2xl shadow-pink-500/25 mb-8 transform rotate-6 hover:rotate-0 transition-transform duration-500">
            <span className="text-3xl transform -rotate-6">🐾</span>
          </div>
          <h1 className="text-5xl font-black bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 dark:from-rose-300 dark:via-pink-300 dark:to-purple-300 bg-clip-text text-transparent mb-4 leading-tight">
            Name My Pet
          </h1>
          <p className="text-lg text-slate-600/80 dark:text-slate-300/80 max-w-md mx-auto leading-relaxed font-medium">
            Discover the perfect name for your beloved companion ✨
          </p>
        </div>
        
        {/* Minimal Mode: Only show button */}
        {minimalMode ? (
          <button
            onClick={() => {
              analytics.trackButtonClick('generate_names', 'minimal_mode');
              analytics.trackPageInteraction('generate_names_minimal', 'minimal_mode');
              analytics.trackButtonClick('generate_names_minimal', 'minimal_mode');
              analytics.trackButtonClick('generate_names_minimal', 'minimal_mode');
              analytics.trackButtonClick('generate_names_minimal', 'minimal_mode');
              analytics.trackButtonClick('generate_names_minimal', 'minimal_mode');
              generateNames();
            }}
            disabled={isGenerating}
            className={`group w-full py-6 px-8 mt-6 rounded-3xl font-bold text-xl transition-all duration-500 transform hover:scale-105 ${
              isGenerating
                ? 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-400 dark:text-slate-500 cursor-not-allowed backdrop-blur-md'
                : 'bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white shadow-2xl shadow-pink-500/30 hover:shadow-3xl hover:shadow-pink-500/40 backdrop-blur-md border border-white/20'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Finding perfect names...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-3 group-hover:gap-4 transition-all duration-300">
                <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
                Name My Pet
                <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
              </span>
            )}
          </button>
        ) : (
          <>
            {/* Describe your pet field */}
            {showDescription && (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Tell us about your friend
                  </label>
                  <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 text-amber-700 dark:text-amber-300 rounded-full shadow-sm">
                    Optional
                  </span>
                </div>
                <div className="relative group">
                  <textarea
                    value={petDescription}
                    onChange={(e) => {
                      setPetDescription(e.target.value);
                      // Track when user starts typing (debounced)
                      if (e.target.value.length === 1) {
                        analytics.trackPageInteraction('start_typing', 'description');
                      }
                    }}
                    onFocus={() => analytics.trackPageInteraction('focus_field', 'description')}
                    placeholder="Tell us about their personality, favorite activities, or what makes them special... 🐕"
                    className="w-full px-6 py-6 pb-16 border-0 rounded-3xl focus:ring-4 focus:ring-pink-500/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 resize-none min-h-[140px] text-base leading-relaxed transition-all duration-300 shadow-xl shadow-pink-500/5 hover:shadow-2xl hover:shadow-pink-500/10 group-focus-within:shadow-2xl group-focus-within:shadow-pink-500/15 border border-white/20 dark:border-slate-700/50"
                    rows={4}
                  />
                  <button
                    onClick={() => {
                      if (isListening) {
                        analytics.trackButtonClick('stop_voice', 'description');
                        analytics.trackPageInteraction('stop_voice', 'description');
                        stopListening();
                      } else {
                        analytics.trackButtonClick('start_voice', 'description');
                        analytics.trackPageInteraction('start_voice', 'description');
                        startListening();
                      }
                    }}
                    className={`absolute right-4 bottom-4 p-3 rounded-2xl transition-all duration-300 shadow-lg transform hover:scale-110 ${
                      isListening
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/30 animate-pulse'
                        : 'bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 text-slate-600 dark:text-slate-300 hover:from-pink-200 hover:to-rose-200 dark:hover:from-pink-800 dark:hover:to-rose-800'
                    }`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  {isListening && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-4 py-2 text-sm font-bold bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300 rounded-2xl border border-purple-200 dark:border-purple-800/50 shadow-xl backdrop-blur-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span>Listening...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* All Toggles Section */}
            {showToggles && (
              <div className="space-y-8 mb-10">
                {/* Pet Types */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      What kind of pet? 🐾
                    </label>
                    <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 text-amber-700 dark:text-amber-300 rounded-full shadow-sm">
                      Optional
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(process.env.NEXT_PUBLIC_PET_TYPES || 'dog:🐕,cat:🐱,other:🐾').split(',').map((item) => {
                      const [type, icon] = item.split(':');
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            if (petTypes.includes(type)) {
                              setPetTypes(petTypes.filter(t => t !== type));
                              analytics.trackButtonClick('remove_pet_type', type);
                              analytics.trackPageInteraction('remove_pet_type', type);
                            } else {
                              setPetTypes([...petTypes, type]);
                              analytics.trackButtonClick('add_pet_type', type);
                              analytics.trackPageInteraction('add_pet_type', type);
                            }
                          }}
                          className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg border ${
                            petTypes.includes(type)
                              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-500/30 border-pink-400/20'
                              : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-pink-900/20 shadow-slate-500/10 border-white/20 dark:border-slate-700/50'
                          }`}
                        >
                          <span className="text-lg mr-2">{icon}</span>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pet Characteristics */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Pet characteristics? 🎨
                    </label>
                    <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 text-amber-700 dark:text-amber-300 rounded-full shadow-sm">
                      Optional
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(process.env.NEXT_PUBLIC_PET_CHARACTERISTICS || 'white:⚪,brown:🟤,small:🔹,big:🔶').split(',').map((item) => {
                      const [characteristic, icon] = item.split(':');
                      return (
                        <button
                          key={characteristic}
                          onClick={() => {
                            if (petCharacteristics.includes(characteristic)) {
                              setPetCharacteristics(petCharacteristics.filter(c => c !== characteristic));
                              analytics.trackButtonClick('remove_characteristic', characteristic);
                              analytics.trackPageInteraction('remove_characteristic', characteristic);
                            } else {
                              setPetCharacteristics([...petCharacteristics, characteristic]);
                              analytics.trackButtonClick('add_characteristic', characteristic);
                              analytics.trackPageInteraction('add_characteristic', characteristic);
                            }
                          }}
                          className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg border ${
                            petCharacteristics.includes(characteristic)
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/30 border-purple-400/20'
                              : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-slate-500/10 border-white/20 dark:border-slate-700/50'
                          }`}
                        >
                          <span className="text-lg mr-2">{icon}</span>
                          {characteristic.charAt(0).toUpperCase() + characteristic.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Name Styles */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Name style? ✨
                    </label>
                    <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 text-amber-700 dark:text-amber-300 rounded-full shadow-sm">
                      Optional
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(process.env.NEXT_PUBLIC_NAME_STYLES || 'english:🇬🇧,unique:🌟').split(',').map((item) => {
                      const [style, icon] = item.split(':');
                      return (
                        <button
                          key={style}
                          onClick={() => {
                            if (nameStyles.includes(style)) {
                              setNameStyles(nameStyles.filter(s => s !== style));
                              analytics.trackButtonClick('remove_name_style', style);
                              analytics.trackPageInteraction('remove_name_style', style);
                            } else {
                              setNameStyles([...nameStyles, style]);
                              analytics.trackButtonClick('add_name_style', style);
                              analytics.trackPageInteraction('add_name_style', style);
                            }
                          }}
                          className={`px-6 py-2 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg border ${
                            nameStyles.includes(style)
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30 border-amber-400/20'
                              : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 shadow-slate-500/10 border-white/20 dark:border-slate-700/50'
                          }`}
                        >
                          <span className="text-lg mr-2">{icon}</span>
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Image Upload */}
            {process.env.NEXT_PUBLIC_FILE_UPLOAD === 'true' && (
              <div className='mb-10'>
                <input
                  type="file"
                  accept={allowedFileTypes.length > 0 ? allowedFileTypes.map(t => `${t}/*`).join(',') : 'image/*'}
                  multiple
                  onChange={handleImageUpload}
                  onClick={() => {
                    analytics.trackPageInteraction('click_file_input', 'images');
                    analytics.trackButtonClick('select_files', 'form');
                  }}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  onClick={() => {
                    analytics.trackPageInteraction('click_upload_area', 'images');
                    analytics.trackButtonClick('upload_images', 'form');
                  }}
                  className="group block w-full py-8 px-6 border-2 border-dashed border-pink-300/50 dark:border-pink-700/50 rounded-3xl text-center text-base text-slate-600 dark:text-slate-400 hover:border-pink-400 dark:hover:border-pink-500 hover:text-pink-600 dark:hover:text-pink-400 cursor-pointer transition-all duration-300 hover:bg-pink-50/50 dark:hover:bg-pink-900/10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md shadow-xl shadow-pink-500/5 hover:shadow-2xl hover:shadow-pink-500/10 transform hover:scale-105 border-white/20 dark:border-slate-700/50"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-pink-400 to-rose-500 text-white flex items-center justify-center text-2xl group-hover:animate-bounce">
                      📷
                    </div>
                    <div className="font-bold">
                      {uploadedImages.length > 0
                        ? `${uploadedImages.length} ${showPhotosAndVideosLabel ? 'file' : 'photo'}${uploadedImages.length > 1 ? 's' : ''} selected`
                        : showPhotosAndVideosLabel
                          ? 'Add photos and videos of your pet'
                          : 'Add photos of your pet'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Help us see their personality! ✨
                    </div>
                  </div>
                </label>
                
                {/* Display uploaded images */}
                {uploadedImages.length > 0 && (
                  <div className="flex gap-4 mt-6 justify-center">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-pink-500/20 border-4 border-white/50 dark:border-slate-700/50">
                          <Image
                            src={image}
                            alt={`Pet photo ${index + 1}`}
                            width={80}
                            height={80}
                            className="object-cover w-20 h-20"
                          />
                        </div>
                        <button
                          onClick={() => {
                            analytics.trackButtonClick('remove_image', 'upload');
                            removeImage(index);
                          }}
                          className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl hover:scale-110 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Generate Button */}
            <button
              onClick={() => {
                analytics.trackButtonClick('generate_names', 'full_mode');
                analytics.trackPageInteraction('generate_names_full', 'full_mode');
                analytics.trackButtonClick('generate_names_full', 'full_mode');
                analytics.trackButtonClick('generate_names_full', 'full_mode');
                analytics.trackButtonClick('generate_names_full', 'full_mode');
                analytics.trackButtonClick('generate_names_full', 'full_mode');
                generateNames();
              }}
              disabled={isGenerating}
              className={`group w-full py-6 px-8 rounded-3xl font-bold text-xl transition-all duration-500 transform hover:scale-105 ${
                isGenerating
                  ? 'bg-gradient-to-r from-purple-600 via-purple-700 to-purple-900 text-white shadow-2xl shadow-pink-500/30 hover:shadow-3xl hover:shadow-pink-500/40 backdrop-blur-md border border-white/20'
                  : 'bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white shadow-2xl shadow-pink-500/30 hover:shadow-3xl hover:shadow-pink-500/40 backdrop-blur-md border border-white/20'
              }`}
            >
              {/* Option 1: Wagging tail */}
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl animate-bounce">🐕</span>
                  <span className="text-white/90">Sniffing out purrfect names...</span>
                  {/* <span className="text-xl animate-pulse">💕</span> */}
                </div>
              ) : (
                <span className="flex items-center justify-center gap-3 group-hover:gap-4 transition-all duration-300">
                  {/* <Sparkles className="w-6 h-6 group-hover:animate-pulse" /> */}
                  Let&apos;s Find Purrfect Names!
                  <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
                </span>
              )}
            </button>
            
            {/* Results */}
            {generatedNames.length > 0 && (
              <div ref={resultsRef} className="space-y-10 mt-16">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-3xl shadow-2xl shadow-emerald-500/25 mb-4 animate-bounce">
                    <span className="text-2xl">🎉</span>
                  </div>
                  <h2 className="text-4xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-300 dark:via-teal-300 dark:to-cyan-300 bg-clip-text text-transparent mb-4">
                    Perfect Names Found!
                  </h2>
                  <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">
                    Here are {process.env.NEXT_PUBLIC_TOP_NAMES || 5} lovely names for your friend ✨
                  </p>
                </div>
                
                <div className="space-y-6">
                  {Array.isArray(generatedNames) && generatedNames
                    .filter(name => activeTab === 'all' || name.feedback === 'love')
                    .map((petName) => {
                    if (!petName || typeof petName.name !== 'string') return null;
                    
                    return (
                      <div
                        key={petName.id}
                        className="group bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/30 dark:border-slate-700/50 hover:shadow-3xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105"
                      >
                        {/* Name and Quick Actions */}
                        <div className="mb-6">
                          {/* Name at the top */}
                          <h3 className="text-4xl font-black bg-gradient-to-r from-slate-900 via-indigo-700 to-purple-700 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent mb-4 leading-tight">
                            {petName.name}
                          </h3>
                          
                          {/* Origin and buttons on same line */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              {petName?.origin && (
                                <div className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-bold bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/30 shadow-lg">
                                  <span className="mr-2 text-base">🌍</span> {petName?.origin}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  analytics.trackButtonClick('copy_name', 'results');
                                  analytics.trackPageInteraction('copy_name_results', 'results');
                                  analytics.trackButtonClick('copy_name_results', 'results');
                                  analytics.trackButtonClick('copy_name_results', 'results');
                                  analytics.trackButtonClick('copy_name_results', 'results');
                                  analytics.trackButtonClick('copy_name_results', 'results');
                                  copyName(petName.name);
                                }}
                                className="group/btn inline-flex items-center px-4 py-2 text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110"
                              >
                                <Copy className="w-4 h-4 mr-2 group-hover/btn:animate-pulse" />
                                Copy
                              </button>
                              <button
                                onClick={() => {
                                  analytics.trackButtonClick('shortlist_name', 'results');
                                  analytics.trackPageInteraction('shortlist_name_results', 'results');
                                  analytics.trackButtonClick('shortlist_name_results', 'results');
                                  analytics.trackButtonClick('shortlist_name_results', 'results');
                                  analytics.trackButtonClick('shortlist_name_results', 'results');
                                  analytics.trackButtonClick('shortlist_name_results', 'results');
                                  handleFeedback(petName.id, 'love');
                                }}
                                className={`group/btn inline-flex items-center px-4 py-2 text-sm font-bold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 ${
                                  petName.feedback === 'love'
                                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-500/30'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-pink-500/30 hover:text-pink-600 dark:hover:text-pink-400'
                                }`}
                              >
                                <Heart className={`w-4 h-4 mr-2 group-hover/btn:animate-pulse ${petName.feedback === 'love' ? 'fill-current' : ''}`} />
                                {petName.feedback === 'love' ? 'Added' : 'Shortlist'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Name Meaning */}
                        {petName.meaning && (
                          <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/80 via-purple-50/80 to-pink-50/80 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-pink-900/30 rounded-3xl border border-indigo-100/50 dark:border-indigo-700/30 shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-500 text-white flex items-center justify-center text-lg">
                                ✨
                              </div>
                              <span className="text-lg font-bold text-indigo-900 dark:text-indigo-200">
                                Name Meaning
                              </span>
                            </div>
                            <p className="text-indigo-800 dark:text-indigo-200 leading-relaxed text-lg font-medium italic pl-11">
                              {petName.meaning}
                            </p>
                          </div>
                        )}

                        {/* Feedback Buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              analytics.trackButtonClick('like_name', 'results');
                              analytics.trackPageInteraction('like_name_results', 'results');
                              analytics.trackButtonClick('like_name_results', 'results');
                              analytics.trackButtonClick('like_name_results', 'results');
                              analytics.trackButtonClick('like_name_results', 'results');
                              analytics.trackButtonClick('like_name_results', 'results');
                              handleFeedback(petName.id, 'like');
                            }}
                            className={`flex-1 py-1 px-1 rounded-xl text-base font-bold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                              petName.feedback === 'like'
                                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/30'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-200 dark:hover:border-emerald-700'
                            }`}
                          >
                            <span className="text-lg mr-2">👍</span> I Like This
                          </button>
                          <button
                            onClick={() => {
                              analytics.trackButtonClick('dislike_name', 'results');
                              analytics.trackPageInteraction('dislike_name_results', 'results');
                              analytics.trackButtonClick('dislike_name_results', 'results');
                              analytics.trackButtonClick('dislike_name_results', 'results');
                              analytics.trackButtonClick('dislike_name_results', 'results');
                              analytics.trackButtonClick('dislike_name_results', 'results');
                              handleFeedback(petName.id, 'dislike');
                            }}
                            className={`flex-1 py-1 px-1 rounded-xl text-base font-bold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                              petName.feedback === 'dislike'
                                ? 'bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow-slate-500/30'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-100 border-2 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                            }`}
                          >
                            <span className="text-lg mr-2">👎</span> Not for Me
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="text-center pt-12 flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => {
                      setGeneratedNames([]);
                      setPetDescription('');
                      setPetTypes([]);
                      setNameStyles([]);
                      setPetCharacteristics([]);
                      setUploadedImages([]);
                      analytics.trackButtonClick('restart', 'results');
                      analytics.trackPageInteraction('restart_form', 'results');
                      analytics.trackButtonClick('restart_form', 'results');
                      analytics.trackButtonClick('restart_form', 'results');
                      analytics.trackButtonClick('restart_form', 'results');
                      analytics.trackButtonClick('restart_form', 'results');
                    }}
                    className="group px-8 py-4 bg-gradient-to-r from-slate-500 to-gray-500 text-white rounded-2xl transition-all duration-500 transform hover:scale-105 font-bold shadow-2xl shadow-slate-500/30 hover:shadow-3xl hover:shadow-slate-500/40 border border-white/20"
                  >
                    <span className="flex items-center justify-center gap-3 group-hover:gap-4 transition-all duration-300">
                      <RotateCcw className="w-5 h-5 group-hover:animate-spin" />
                      Restart
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      analytics.trackButtonClick('show_more_names', 'results');
                      analytics.trackPageInteraction('request_more_names', 'results');
                      analytics.trackButtonClick('request_more_names', 'results');
                      analytics.trackButtonClick('request_more_names', 'results');
                      analytics.trackButtonClick('request_more_names', 'results');
                      analytics.trackButtonClick('request_more_names', 'results');
                      generateNames();
                    }}
                    disabled={isGenerating}
                    className={`group px-8 py-4 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 ${
                      isGenerating
                        ? 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white shadow-2xl shadow-pink-500/30 hover:shadow-3xl hover:shadow-pink-500/40 border border-white/20'
                    }`}
                  >
                    {isGenerating ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Finding More...</span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-3 group-hover:gap-4 transition-all duration-300">
                        <Plus className="w-5 h-5 group-hover:animate-pulse" />
                        Show More!
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Shortlist Modal */}
      {showShortlistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl p-8 w-full max-w-2xl mx-4 shadow-3xl border border-white/30 dark:border-slate-700/50 transform animate-in">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className=" text-white flex items-center justify-center text-2xl">
                  ❤️
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                  Your shortlisted Names
                </h2>
              </div>
              <button
                onClick={() => {
                  analytics.trackButtonClick('close_shortlist', 'modal');
                  analytics.trackPageInteraction('close_shortlist', 'modal');
                  analytics.trackButtonClick('close_shortlist', 'modal');
                  analytics.trackButtonClick('close_shortlist', 'modal');
                  analytics.trackButtonClick('close_shortlist', 'modal');
                  analytics.trackButtonClick('close_shortlist', 'modal');
                  setShowShortlistModal(false);
                }}
                className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all duration-300 transform hover:scale-110"
              >
                <span className="text-3xl text-slate-400 dark:text-slate-500">×</span>
              </button>
            </div>
            
            {shortlistedNames.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-r from-gray-200 to-slate-300 dark:from-gray-700 dark:to-slate-600 text-gray-400 dark:text-gray-500 flex items-center justify-center text-4xl mb-6 mx-auto">
                  💔
                </div>
                <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-4">
                  No favorites yet!
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Click the ❤️ button on any name to add it to your favorites collection.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                {shortlistedNames.map((name) => (
                  <div
                    key={name.id}
                    className="group bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-3xl p-6 shadow-lg border border-pink-100 dark:border-pink-800/30 hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                          {name.name}
                        </h3>
                        {name.origin && (
                          <span className="inline-flex items-center px-3 py-1 rounded-2xl text-xs font-bold bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/30">
                            <span className="mr-1">🌍</span> {name.origin}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            analytics.trackButtonClick('copy_name', 'shortlist');
                            analytics.trackPageInteraction('copy_name_shortlist', 'modal');
                            analytics.trackButtonClick('copy_name_shortlist', 'modal');
                            analytics.trackButtonClick('copy_name_shortlist', 'modal');
                            analytics.trackButtonClick('copy_name_shortlist', 'modal');
                            analytics.trackButtonClick('copy_name_shortlist', 'modal');
                            copyName(name.name);
                          }}
                          className="px-4 py-2 text-sm font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 group-hover:animate-pulse"
                        >
                          <Copy className="w-4 h-4 mr-2 inline" />
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            analytics.trackButtonClick('remove_from_shortlist', 'shortlist');
                            analytics.trackPageInteraction('remove_name_shortlist', 'modal');
                            analytics.trackButtonClick('remove_name_shortlist', 'modal');
                            analytics.trackButtonClick('remove_name_shortlist', 'modal');
                            analytics.trackButtonClick('remove_name_shortlist', 'modal');
                            analytics.trackButtonClick('remove_name_shortlist', 'modal');
                            handleFeedback(name.id, 'dislike');
                          }}
                          className="px-4 py-2 text-sm font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110"
                        >
                          <span className="mr-2">🗑️</span>
                          Remove
                        </button>
                      </div>
                    </div>
                    {name.meaning && (
                      <div className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-white/50 dark:border-slate-700/50">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium italic">
                          {name.meaning}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}