import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Donate() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [randomId, setRandomId] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp | donated
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/pw-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `91${phone}` }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRandomId(data.randomId || '');
        setStep('otp');
      } else {
        setError(data.message || 'Failed to send OTP.');
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Step 1: Verify OTP
      const verifyRes = await fetch('/api/proxy/pw-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `91${phone}`, otp, randomid: randomId }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        setError(verifyData.message || 'Invalid OTP.');
        return;
      }

      // Step 2: Save token via /api/pw/token
      const tokenRes = await fetch('/api/proxy/pw-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: `91${phone}`,
          accessToken: verifyData.accessToken,
          refreshToken: verifyData.refreshToken,
        }),
      });
      const tokenData = await tokenRes.json();

      // Save tokens to localStorage (use token endpoint response if available, else verifyData)
      const accessToken = tokenData.accessToken || verifyData.accessToken;
      const refreshToken = tokenData.refreshToken || verifyData.refreshToken;

      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      localStorage.removeItem('enrolledBatches');
      setStep('donated');
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'donated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Donation Complete!</h2>
          <p className="text-gray-500 mb-6">Thank you for donating your batches.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-xl font-semibold text-white text-lg transition"
            style={{ backgroundColor: '#5a4bda' }}
          >
            Explore More Batches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black text-white h-14 flex items-center px-4 z-50">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-800 rounded-lg transition mr-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">
          {step === 'phone' ? 'Login to Donate' : 'Enter OTP'}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md mt-14">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#ede9ff' }}>
            <svg className="w-8 h-8" style={{ color: '#5a4bda' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'phone' ? 'Enter Phone Number' : 'Enter OTP'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'phone'
              ? 'We will send a verification code to this number.'
              : `A code has been sent to +91${phone}.`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div className="flex items-center border border-gray-300 rounded-xl h-14 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-transparent transition">
              <span className="pl-4 pr-3 text-gray-500 font-medium text-lg border-r border-gray-300 h-full flex items-center">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number"
                required
                maxLength={10}
                pattern="\d{10}"
                className="flex-1 px-4 h-full text-lg focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#5a4bda' }}
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                required
                maxLength={6}
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#5a4bda' }}
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : 'Verify & Donate'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setRandomId(''); setError(''); }}
              className="w-full py-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
