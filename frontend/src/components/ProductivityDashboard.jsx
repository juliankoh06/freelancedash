import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Clock, 
  TrendingUp, 
  Target, 
  Calendar,
  Zap,
  Coffee,
  Moon,
  Sun
} from 'lucide-react';

const ProductivityDashboard = ({ timeEntries, tasks, projectId }) => {
  const [timeRange, setTimeRange] = useState('week');
  const [productivityData, setProductivityData] = useState(null);

  useEffect(() => {
    if (timeEntries && tasks) {
      calculateProductivityData();
    }
  }, [timeEntries, tasks, timeRange]);

  const calculateProductivityData = () => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const filteredEntries = timeEntries.filter(entry => 
      new Date(entry.date) >= startDate
    );

    // Daily productivity data
    const dailyData = {};
    filteredEntries.forEach(entry => {
      const date = new Date(entry.date).toLocaleDateString();
      if (!dailyData[date]) {
        dailyData[date] = { date, hours: 0, tasks: 0 };
      }
      dailyData[date].hours += entry.hours;
      dailyData[date].tasks += 1;
    });

    const dailyChartData = Object.values(dailyData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Hourly productivity (peak hours)
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, hours: 0 }));
    filteredEntries.forEach(entry => {
      const hour = new Date(entry.date).getHours();
      hourlyData[hour].hours += entry.hours;
    });

    // Task completion data
    const taskData = tasks.map(task => ({
      name: task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title,
      completed: task.status === 'completed' ? 1 : 0,
      hours: task.timeSpent || 0,
      estimated: task.estimatedHours || 0
    }));

    // Productivity insights
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const avgHoursPerDay = totalHours / Math.max(dailyChartData.length, 1);
    const peakHour = hourlyData.reduce((max, hour) => 
      hour.hours > max.hours ? hour : max
    );
    const completionRate = tasks.length > 0 ? 
      (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;

    setProductivityData({
      dailyData: dailyChartData,
      hourlyData,
      taskData,
      insights: {
        totalHours,
        avgHoursPerDay: Math.round(avgHoursPerDay * 10) / 10,
        peakHour: peakHour.hour,
        peakHourHours: Math.round(peakHour.hours * 10) / 10,
        completionRate: Math.round(completionRate),
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length
      }
    });
  };

  const getPeakHourLabel = (hour) => {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  };

  const getPeakHourIcon = (hour) => {
    if (hour >= 6 && hour < 12) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (hour >= 12 && hour < 18) return <Zap className="w-4 h-4 text-blue-500" />;
    if (hour >= 18 && hour < 22) return <Coffee className="w-4 h-4 text-orange-500" />;
    return <Moon className="w-4 h-4 text-purple-500" />;
  };

  if (!productivityData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading productivity data...</div>
      </div>
    );
  }

  const { dailyData, hourlyData, taskData, insights } = productivityData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Productivity Dashboard</h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last Month</option>
          <option value="quarter">Last 3 Months</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{insights.totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Avg/Day</p>
              <p className="text-2xl font-bold text-gray-900">{insights.avgHoursPerDay}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Completion</p>
              <p className="text-2xl font-bold text-gray-900">{insights.completionRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            {getPeakHourIcon(insights.peakHour)}
            <div className="ml-3">
              <p className="text-sm text-gray-600">Peak Time</p>
              <p className="text-2xl font-bold text-gray-900">{insights.peakHour}:00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Productivity Chart */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="text-lg font-semibold mb-4">Daily Productivity</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, name === 'hours' ? 'Hours' : 'Tasks']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar dataKey="hours" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours Chart */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="text-lg font-semibold mb-4">Peak Working Hours</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [value, 'Hours']}
                labelFormatter={(hour) => `Time: ${hour}:00`}
              />
              <Line 
                type="monotone" 
                dataKey="hours" 
                stroke="#10B981" 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Task Performance */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold mb-4">Task Performance</h4>
        <div className="space-y-3">
          {taskData.slice(0, 5).map((task, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{task.name}</p>
                <p className="text-sm text-gray-600">
                  {task.hours.toFixed(1)}h / {task.estimated}h estimated
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  task.completed ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="text-sm text-gray-600">
                  {task.completed ? 'Completed' : 'In Progress'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h4 className="text-lg font-semibold text-blue-900 mb-3">💡 Productivity Insights</h4>
        <div className="space-y-2 text-blue-800">
          <p>• You're most productive during <strong>{getPeakHourLabel(insights.peakHour)}</strong> hours</p>
          <p>• You've completed <strong>{insights.completedTasks}</strong> out of <strong>{insights.totalTasks}</strong> tasks</p>
          <p>• Your average work session is <strong>{insights.avgHoursPerDay} hours</strong> per day</p>
          {insights.avgHoursPerDay > 8 && (
            <p className="text-orange-600">⚠️ Consider taking more breaks to maintain productivity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductivityDashboard;
