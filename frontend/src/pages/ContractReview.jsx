import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase-config";
import axios from "axios";
import {
  FileText,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  DollarSign,
  FileSignature,
  Download,
} from "lucide-react";
import { downloadContractPDF } from "../utils/pdfGenerator";

const ContractReview = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [project, setProject] = useState(null);
  const [freelancer, setFreelancer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState([]);
  const [rejectionComments, setRejectionComments] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      // Get user role from Firestore
      const fetchUserRole = async () => {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      };
      fetchUserRole();
    }

    if (contractId) {
      fetchContractDetails();
    }
  }, [contractId]);

  const fetchContractDetails = async () => {
    try {
      setLoading(true);

      // Fetch contract
      const contractDoc = await getDoc(doc(db, "contracts", contractId));
      if (!contractDoc.exists()) {
        setError("Contract not found");
        return;
      }

      const contractData = { id: contractDoc.id, ...contractDoc.data() };
      setContract(contractData);

      // Fetch project
      const projectDoc = await getDoc(
        doc(db, "projects", contractData.projectId),
      );
      if (projectDoc.exists()) {
        setProject({ id: projectDoc.id, ...projectDoc.data() });
      }

      // Fetch freelancer
      const freelancerDoc = await getDoc(
        doc(db, "users", contractData.freelancerId),
      );
      if (freelancerDoc.exists()) {
        setFreelancer({ id: freelancerDoc.id, ...freelancerDoc.data() });
      }
    } catch (err) {
      console.error("Error fetching contract:", err);
      setError("Failed to load contract details");
    } finally {
      setLoading(false);
    }
  };

  const handleSignContract = async (e) => {
    e.preventDefault();

    if (!signatureName.trim()) {
      setError("Please enter your full name to sign");
      return;
    }

    if (!agreedToTerms) {
      setError("You must agree to the terms to sign the contract");
      return;
    }

    setSigning(true);
    setError("");

    try {
      const response = await axios.post(
        `http://localhost:5000/api/contracts/${contractId}/sign`,
        {
          userId: currentUser.uid,
          userType: userRole,
          signature: signatureName,
        },
      );

      if (response.data.success) {
        const isFullySigned = response.data.fullySigned;

        if (isFullySigned) {
          alert(
            "🎉 Contract fully signed! The project is now active and work can begin.",
          );
        } else {
          alert(
            `✅ Contract signed successfully! Waiting for ${response.data.waitingFor} signature.`,
          );
        }

        // Redirect based on role
        if (userRole === "client") {
          navigate("/client-invitations");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(response.data.error || "Failed to sign contract");
      }
    } catch (err) {
      console.error("Error signing contract:", err);
      setError(err.response?.data?.error || "Failed to sign contract");
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = () => {
    try {
      if (!contract || !project) {
        alert("Contract details not fully loaded");
        return;
      }

      const clientData =
        currentUser && userRole === "client"
          ? {
              username: contract.clientName,
              email: project.clientEmail,
            }
          : null;

      downloadContractPDF(
        contract,
        project,
        freelancer,
        clientData,
        `contract-${project?.title || "document"}.pdf`,
      );
    } catch (error) {
      console.error("Error downloading contract PDF:", error);
      alert("Failed to download contract PDF");
    }
  };

  const handleRejectContract = async () => {
    if (rejectionReasons.length === 0) {
      setError("Please select at least one reason for rejection");
      return;
    }

    setRejecting(true);
    setError("");

    try {
      const response = await axios.post(
        `http://localhost:5000/api/contracts/${contractId}/reject`,
        {
          userId: currentUser.uid,
          reasons: rejectionReasons,
          comments: rejectionComments,
        },
      );

      if (response.data.success) {
        alert(
          "✅ Contract rejected. The freelancer has been notified of your feedback.",
        );
        navigate("/client-invitations");
      } else {
        setError(response.data.error || "Failed to reject contract");
      }
    } catch (err) {
      console.error("Error rejecting contract:", err);
      setError(err.response?.data?.error || "Failed to reject contract");
    } finally {
      setRejecting(false);
      setShowRejectModal(false);
    }
  };

  const toggleRejectionReason = (reason) => {
    if (rejectionReasons.includes(reason)) {
      setRejectionReasons(rejectionReasons.filter((r) => r !== reason));
    } else {
      setRejectionReasons([...rejectionReasons, reason]);
    }
  };

  const handleCancel = () => {
    if (userRole === "client") {
      navigate("/client-invitations");
    } else {
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Error
          </h2>
          <p className="text-gray-600 text-center">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const isFreelancerSigned = contract.freelancerSignedAt;
  const isClientSigned = contract.clientSignedAt;
  const needsMySignature =
    userRole === "client" ? !isClientSigned : !isFreelancerSigned;
  const isFullySigned = isFreelancerSigned && isClientSigned;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Contract Review
                </h1>
                <p className="text-sm text-gray-600">
                  Project: {project?.title || "Unknown Project"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Download as PDF"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </button>
              {isFullySigned && (
                <div className="flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span className="font-semibold">Fully Signed</span>
                </div>
              )}
            </div>
          </div>

          {/* Signature Status */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div
              className={`p-4 rounded-lg border-2 ${isFreelancerSigned ? "bg-green-50 border-green-500" : "bg-yellow-50 border-yellow-500"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Freelancer</span>
                {isFreelancerSigned ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isFreelancerSigned
                  ? `Signed ${new Date(contract.freelancerSignedAt.toDate()).toLocaleDateString()}`
                  : "Pending signature"}
              </p>
            </div>

            <div
              className={`p-4 rounded-lg border-2 ${isClientSigned ? "bg-green-50 border-green-500" : "bg-yellow-50 border-yellow-500"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Client</span>
                {isClientSigned ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isClientSigned
                  ? `Signed ${new Date(contract.clientSignedAt.toDate()).toLocaleDateString()}`
                  : "Pending signature"}
              </p>
            </div>
          </div>
        </div>

        {/* Contract Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Contract Terms
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div className="border-b pb-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Contract Title
              </h3>
              <p className="text-gray-900">{contract.title}</p>
            </div>

            {/* Scope */}
            <div className="border-b pb-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Scope of Work
              </h3>
              <p className="text-gray-900 whitespace-pre-wrap">
                {contract.scope}
              </p>
            </div>

            {/* Payment Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Payment Terms
                </h3>
                <p className="text-gray-900">{contract.paymentTerms}</p>
              </div>
              {contract.hourlyRate && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-1">
                    Hourly Rate
                  </h3>
                  <p className="text-gray-900 font-semibold">
                    RM{contract.hourlyRate}/hour
                  </p>
                </div>
              )}
              {contract.fixedPrice && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-1">
                    Fixed Price
                  </h3>
                  <p className="text-gray-900 font-semibold">
                    RM{contract.fixedPrice}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Start Date
                </h3>
                <p className="text-gray-900">
                  {new Date(
                    contract.startDate.toDate
                      ? contract.startDate.toDate()
                      : contract.startDate,
                  ).toLocaleDateString()}
                </p>
              </div>
              {contract.endDate && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-1">
                    End Date
                  </h3>
                  <p className="text-gray-900">
                    {new Date(
                      contract.endDate.toDate
                        ? contract.endDate.toDate()
                        : contract.endDate,
                    ).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Deliverables */}
            {contract.deliverables && contract.deliverables.length > 0 && (
              <div className="border-b pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  Deliverables
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {contract.deliverables.map((item, index) => (
                    <li key={index} className="text-gray-900">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Revision Policy */}
            <div className="border-b pb-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Revision Policy
              </h3>
              <p className="text-gray-900">{contract.revisionPolicy}</p>
            </div>

            {/* Additional Contract Terms */}
            {contract.invoicingSchedule && (
              <div className="border-b pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  Invoicing Schedule
                </h3>
                <p className="text-gray-900">{contract.invoicingSchedule}</p>
              </div>
            )}

            {contract.invoicingTerms && (
              <div className="border-b pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  Invoicing Terms
                </h3>
                <p className="text-gray-900">{contract.invoicingTerms}</p>
              </div>
            )}

            {contract.lateFeePolicy && (
              <div className="border-b pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  Late Payment Policy
                </h3>
                <p className="text-gray-900">{contract.lateFeePolicy}</p>
              </div>
            )}

            {contract.terminationClause && (
              <div className="border-b pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  Termination Clause
                </h3>
                <p className="text-gray-900">{contract.terminationClause}</p>
              </div>
            )}

            {contract.confidentialityClause && (
              <div className="border-b pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  Confidentiality
                </h3>
                <p className="text-gray-900">
                  {contract.confidentialityClause}
                </p>
              </div>
            )}

            {contract.intellectualPropertyClause && (
              <div className="pb-3">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  Intellectual Property Rights
                </h3>
                <p className="text-gray-900">
                  {contract.intellectualPropertyClause}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Parties Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Contract Parties
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center mb-3">
                <User className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-gray-900">Freelancer</h3>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-semibold text-gray-600">Name:</span>{" "}
                  {contract.freelancerName ||
                    freelancer?.username ||
                    "Not provided"}
                </p>
                <p>
                  <span className="font-semibold text-gray-600">Email:</span>{" "}
                  {freelancer?.email || "Not provided"}
                </p>
                {contract.freelancerAddress &&
                  contract.freelancerAddress !== "Address not provided" && (
                    <p>
                      <span className="font-semibold text-gray-600">
                        Address:
                      </span>{" "}
                      {contract.freelancerAddress}
                    </p>
                  )}
                {contract.freelancerPhone &&
                  contract.freelancerPhone !== "Phone not provided" && (
                    <p>
                      <span className="font-semibold text-gray-600">
                        Phone:
                      </span>{" "}
                      {contract.freelancerPhone}
                    </p>
                  )}
              </div>
              {isFreelancerSigned && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-sm font-semibold text-gray-600">
                    Signature
                  </p>
                  <p className="text-gray-900 italic text-lg">
                    {contract.freelancerSignature}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Signed:{" "}
                    {new Date(
                      contract.freelancerSignedAt.toDate(),
                    ).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center mb-3">
                <User className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="font-semibold text-gray-900">Client</h3>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-semibold text-gray-600">Name:</span>{" "}
                  {contract.clientName || "Pending acceptance"}
                </p>
                <p>
                  <span className="font-semibold text-gray-600">Email:</span>{" "}
                  {project?.clientEmail || "Not provided"}
                </p>
                {contract.clientAddress && (
                  <p>
                    <span className="font-semibold text-gray-600">
                      Address:
                    </span>{" "}
                    {contract.clientAddress}
                  </p>
                )}
                {contract.clientPhone && (
                  <p>
                    <span className="font-semibold text-gray-600">Phone:</span>{" "}
                    {contract.clientPhone}
                  </p>
                )}
              </div>
              {isClientSigned && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-sm font-semibold text-gray-600">
                    Signature
                  </p>
                  <p className="text-gray-900 italic text-lg">
                    {contract.clientSignature}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Signed:{" "}
                    {new Date(
                      contract.clientSignedAt.toDate(),
                    ).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sign Contract Form */}
        {needsMySignature && !isFullySigned && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <FileSignature className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">Sign Contract</h2>
            </div>

            <form onSubmit={handleSignContract}>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name (This will be your signature)
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                  required
                />
                {signatureName && (
                  <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">
                      Signature Preview:
                    </p>
                    <p className="text-2xl font-signature italic text-gray-800">
                      {signatureName}
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    required
                  />
                  <span className="text-sm text-gray-700">
                    I have read and agree to all terms and conditions stated in
                    this contract. I understand that this electronic signature
                    is legally binding and has the same effect as a handwritten
                    signature.
                  </span>
                </label>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={signing || !signatureName || !agreedToTerms}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
                >
                  {signing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Signing...
                    </>
                  ) : (
                    <>
                      <FileSignature className="w-5 h-5 mr-2" />
                      Sign Contract
                    </>
                  )}
                </button>
                {userRole === "client" && (
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="px-6 py-3 border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 font-semibold flex items-center"
                  >
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Reject Contract
                </h2>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Please select the reason(s) why you're rejecting this contract. This feedback will help the freelancer revise the contract.
                </p>

                <div className="space-y-2">
                  {[
                    "Scope is too broad or unclear",
                    "Timeline is unrealistic",
                    "Payment terms not acceptable",
                    "Hourly rate is too high",
                    "Billable hours cap is too low",
                    "Missing important deliverables",
                    "Intellectual property terms unclear",
                    "Revision policy insufficient",
                    "Other (please specify below)",
                  ].map((reason) => (
                    <label
                      key={reason}
                      className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={rejectionReasons.includes(reason)}
                        onChange={() => toggleRejectionReason(reason)}
                        className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Comments or Suggestions (Optional)
                </label>
                <textarea
                  value={rejectionComments}
                  onChange={(e) => setRejectionComments(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="4"
                  placeholder="Provide specific feedback to help the freelancer revise the contract..."
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleRejectContract}
                  disabled={rejecting || rejectionReasons.length === 0}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
                >
                  {rejecting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Confirm Rejection
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejecting}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Already Signed Message */}
        {!needsMySignature && !isFullySigned && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              You've Already Signed
            </h3>
            <p className="text-gray-600 mb-4">
              Waiting for {userRole === "client" ? "freelancer" : "client"}{" "}
              signature to activate the project.
            </p>
            <button
              onClick={() =>
                navigate(
                  userRole === "client" ? "/client-dashboard" : "/dashboard",
                )
              }
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Fully Signed Message */}
        {isFullySigned && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Contract Fully Signed!
            </h3>
            <p className="text-gray-600 mb-4">
              Both parties have signed the contract. The project is now active
              and work can begin.
            </p>
            <button
              onClick={() =>
                navigate(
                  userRole === "client" ? "/client-dashboard" : "/dashboard",
                )
              }
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractReview;
