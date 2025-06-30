'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ThankYouModalProps {
  isOpen: boolean;
  onClose: () => void;
  demoTitle?: string;
  ctaLink?: string;
}

const ThankYouModal: React.FC<ThankYouModalProps> = ({ isOpen, onClose, demoTitle = 'Product Demo', ctaLink }) => {
  const router = useRouter();

  if (!isOpen) return null;

  const handleDashboardClick = () => {
    router.push('/dashboard');
  };

  const handleTryAgainClick = () => {
    // Reload the current page to restart the demo
    window.location.reload();
  };

  const handleCtaClick = () => {
    if (ctaLink) {
      window.open(ctaLink, '_blank');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden transform transition-all">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
          
          <p className="text-gray-600 mb-6">
            Thank you for exploring the {demoTitle} demo. We hope this interactive
            experience helped you understand our product better.
          </p>
          
          <div className="space-y-3">
            {ctaLink && (
              <button
                onClick={handleCtaClick}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Get Started Now
              </button>
            )}
            
            <button
              onClick={handleTryAgainClick}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Demo Again
            </button>
            
            <button
              onClick={handleDashboardClick}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Dashboard
            </button>
            
            <button
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md px-4 py-2 text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYouModal;
