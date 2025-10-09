import React, { useState } from 'react';
import { X, CreditCard, Smartphone, Building2, CheckCircle } from 'lucide-react';

const MockPaymentModal = ({ 
  isOpen, 
  onClose, 
  invoiceData, 
  onPaymentSuccess 
}) => {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState('method'); // method, processing, success

  const paymentMethods = [
    { id: 'card', name: 'Credit/Debit Card', icon: CreditCard },
    { id: 'bank', name: 'Bank Transfer', icon: Building2 },
    { id: 'mobile', name: 'Mobile Payment', icon: Smartphone }
  ];


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
      
      // Call success callback with payment data
      onPaymentSuccess({
        paymentId: paymentRef,
        paymentMethod: paymentMethod,
        amount: invoiceData?.totalAmount || invoiceData?.amount || 0,
        paidAt: new Date(),
        status: 'completed',
        reference: paymentRef,
        details: {
          method: paymentMethod,
          reference: paymentRef
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
            <p className="text-sm text-gray-600">Amount to Pay</p>
            <p className="text-3xl font-bold text-gray-900">
              RM{(invoiceData?.totalAmount || invoiceData?.amount || 0).toFixed(2)}
            </p>
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
