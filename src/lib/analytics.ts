// Google Analytics utility functions
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Common event tracking functions
export const analytics = {
  // Button click events
  trackButtonClick: (buttonName: string, context?: string) => {
    const label = context ? `${buttonName}_${context}` : buttonName;
  
    // Keep generic button_click
    trackEvent('button_click', 'engagement', label);
  
    // New dynamic event for this specific button
    const buttonEventName = `${buttonName}_clicked`;
    trackEvent(buttonEventName, 'engagement', label);
  },

  // Form interactions
  trackFormSubmission: (formType: string, hasDescription: boolean, hasImages: boolean) => {
    trackEvent('form_submit', 'engagement', formType, 1);
    trackEvent('form_field_usage', 'engagement', 'description', hasDescription ? 1 : 0);
    trackEvent('form_field_usage', 'engagement', 'images', hasImages ? 1 : 0);
  },

  // Name generation
  trackNameGeneration: (petTypes: string[], nameStyles: string[], petCharacteristics: string[]) => {
    trackEvent('name_generation', 'engagement', 'generate_names', 1);
    trackEvent('preferences_used', 'engagement', 'pet_types', petTypes.length);
    trackEvent('preferences_used', 'engagement', 'name_styles', nameStyles.length);
    trackEvent('preferences_used', 'engagement', 'pet_characteristics', petCharacteristics.length);
  },

  // Name feedback
  trackNameFeedback: (feedback: 'love' | 'like' | 'dislike', name: string) => {
    trackEvent('name_feedback', 'engagement', feedback, 1);
    trackEvent('name_interaction', 'engagement', name, 1);
  },

  // Copy name
  trackNameCopy: (name: string) => {
    trackEvent('name_copy', 'engagement', name, 1);
  },

  // Theme toggle
  trackThemeToggle: (newTheme: string) => {
    trackEvent('theme_change', 'preferences', newTheme, 1);
  },

  // Shortlist interactions
  trackShortlistAction: (action: 'view' | 'add' | 'remove', name?: string) => {
    trackEvent('shortlist_action', 'engagement', `${action}${name ? `_${name}` : ''}`, 1);
  },

  // Voice input
  trackVoiceInput: (action: 'start' | 'stop') => {
    trackEvent('voice_input', 'engagement', action, 1);
  },

  // Image upload
  trackImageUpload: (count: number) => {
    trackEvent('image_upload', 'engagement', 'upload_count', count);
  },

  // Page interactions
  trackPageInteraction: (interaction: string, details?: string) => {
    trackEvent('page_interaction', 'engagement', `${interaction}${details ? `_${details}` : ''}`, 1);
  },

  // Error tracking
  trackError: (errorType: string, context?: string) => {
    trackEvent('error', 'error', `${errorType}${context ? `_${context}` : ''}`, 1);
  },

  // Feedback tracking
  trackFeedbackSubmission: (hasText: boolean, selectedOptions: string[], textLength?: number, positiveOptions?: string[], negativeOptions?: string[]) => {
    trackEvent('feedback_submit', 'engagement', 'app_feedback', 1);
    trackEvent('feedback_options_selected', 'engagement', selectedOptions.join(','), selectedOptions.length);
    
    if (positiveOptions && positiveOptions.length > 0) {
      trackEvent('feedback_positive_options', 'engagement', positiveOptions.join(','), positiveOptions.length);
    }
    
    if (negativeOptions && negativeOptions.length > 0) {
      trackEvent('feedback_negative_options', 'engagement', negativeOptions.join(','), negativeOptions.length);
    }
    
    if (hasText && textLength) {
      trackEvent('feedback_text_length', 'engagement', 'text_feedback', textLength);
    }


  },

  // Feedback modal interactions
  trackFeedbackModal: (action: 'open' | 'close') => {
    trackEvent('feedback_modal', 'engagement', action, 1);
  }
};
