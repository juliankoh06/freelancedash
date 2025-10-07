import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, Zap, Target } from 'lucide-react';

const FloatingTimeWidget = ({ 
  isVisible, 
  onToggle, 
  onClose, 
  activeSessions = [],
  onStartTracking,
  onStopTracking,
  onPauseTracking
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const getTotalActiveTime = () => {
    return activeSessions.reduce((total, session) => total + session.duration, 0);
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
      isMinimized ? 'w-16 h-16' : 'w-80'
    }`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div 
          className="bg-blue-600 text-white p-3 cursor-pointer flex items-center justify-between"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            {!isMinimized && <span className="font-semibold">Time Tracker</span>}
          </div>
          <div className="flex items-center space-x-1">
            {!isMinimized && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="text-white hover:text-gray-200"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4">
            {/* Current Time */}
            <div className="text-center mb-4">
              <div className="text-2xl font-mono font-bold text-gray-900">
                {formatTime(currentTime)}
              </div>
              <div className="text-sm text-gray-600">Current Time</div>
            </div>

            {/* Active Sessions */}
            {activeSessions.length > 0 ? (
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Active Sessions</span>
                  <span className="text-sm text-gray-500">
                    {activeSessions.length} running
                  </span>
                </div>
                
                {activeSessions.map((session, index) => (
                  <div key={session.taskId} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          Task #{session.taskId.slice(-4)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatDuration(session.duration)} elapsed
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onPauseTracking(session.taskId)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="Pause"
                        >
                          <Pause className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onStopTracking(session.taskId)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Stop"
                        >
                          <Square className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total Time */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">Total Active Time</span>
                    <span className="text-lg font-bold text-blue-900">
                      {formatDuration(getTotalActiveTime())}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Zap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-3">No active time tracking</p>
                <button
                  onClick={() => onStartTracking()}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Tracking</span>
                </button>
              </div>
            )}

            {/* Quick Actions */}
            {activeSessions.length > 0 && (
              <div className="flex space-x-2">
                <button
                  onClick={() => onStartTracking()}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>New Task</span>
                </button>
                <button
                  onClick={() => {
                    activeSessions.forEach(session => onStopTracking(session.taskId));
                  }}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop All</span>
                </button>
              </div>
            )}

            {/* Productivity Indicator */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center space-x-1">
                  <Target className="w-3 h-3" />
                  <span>Productivity</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Minimized State */}
        {isMinimized && (
          <div className="p-2 text-center">
            <div className="text-xs text-white font-mono">
              {formatTime(currentTime)}
            </div>
            {activeSessions.length > 0 && (
              <div className="text-xs text-white mt-1">
                {activeSessions.length} active
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingTimeWidget;
