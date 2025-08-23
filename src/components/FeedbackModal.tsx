'use client';

import { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { getSessionId } from '@/lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClose: (data?: Record<string, any>) => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedPositiveOptions, setSelectedPositiveOptions] = useState<string[]>([]);
  const [selectedNegativeOptions, setSelectedNegativeOptions] = useState<string[]>([]);


  // Get positive feedback options from environment variables
  const positiveFeedbackOptions = (process.env.NEXT_PUBLIC_POSITIVE_FEEDBACK || 'like,love,unique,random,good,perfect,easy,fun,creative')
    .split(',')
    .map(option => option.trim())
    .filter(Boolean);

  // Get negative feedback options from environment variables
  const negativeFeedbackOptions = (process.env.NEXT_PUBLIC_NEGATIVE_FEEDBACK || 'bad,confusing,boring,repetitive,slow,wrong,difficult,plain')
    .split(',')
    .map(option => option.trim())
    .filter(Boolean);

  const handlePositiveOptionToggle = (option: string) => {
    setSelectedPositiveOptions(prev => 
      prev.includes(option) 
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const handleNegativeOptionToggle = (option: string) => {
    setSelectedNegativeOptions(prev => 
      prev.includes(option) 
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const handleSubmit = async (nameId : '') => {

    // Track feedback submission using the new analytics function
    const allSelectedOptions = [...selectedPositiveOptions, ...selectedNegativeOptions];

    const feedback = {
      description: !!feedbackText.trim() || '',
      positives: selectedPositiveOptions,
      negatives: selectedNegativeOptions,
      petNameId: nameId || sessionStorage.getItem('nameId'),
      sessionId: getSessionId(),
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      locale: navigator.language || 'en-US',
    }

    analytics.trackFeedbackSubmission(
      !!feedbackText.trim(), 
      allSelectedOptions, 
      feedbackText.trim().length,
      selectedPositiveOptions,
      selectedNegativeOptions
    );

    // Here you could send the feedback to your backend or analytics service
    console.log('Feedback submitted:', feedback);

    // Reset form and close modal
    setFeedbackText('');
    setSelectedPositiveOptions([]);
    setSelectedNegativeOptions([]);
    onClose({feedbackSubmitted: true});
   

    // Show success message (you can implement a toast here)
    analytics.trackPageInteraction('feedback_success', 'modal');

    // call api to persist to db
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      const data = await res.json();
      if (res.ok) {
        console.log('Feedback saved:', data);
      } else {
        console.error('Error saving feedback:', data.error);
      }
    } catch (err) {
      console.error('❌ Failed to submit feedback:', err);
    }

  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-50 flex items-center justify-center p-4">

      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl p-8 w-full max-w-2xl mx-4 shadow-3xl border border-white/30 dark:border-slate-700/50 transform animate-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-blue-400 to-indigo-500 text-white flex items-center justify-center hidden md:flex">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              Share Your Feedback
            </h2>
          </div>
          <button
            onClick={() => {
              analytics.trackFeedbackModal('close');
              onClose({feedbackSubmitted: false});
            }}
            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all duration-300 transform hover:scale-110"
          >
            <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {/* Feedback Text Area */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Tell us what you think
            </label>
            <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 text-amber-700 dark:text-amber-300 rounded-full shadow-sm">
              Optional
            </span>
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share any thoughts, ideas, or issues to help us improve your experience."
            className="w-full px-6 py-6 border-0 outline-none rounded-3xl focus:ring-4 focus:ring-blue-500/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 resize-none min-h-[120px] text-base leading-relaxed transition-all duration-300 shadow-xl shadow-blue-500/5 hover:shadow-2xl hover:shadow-blue-500/10 focus:shadow-2xl focus:shadow-blue-500/15 border border-white/20 dark:border-slate-700/50"
            rows={4}
          />
        </div>

        {/* Feedback Options */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            {/* Positive options */}
            {positiveFeedbackOptions.slice(0, 5).map((item) => {
              const [emoji, label] = item.split(':');
              const isSelected = selectedPositiveOptions.includes(label);

              return (
                <button
                  key={`positive-${label}`}
                  onClick={() => handlePositiveOptionToggle(label)}
                  className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg border ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-blue-500/30 border-blue-400/20'
                      : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 shadow-slate-500/10 border-white/20 dark:border-slate-700/50'
                  }`}
                >
                  <span className="text-lg mr-2">{emoji}</span>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </button>
              );
            })}

            {/* Negative options */}
            {negativeFeedbackOptions.slice(0, 5).map((item) => {
              const [emoji, label] = item.split(':');
              const isSelected = selectedNegativeOptions.includes(label);

              return (
                <button
                  key={`negative-${label}`}
                  onClick={() => handleNegativeOptionToggle(label)}
                  className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg border ${
                    isSelected
                      ? 'bg-gradient-to-r from-red-400 to-pink-500 text-white shadow-red-500/30 border-red-400/20'
                      : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-300 shadow-slate-500/10 border-white/20 dark:border-slate-700/50'
                  }`}
                >
                  <span className="text-lg mr-2">{emoji}</span>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </button>
              );
            })}
          </div>
        </div>



        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            onClick={() => handleSubmit('')}
            disabled={!feedbackText.trim() && selectedPositiveOptions.length === 0 && selectedNegativeOptions.length === 0}
            className={`group px-8 py-4 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 ${
              !feedbackText.trim() && selectedPositiveOptions.length === 0 && selectedNegativeOptions.length === 0
                ? 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white shadow-2xl shadow-blue-500/30 hover:shadow-3xl hover:shadow-blue-500/40 border border-white/20'
            }`}
          >
            <span className="flex items-center justify-center gap-3 group-hover:gap-4 transition-all duration-300">
              <Send className="w-5 h-5 group-hover:animate-pulse" />
              Send Feedback
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
