import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase-config";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  MessageCircle,
  Download,
  TrendingUp,
  Send,
  User,
  Paperclip,
} from "lucide-react";

const ClientProgressView = ({ project, onClose }) => {
  const [projectDetails, setProjectDetails] = useState(project);
  const [tasks, setTasks] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("updates");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Reply management
  const [updateReplies, setUpdateReplies] = useState({});
  const [replyText, setReplyText] = useState({});
  const [showReplyForm, setShowReplyForm] = useState({});

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (project?.id) {
      fetchProjectDetails();
      const cleanup = subscribeToRealTimeUpdates();
      return () => {
        if (cleanup) cleanup();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);

      // Fetch project tasks
      const tasksQuery = query(
        collection(db, "tasks"),
        where("projectId", "==", project.id),
        orderBy("createdAt", "desc"),
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(tasksData);

      // Fetch progress updates
      const progressQuery = query(
        collection(db, "progress_updates"),
        where("projectId", "==", project.id),
        orderBy("createdAt", "desc"),
      );
      const progressSnapshot = await getDocs(progressQuery);
      const progressData = progressSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProgressUpdates(progressData);

      // Fetch replies for each update
      for (const update of progressData) {
        fetchUpdateReplies(update.id);
      }

      // Calculate time entries from tasks
      const timeEntriesData = tasksData
        .filter((task) => task.timeSpent > 0)
        .map((task) => ({
          id: task.id,
          taskTitle: task.title,
          hours: task.timeSpent,
          date: task.updatedAt?.toDate() || new Date(),
          status: task.status,
        }));
      setTimeEntries(timeEntriesData);
    } catch (error) {
      console.error("Error fetching project details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch replies for a specific update
  const fetchUpdateReplies = async (updateId) => {
    try {
      const repliesQuery = query(
        collection(db, "project_comments"),
        where("updateId", "==", updateId),
        where("type", "==", "thread_reply"),
        orderBy("createdAt", "asc"),
      );
      const snapshot = await getDocs(repliesQuery);
      const replies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUpdateReplies((prev) => ({
        ...prev,
        [updateId]: replies,
      }));
      return replies;
    } catch (error) {
      console.error("Error fetching replies:", error);
      return [];
    }
  };

  // Handle sending a reply to an update
  const handleSendReply = async (updateId) => {
    const text = replyText[updateId];
    if (!text?.trim() || !project) return;

    try {
      const replyData = {
        updateId: updateId,
        projectId: project.id,
        userId: currentUser?.uid,
        userName: currentUser?.displayName || currentUser?.email || "Client",
        userRole: "client",
        comment: text.trim(),
        type: "thread_reply",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, "project_comments"), replyData);

      // Clear reply input
      setReplyText((prev) => ({ ...prev, [updateId]: "" }));

      // Refresh replies
      await fetchUpdateReplies(updateId);

      // Hide reply form
      setShowReplyForm((prev) => ({ ...prev, [updateId]: false }));
    } catch (error) {
      console.error("Error sending reply:", error);
      alert("Failed to send reply. Please try again.");
    }
  };

  // Toggle reply form visibility
  const toggleReplyForm = (updateId) => {
    setShowReplyForm((prev) => ({
      ...prev,
      [updateId]: !prev[updateId],
    }));

    // Load replies if not already loaded
    if (!updateReplies[updateId]) {
      fetchUpdateReplies(updateId);
    }
  };

  const subscribeToRealTimeUpdates = () => {
    // Subscribe to real-time project updates
    const projectQuery = query(
      collection(db, "projects"),
      where("__name__", "==", project.id),
    );

    const unsubscribeProject = onSnapshot(projectQuery, (snapshot) => {
      if (!snapshot.empty) {
        const updatedProject = { id: project.id, ...snapshot.docs[0].data() };
        setProjectDetails(updatedProject);
      }
    });

    // Subscribe to real-time task updates
    const tasksQuery = query(
      collection(db, "tasks"),
      where("projectId", "==", project.id),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(tasksData);
    });

    // Subscribe to progress updates
    const progressQuery = query(
      collection(db, "progress_updates"),
      where("projectId", "==", project.id),
      orderBy("createdAt", "desc"),
    );

    const unsubscribeProgress = onSnapshot(progressQuery, (snapshot) => {
      const progressData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProgressUpdates(progressData);

      // Fetch replies for new updates
      progressData.forEach((update) => {
        if (!updateReplies[update.id]) {
          fetchUpdateReplies(update.id);
        }
      });
    });

    return () => {
      unsubscribeProject();
      unsubscribeTasks();
      unsubscribeProgress();
    };
  };

  const calculateProjectStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === "completed",
    ).length;
    const inProgressTasks = tasks.filter(
      (task) => task.status === "in-progress",
    ).length;
    const totalHours = tasks.reduce(
      (sum, task) => sum + (task.timeSpent || 0),
      0,
    );
    const estimatedHours = tasks.reduce(
      (sum, task) => sum + (task.estimatedHours || 0),
      0,
    );
    const currentCost = totalHours * (projectDetails.hourlyRate || 0);
    const estimatedCost = estimatedHours * (projectDetails.hourlyRate || 0);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalHours,
      estimatedHours,
      currentCost,
      estimatedCost,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  };

  const stats = calculateProjectStats();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-center">Loading project details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {projectDetails.title}
              </h2>
              <p className="text-gray-600">Project Progress & Updates</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Progress Overview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Project Overview
              </h3>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {stats.completionPercentage}%
                </span>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalTasks}
                </div>
                <div className="text-sm text-gray-600">Total Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.completedTasks}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.inProgressTasks}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.totalHours.toFixed(1)}h
                </div>
                <div className="text-sm text-gray-600">Hours Logged</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("updates")}
                className={`${
                  activeTab === "updates"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Progress Updates ({progressUpdates.length})
              </button>
              <button
                onClick={() => setActiveTab("tasks")}
                className={`${
                  activeTab === "tasks"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FileText className="w-4 h-4 mr-2" />
                Tasks ({tasks.length})
              </button>
              <button
                onClick={() => setActiveTab("time")}
                className={`${
                  activeTab === "time"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Clock className="w-4 h-4 mr-2" />
                Time Tracking
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {/* Progress Updates Tab */}
            {activeTab === "updates" && (
              <div className="space-y-4">
                {progressUpdates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No progress updates yet</p>
                  </div>
                ) : (
                  progressUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      {/* Update Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-3">
                          <div className="bg-blue-100 p-2 rounded-full">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {update.freelancerName || "Freelancer"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {update.createdAt
                                ?.toDate?.()
                                ?.toLocaleDateString() || "Recently"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Update Content */}
                      <div className="mb-4">
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {update.comment || update.updateText}
                        </p>
                      </div>

                      {/* Attachments */}
                      {update.attachments && update.attachments.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                            <Paperclip className="w-4 h-4 mr-1" />
                            Attachments ({update.attachments.length})
                          </h5>
                          <div className="space-y-2">
                            {update.attachments.map((file, idx) => (
                              <a
                                key={idx}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                              >
                                <FileText className="w-4 h-4 mr-2 text-blue-600" />
                                <span className="text-sm text-blue-600 hover:underline flex-1">
                                  {file.name}
                                </span>
                                <Download className="w-4 h-4 text-gray-400" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Replies Section */}
                      {updateReplies[update.id] &&
                        updateReplies[update.id].length > 0 && (
                          <div className="mt-4 pl-4 border-l-2 border-gray-200 space-y-3">
                            {updateReplies[update.id].map((reply) => (
                              <div
                                key={reply.id}
                                className="bg-gray-50 p-3 rounded-lg"
                              >
                                <div className="flex items-start space-x-2 mb-2">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                                      reply.userRole === "freelancer"
                                        ? "bg-blue-100 text-blue-600"
                                        : "bg-green-100 text-green-600"
                                    }`}
                                  >
                                    {reply.userName?.charAt(0)?.toUpperCase() ||
                                      "U"}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-semibold text-sm text-gray-900">
                                        {reply.userName || "User"}
                                      </span>
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                          reply.userRole === "freelancer"
                                            ? "bg-blue-100 text-blue-600"
                                            : "bg-green-100 text-green-600"
                                        }`}
                                      >
                                        {reply.userRole === "freelancer"
                                          ? "Freelancer"
                                          : "Client"}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {reply.createdAt
                                          ?.toDate?.()
                                          ?.toLocaleDateString() || "Recently"}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                                      {reply.comment}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Reply Form */}
                      <div className="mt-4">
                        {!showReplyForm[update.id] ? (
                          <button
                            onClick={() => toggleReplyForm(update.id)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Reply{" "}
                            {updateReplies[update.id] &&
                              updateReplies[update.id].length > 0 &&
                              `(${updateReplies[update.id].length})`}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <textarea
                              value={replyText[update.id] || ""}
                              onChange={(e) =>
                                setReplyText((prev) => ({
                                  ...prev,
                                  [update.id]: e.target.value,
                                }))
                              }
                              placeholder="Write your reply..."
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                              rows={3}
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSendReply(update.id)}
                                disabled={!replyText[update.id]?.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Send Reply
                              </button>
                              <button
                                onClick={() => toggleReplyForm(update.id)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div className="space-y-4">
                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks yet</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {task.status === "completed" && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                            {task.status === "in-progress" && (
                              <Clock className="w-5 h-5 text-blue-500" />
                            )}
                            {task.status === "pending" && (
                              <AlertCircle className="w-5 h-5 text-yellow-500" />
                            )}
                            <h4 className="font-semibold text-gray-900">
                              {task.title}
                            </h4>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                task.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : task.status === "in-progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {task.status?.replace("-", " ").toUpperCase()}
                            </span>
                            {task.timeSpent > 0 && (
                              <span className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {task.timeSpent}h logged
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Time Tracking Tab */}
            {activeTab === "time" && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Total Time Logged
                      </h4>
                      <p className="text-sm text-gray-600">Across all tasks</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">
                        {stats.totalHours.toFixed(1)}h
                      </div>
                      <div className="text-sm text-gray-600">
                        RM{stats.currentCost.toFixed(2)} total
                      </div>
                    </div>
                  </div>
                </div>

                {timeEntries.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No time entries yet</p>
                  </div>
                ) : (
                  timeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {entry.taskTitle}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {entry.date.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-600">
                            {entry.hours}h
                          </div>
                          <div className="text-sm text-gray-600">
                            RM
                            {(
                              entry.hours * (projectDetails.hourlyRate || 0)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProgressView;
