import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase-config";
import invitationService from "../services/invitationService";
import {
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Clock,
  FileText,
  DollarSign,
  Calendar,
  UserCheck,
  Loader,
} from "lucide-react";

const InvitationAcceptance = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  // Main states
  const [invitation, setInvitation] = useState(null);
  const [project, setProject] = useState(null);
  const [freelancer, setFreelancer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // User states
  const [currentUser, setCurrentUser] = useState(null);
  const [clientExists, setClientExists] = useState(false);
  const [existingClient, setExistingClient] = useState(null);

  // UI flow states
  const [viewMode, setViewMode] = useState("initial"); // initial, login, register, processing
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states
  const [registrationForm, setRegistrationForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  // Load invitation data on mount
  useEffect(() => {
    if (token) {
      loadInvitationData();
    }
  }, [token]);

  // Check for existing authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const loadInvitationData = async () => {
    try {
      setLoading(true);
      setError("");

      // Get invitation details
      const invitationResult = await invitationService.getInvitation(token);
      if (!invitationResult.success) {
        setError(invitationResult.error || "Failed to load invitation");
        return;
      }

      setInvitation(invitationResult.data);

      // Get project and freelancer details
      const projectResult = await invitationService.getProjectDetails(token);
      if (projectResult.success) {
        setProject(projectResult.data.project);
        setFreelancer(projectResult.data.freelancer);
      }

      // Check if client already exists
      const clientCheck = await invitationService.checkClientExists(
        invitationResult.data.clientEmail,
      );
      if (clientCheck.success && clientCheck.exists) {
        setClientExists(true);
        setExistingClient(clientCheck.client);
        setLoginForm((prev) => ({
          ...prev,
          email: invitationResult.data.clientEmail,
        }));
      } else {
        setRegistrationForm((prev) => ({
          ...prev,
          email: invitationResult.data.clientEmail,
        }));
      }
    } catch (error) {
      console.error("Error loading invitation data:", error);
      setError("Failed to load invitation details");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!currentUser) {
      setError("Please log in or register first");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      const acceptResult = await invitationService.acceptInvitation(
        token,
        currentUser.uid,
      );

      console.log("🔍 Accept result:", acceptResult);

      if (acceptResult.success) {
        const responseData = acceptResult.data;
        console.log("📦 Response data:", responseData);
        console.log("🔑 Contract ID:", responseData.contractId);

        setSuccess(
          "Invitation accepted successfully! Redirecting to contract review...",
        );

        // Redirect to contract review if contract exists
        if (responseData.contractId) {
          console.log(
            "✅ Navigating to contract:",
            `/contracts/${responseData.contractId}/review`,
          );
          setTimeout(() => {
            navigate(`/contracts/${responseData.contractId}/review`);
          }, 2000);
        } else {
          console.log("⚠️ No contract ID, redirecting to dashboard");
          setTimeout(() => {
            navigate("/client-dashboard");
          }, 2000);
        }
      } else {
        console.error("❌ Failed to accept invitation:", acceptResult.error);
        setError(acceptResult.error || "Failed to accept invitation");
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setError("An error occurred while accepting the invitation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewLater = async () => {
    if (!currentUser) {
      setError("Please log in or register first to save this invitation");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      const result = await invitationService.markForReviewLater(
        token,
        currentUser.uid,
      );

      if (result.success) {
        setSuccess(
          "Invitation saved! You can review and accept it from your dashboard anytime.",
        );
        setTimeout(() => {
          navigate("/client/dashboard");
        }, 2000);
      } else {
        setError(result.error || "Failed to save invitation for later");
      }
    } catch (error) {
      console.error("Error saving invitation for later:", error);
      setError("An error occurred while saving the invitation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectInvitation = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reject this invitation? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      setIsProcessing(true);
      setError("");

      const rejectResult = await invitationService.rejectInvitation(token);

      if (rejectResult.success) {
        setSuccess("Invitation rejected successfully.");
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        setError(rejectResult.error || "Failed to reject invitation");
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      setError("An error occurred while rejecting the invitation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();

    if (registrationForm.password !== registrationForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (registrationForm.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        registrationForm.email,
        registrationForm.password,
      );
      const user = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: registrationForm.email,
        username: registrationForm.name,
        role: "client",
        createdAt: new Date(),
      });

      setSuccess("Account created successfully!");
      setCurrentUser(user);
      setViewMode("initial");
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please log in instead.");
        setViewMode("login");
      } else {
        setError(error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setIsProcessing(true);
      setError("");

      const userCredential = await signInWithEmailAndPassword(
        auth,
        loginForm.email,
        loginForm.password,
      );
      const user = userCredential.user;

      setSuccess("Logged in successfully!");
      setCurrentUser(user);
      setViewMode("initial");
    } catch (error) {
      console.error("Login error:", error);
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password");
      } else {
        setError(error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!invitation || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Invalid Invitation
          </h2>
          <p className="text-gray-600 mb-6">
            {error || "This invitation link is invalid or has expired."}
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Success state (after accepting/rejecting)
  if (
    success &&
    (success.includes("accepted") ||
      success.includes("rejected") ||
      success.includes("saved"))
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
          <p className="text-gray-600 mb-6">{success}</p>
          <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Login view
  if (viewMode === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <UserCheck className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-800">Welcome Back!</h2>
            <p className="text-gray-600 mt-2">
              Log in to accept the invitation
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, email: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setViewMode("initial")}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to invitation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Registration view
  if (viewMode === "register") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <User className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-800">
              Create Your Account
            </h2>
            <p className="text-gray-600 mt-2">
              Register to accept the invitation
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegistration} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={registrationForm.name}
                  onChange={(e) =>
                    setRegistrationForm({
                      ...registrationForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={registrationForm.email}
                  onChange={(e) =>
                    setRegistrationForm({
                      ...registrationForm,
                      email: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  required
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={registrationForm.password}
                  onChange={(e) =>
                    setRegistrationForm({
                      ...registrationForm,
                      password: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={registrationForm.confirmPassword}
                  onChange={(e) =>
                    setRegistrationForm({
                      ...registrationForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setViewMode("initial")}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to invitation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main invitation view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Project Invitation
          </h1>
          <p className="text-gray-600">
            You've been invited to collaborate on a project
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success &&
          !success.includes("accepted") &&
          !success.includes("rejected") &&
          !success.includes("saved") && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-green-700">{success}</p>
            </div>
          )}

        {/* Project Details Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                {project.title}
              </h2>
              <p className="text-gray-600">
                From:{" "}
                <span className="font-semibold text-gray-800">
                  {freelancer?.username || freelancer?.email}
                </span>
              </p>
            </div>
            <FileText className="w-12 h-12 text-blue-600" />
          </div>

          {project.description && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Description
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {project.hourlyRate && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-gray-600">
                    Hourly Rate
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  RM{project.hourlyRate}/hr
                </p>
              </div>
            )}

            {project.budget && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-gray-600">
                    Budget
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  RM{project.budget}
                </p>
              </div>
            )}

            {project.dueDate && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Calendar className="w-5 h-5 text-purple-600 mr-2" />
                  <span className="text-sm font-medium text-gray-600">
                    Due Date
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-800">
                  {new Date(project.dueDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {project.deliverables && project.deliverables.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Deliverables
              </h3>
              <ul className="space-y-2">
                {project.deliverables.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Authentication Required Notice */}
        {!currentUser && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Account Required
                </h3>
                <p className="text-gray-700 mb-4">
                  To accept this invitation, you need to{" "}
                  {clientExists
                    ? "log in to your account"
                    : "create an account"}
                  .
                </p>
                <div className="flex flex-wrap gap-3">
                  {clientExists ? (
                    <>
                      <button
                        onClick={() => setViewMode("login")}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                      >
                        Log In
                      </button>
                      <button
                        onClick={() => setViewMode("register")}
                        className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
                      >
                        Create New Account
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setViewMode("register")}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                      >
                        Create Account
                      </button>
                      <button
                        onClick={() => setViewMode("login")}
                        className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
                      >
                        I Already Have an Account
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {currentUser && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              What would you like to do?
            </h3>
            <p className="text-gray-600 mb-6">
              You're logged in as{" "}
              <span className="font-semibold">{currentUser.email}</span>
            </p>

            <div className="space-y-4">
              {/* Accept Button */}
              <button
                onClick={handleAcceptInvitation}
                disabled={isProcessing}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Accept Invitation & Review Contract
                  </>
                )}
              </button>

              {/* Review Later Button */}
              <button
                onClick={handleReviewLater}
                disabled={isProcessing}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Clock className="w-5 h-5 mr-2" />
                Save for Later Review
              </button>

              {/* Reject Button */}
              <button
                onClick={handleRejectInvitation}
                disabled={isProcessing}
                className="w-full bg-red-100 text-red-700 py-4 rounded-lg font-semibold hover:bg-red-200 transition disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <AlertCircle className="w-5 h-5 mr-2" />
                Decline Invitation
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> After accepting, you'll be redirected to
                review and sign the contract. If you're not ready to commit, you
                can save this invitation and review it later from your
                dashboard.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationAcceptance;
