import React, { useState, useEffect } from 'react';
import { X, CreditCard, Smartphone, Building2, CheckCircle, AlertTriangle } from 'lucide-react';
import mockPaymentService from '../services/mockPaymentService';

const MockPaymentModal = ({ 
  isOpen, 
  onClose, 
  invoiceData, 
  onPaymentSuccess 
}) => {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState('method'); // method, processing, success
  const [lateFeeInfo, setLateFeeInfo] = useState(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  const paymentMethods = [
    { id: 'card', name: 'Credit/Debit Card', icon: CreditCard },
    { id: 'bank', name: 'Bank Transfer', icon: Building2 },
    { id: 'mobile', name: 'Mobile Payment', icon: Smartphone }
  ];

  // Calculate late fee when modal opens
  useEffect(() => {
    if (isOpen && invoiceData) {
      calculateLateFee();
    }
  }, [isOpen, invoiceData]);

  const calculateLateFee = async () => {
    setIsCalculatingFee(true);
    try {
      const feeInfo = await mockPaymentService.calculateLateFee(invoiceData, new Date());
      setLateFeeInfo(feeInfo);
    } catch (error) {
      console.error('Error calculating late fee:', error);
      setLateFeeInfo(null);
    } finally {
      setIsCalculatingFee(false);
    }
  };


  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentStep('processing');

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate payment success (90% success rate)
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      setPaymentStep('success');
      
      // Generate payment reference
      const paymentRef = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Calculate total amount including late fee
      const baseAmount = safeInvoiceTotal;
      const lateFee = lateFeeInfo?.lateFee || 0;
      const totalAmount = baseAmount + lateFee;
      
      // Call success callback with payment data
      onPaymentSuccess({
        paymentId: paymentRef,
        paymentMethod: paymentMethod,
        amount: totalAmount,
        baseAmount: baseAmount,
        lateFee: lateFee,
        paidAt: new Date(),
        status: 'completed',
        reference: paymentRef,
        details: {
          method: paymentMethod,
          reference: paymentRef,
          lateFeeApplied: lateFee > 0,
          daysOverdue: lateFeeInfo?.daysOverdue || 0
        }
      });

      // Auto close after 2 seconds
      setTimeout(() => {
        onClose();
        setPaymentStep('method');
        setIsProcessing(false);
      }, 2000);
    } else {
      alert('Payment failed. Please try again.');
      setPaymentStep('method');
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setPaymentStep('method');
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const invoiceTotal = Number(invoiceData?.totalAmount ?? invoiceData?.total ?? invoiceData?.amount ?? 0);
  const safeInvoiceTotal = isNaN(invoiceTotal) ? 0 : invoiceTotal;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {paymentStep === 'success' ? 'Payment Successful!' : 'Make Payment'}
          </h2>
          {paymentStep !== 'processing' && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Payment Amount */}
        <div className="p-6 border-b bg-gray-50">
          <div className="text-center">
            <p className="text-sm text-gray-600">Invoice Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              RM{safeInvoiceTotal.toFixed(2)}
            </p>
            
            {/* Late Fee Warning */}
            {isCalculatingFee && (
              <p className="text-sm text-gray-500 mt-2">Calculating late fees...</p>
            )}
            
            {lateFeeInfo && lateFeeInfo.isLate && lateFeeInfo.lateFee > 0 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-orange-800">Late Payment Fee Applied</p>
                    <p className="text-xs text-orange-700 mt-1">
                      Payment is {lateFeeInfo.daysOverdue} days overdue
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      Policy: {lateFeeInfo.policy}
                    </p>
                    <div className="mt-2 pt-2 border-t border-orange-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-700">Late Fee ({lateFeeInfo.feePercentage}%):</span>
                        <span className="font-semibold text-orange-800">RM{lateFeeInfo.lateFee.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {lateFeeInfo && lateFeeInfo.isLate && lateFeeInfo.lateFee === 0 && lateFeeInfo.reason && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                {lateFeeInfo.reason}
              </div>
            )}

            {/* Total Amount */}
            {lateFeeInfo && lateFeeInfo.lateFee > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <p className="text-sm text-gray-600">Total Amount Due</p>
                <p className="text-3xl font-bold text-gray-900">
                  RM{(safeInvoiceTotal + lateFeeInfo.lateFee).toFixed(2)}
                </p>
              </div>
            )}
            
            {(!lateFeeInfo || !lateFeeInfo.lateFee || lateFeeInfo.lateFee === 0) && (
              <p className="text-xs text-green-600 mt-2">No late fees</p>
            )}
            {invoiceData?.invoiceNumber && (
              <p className="text-sm text-gray-500 mt-1">
                Invoice: {invoiceData.invoiceNumber}
              </p>
            )}
          </div>
        </div>

        {/* Payment Steps */}
        <div className="p-6">
          {paymentStep === 'method' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Payment Method</h3>
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full p-4 border rounded-lg flex items-center space-x-3 transition-colors ${
                        paymentMethod === method.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-6 h-6 text-gray-600" />
                      <span className="font-medium text-gray-900">{method.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          {paymentStep === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-900">Processing Payment...</p>
              <p className="text-sm text-gray-600 mt-2">Please don't close this window</p>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Payment Successful!</p>
              <p className="text-sm text-gray-600 mt-2">
                Your payment has been processed and will appear in your transaction history.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {paymentStep === 'method' && (
          <div className="px-6 pb-6">
            <button
              onClick={handlePayment}
              disabled={!paymentMethod}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockPaymentModal;
