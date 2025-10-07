import React from 'react';
import { Clock, AlertTriangle, Play, Pause } from 'lucide-react';
import { formatTime } from '../hooks/useIdleDetection';

const IdleWarningModal = ({ 
  isVisible, 
  timeUntilIdle, 
  onStayActive, 
  onPauseTracking,
  isTracking 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-500 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">
            Time Tracking Warning
          </h3>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-600 mb-2">
            You've been inactive for a while. Your time tracking will be paused in:
          </p>
          <div className="flex items-center justify-center bg-yellow-50 rounded-lg p-4">
            <Clock className="w-8 h-8 text-yellow-600 mr-3" />
            <span className="text-2xl font-mono font-bold text-yellow-700">
              {formatTime(timeUntilIdle)}
            </span>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={onStayActive}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4 mr-2" />
            Stay Active - Continue Tracking
          </button>
          
          <button
            onClick={onPauseTracking}
            className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Tracking Now
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          {isTracking ? 'Currently tracking time' : 'No active time tracking'}
        </div>
      </div>
    </div>
  );
};

export default IdleWarningModal;
