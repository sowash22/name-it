'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Moon, Sun, Mic } from 'lucide-react';
import { redirect } from 'next/navigation';

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

  // todo fix it when ready
  return redirect(process.env.NEXT_PUBLIC_PAGE_REDIRECT || '/v1');
  
  // Speech recognition setup
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setIsListening(true);
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
        setToast({ message: 'Error with speech recognition', type: 'error' });
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
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
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // API call to generate names
  const generateNames = async () => {
    setIsGenerating(true);
    
    try {
      const requestBody = {
        petDescription: petDescription.trim() || '',
        petTypes,
        nameStyles,
        petCharacteristics,
        uploadedImages
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
      }, 100);
      
    } catch (error) {
      console.error('Error generating names:', error);
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

    // Manage shortlist
    if (feedback === 'love') {
      setGeneratedNames(prev => {
        const name = prev.find(n => n.id === nameId);
        if (name) {
          // Add to shortlist if not already there
          setShortlistedNames(current => {
            const exists = current.some(n => n.id === name.id);
            if (!exists) {
              setToast({ 
                message: 'Shortlisted ❤️', 
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
      setShortlistedNames(current => 
        current.filter(name => name.id !== nameId)
      );
    }
    
    setTimeout(() => setToast(null), 2000);
  };

  const copyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setToast({ message: `"${name}" copied!`, type: 'success' });
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
  }, []);

  // Update localStorage when shortlist changes
  useEffect(() => {
    localStorage.setItem('shortlistedPetNames', JSON.stringify(shortlistedNames));
  }, [shortlistedNames]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full text-sm font-medium shadow-xl backdrop-blur-sm transition-all duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-500 text-white ring-4 ring-emerald-200/50' 
            : 'bg-red-500 text-white ring-4 ring-red-200/50'
        }`}>
          {toast.message}
        </div>
      )}
      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Theme and Shortlist Toggles */}
        <div className="absolute top-6 right-6 flex gap-3">
          <button
            onClick={() => setShowShortlistModal(true)}
            className="p-3 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            aria-label="Show shortlisted names"
          >
            <span className="text-lg">❤️</span>
            {shortlistedNames.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {shortlistedNames.length}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'light' ? (
              <Moon className="w-6 h-6" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
          </button>
        </div>
        
        {/* Header: Always show */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-6">
            <span className="text-2xl">🐾</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-700 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent mb-4">
            Name My Pet
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
            Let&apos;s find the perfect name for your beloved companion
          </p>
        </div>
        {/* Minimal Mode: Only show button */}
        {minimalMode ? (
          <button
            onClick={generateNames}
            disabled={isGenerating}
            className={`w-full py-5 px-6 mt-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
              isGenerating
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/30'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Finding perfect names...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ✨ Name My Pet
              </span>
            )}
          </button>
        ) : (
          <>
            {/* Describe your pet field */}
            {showDescription && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Tell Us About Your Companion
                  </label>
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={petDescription}
                    onChange={(e) => setPetDescription(e.target.value)}
                    placeholder="Describe their personality, appearance, or what makes them special..."
                    className="w-full px-4 py-4 pb-12 border-2 outline-none border-slate-200 dark:border-slate-600 rounded-2xl focus:border-indigo-500 dark:focus:border-indigo-400 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-vertical min-h-[120px] text-base leading-relaxed transition-all duration-200 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20"
                    rows={3}
                  />
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all duration-200 ${
                      isListening
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500'
                    }`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    <Mic size={14} />
                  </button>
                  {isListening && (
                    <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-3 py-1 text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full border border-purple-200 dark:border-purple-800/30">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                      <span>Listening...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* All Toggles Section */}
            {showToggles && (
              <div>
                {/* <div className="flex items-center gap-2 mb-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Tell Us A Bit More
                  </label>
                </div> */}
                <div className="space-y-6">
                  {/* Pet Types */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Pet Type
                      </label>
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                        Optional
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(process.env.NEXT_PUBLIC_PET_TYPES || 'dog:🐕,cat:🐱,other:🐾').split(',').map((item) => {
                        const [type, icon] = item.split(':');
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              if (petTypes.includes(type)) {
                                setPetTypes(petTypes.filter(t => t !== type));
                              } else {
                                setPetTypes([...petTypes, type]);
                              }
                            }}
                            className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                              petTypes.includes(type)
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {icon} {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Pet Characteristics
                      </label>
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                        Optional
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(process.env.NEXT_PUBLIC_GENDERS || 'male:�,female:�,neutral:🌈').split(',').map((item) => {
                        const [characteristic, icon] = item.split(':');
                        return (
                          <button
                            key={characteristic}
                            onClick={() => {
                              if (petCharacteristics.includes(characteristic)) {
                                setPetCharacteristics(petCharacteristics.filter(c => c !== characteristic));
                              } else {
                                setPetCharacteristics([...petCharacteristics, characteristic]);
                              }
                            }}
                            className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                              petCharacteristics.includes(characteristic)
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {icon} {characteristic.charAt(0).toUpperCase() + characteristic.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Name Styles */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Name Style
                      </label>
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                        Optional
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(process.env.NEXT_PUBLIC_NAME_STYLES || 'english:🇬🇧,unique:🌟').split(',').map((item) => {
                        const [style, icon] = item.split(':');
                        return (
                          <button
                            key={style}
                            onClick={() => {
                              if (nameStyles.includes(style)) {
                                setNameStyles(nameStyles.filter(s => s !== style));
                              } else {
                                setNameStyles([...nameStyles, style]);
                              }
                            }}
                            className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                              nameStyles.includes(style)
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {icon} {style.charAt(0).toUpperCase() + style.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                </div>
              </div>
            )}
            {/* Image Upload */}
            {process.env.NEXT_PUBLIC_FILE_UPLOAD === 'true' && (
              <div className='mt-8'>
                <input
                  type="file"
                  accept={allowedFileTypes.length > 0 ? allowedFileTypes.map(t => `${t}/*`).join(',') : 'image/*'}
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="block w-full py-4 px-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl text-center text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  {uploadedImages.length > 0
                    ? `${uploadedImages.length} ${showPhotosAndVideosLabel ? 'file' : 'photo'}${uploadedImages.length > 1 ? 's' : ''} selected`
                    : showPhotosAndVideosLabel
                      ? '📷 Click to add photos and videos'
                      : '📷 Click to add photos'}
                </label>
                {/* Display uploaded images */}
                {uploadedImages.length > 0 && (
                  <div className="flex gap-4 mt-4">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={image}
                          alt={`Pet photo ${index + 1}`}
                          width={80}
                          height={80}
                          className="rounded-2xl object-cover w-20 h-20 shadow-lg ring-2 ring-white dark:ring-slate-700"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:bg-red-600 transform hover:scale-110"
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
              onClick={generateNames}
              disabled={isGenerating}
              className={`w-full py-5 px-6 mt-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                isGenerating
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/30'
              }`}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Finding perfect names...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Let&apos;s Name My Pet
                </span>
              )}
            </button>
            {/* Results */}
            {generatedNames.length > 0 && (
              <div ref={resultsRef} className="space-y-8 mt-12">
                <div className="text-center space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      Here are your perfect names! 🎉
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      Showing top {process.env.NEXT_PUBLIC_TOP_NAMES || 5} suggestions
                    </p>
                    {/* {petTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {petTypes.map((type) => (
                          <div key={type} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
                            {type === 'guinea pig' ? '🐹' : 
                              type === 'dog' ? '🐕' :
                              type === 'cat' ? '🐱' :
                              type === 'fish' ? '🐠' :
                              type === 'hamster' ? '🐹' :
                              type === 'rabbit' ? '🐰' :
                              type === 'horse' ? '🐎' :
                              '🐾'} {type.charAt(0).toUpperCase() + type.slice(1)}
                          </div>
                        ))}
                      </div>
                    )} */}
                  </div>
                </div>
                <div className="space-y-4">
                  {Array.isArray(generatedNames) && generatedNames
                    .filter(name => activeTab === 'all' || name.feedback === 'love')
                    .map((petName) => {
                    if (!petName || typeof petName.name !== 'string') return null;
                    
                    return (
                      <div
                        key={petName.id}
                        className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                      >
                        {/* Name and Action Buttons */}
                        <div className="flex items-start justify-between mb-3 gap-4">
                          <div className="flex-1">
                            <h3 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-indigo-700 dark:from-white dark:to-indigo-200 bg-clip-text text-transparent">
                              {petName.name}
                            </h3>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => copyName(petName.name)}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                            >
                              <span className="mr-1.5">📋</span>
                              Copy
                            </button>
                            <button
                              onClick={() => handleFeedback(petName.id, 'love')}
                              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                                petName.feedback === 'love'
                                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-600 dark:hover:text-pink-400'
                              }`}
                            >
                              <span className="mr-1.5">{petName.feedback === 'love' ? '❤️' : '🤍'}</span>
                              {petName.feedback === 'love' ? 'Shortlisted' : 'Shortlist'}
                            </button>
                          </div>
                        </div>

                        {/* Origin Badge */}
                        {petName?.origin && (
                          <div className="mb-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/30">
                              <span className="mr-1">🌍</span> {petName?.origin}
                            </span>
                          </div>
                        )}
                        
                        {/* Name Meaning */}
                        {petName.meaning && (
                          <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-700/30">
                            <div className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md text-xs font-medium">
                                  ✨ Meaning
                                </span>
                              </div>
                              <p className="italic leading-relaxed">
                                {petName.meaning}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Feedback Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleFeedback(petName.id, 'like')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                              petName.feedback === 'like'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 border-2 border-slate-200 dark:border-slate-600 hover:border-green-200 dark:hover:border-green-800'
                            }`}
                          >
                            👍 Like
                          </button>
                          <button
                            onClick={() => handleFeedback(petName.id, 'dislike')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                              petName.feedback === 'dislike'
                                ? 'bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow-lg shadow-slate-500/25'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-100 border-2 border-slate-200 dark:border-slate-600 hover:border-slate-200 dark:hover:border-slate-500'
                            }`}
                          >
                            👎 Dislike
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center pt-8 flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setGeneratedNames([]);
                      setPetDescription('');
                      setPetTypes([]);
                      setNameStyles([]);
                      setPetCharacteristics([]);
                      setUploadedImages([]);
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-slate-500 to-gray-500 text-white rounded-xl transition-all duration-300 transform hover:scale-105 font-medium shadow-xl shadow-slate-500/25 hover:shadow-2xl hover:shadow-slate-500/30"
                  >
                    🔄 Start over
                  </button>
                  <button
                    onClick={generateNames}
                    disabled={isGenerating}
                    className={`px-8 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                      isGenerating
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/30'
                    }`}
                  >
                    {isGenerating ? '⏳ Generating...' : '✨ Show me more'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Shortlist Modal */}
      {showShortlistModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-2xl mx-4 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>❤️</span> Your Shortlisted Names
              </h2>
              <button
                onClick={() => setShowShortlistModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
              >
                <span className="text-2xl text-slate-400 dark:text-slate-500">×</span>
              </button>
            </div>
            
            {shortlistedNames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  No names shortlisted yet. Click the ❤️ button on a name to add it to your shortlist!
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                {shortlistedNames.map((name) => (
                  <div
                    key={name.id}
                    className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-6 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {name.name}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyName(name.name)}
                          className="px-3 py-1.5 text-sm font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                          <span className="mr-1.5">📋</span>
                          Copy
                        </button>
                        <button
                          onClick={() => handleFeedback(name.id, 'dislike')}
                          className="px-3 py-1.5 text-sm font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
                        >
                          <span className="mr-1.5">🗑️</span>
                          Remove
                        </button>
                      </div>
                    </div>
                    {name.origin && (
                      <div className="mb-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/30">
                          <span className="mr-1">🌍</span> {name.origin}
                        </span>
                      </div>
                    )}
                    {name.meaning && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {name.meaning}
                      </p>
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
