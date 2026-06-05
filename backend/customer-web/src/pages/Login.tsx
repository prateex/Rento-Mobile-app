import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Mail, Phone, ArrowLeft } from 'lucide-react';
import { useBookingFlow } from '@/app/BookingFlowContext';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithOTP, signInWithPhone, verifyOTP, loading, error, isAuthenticated } = useAuth();
  const { flow } = useBookingFlow();

  const [mode, setMode] = useState<'select' | 'email' | 'phone' | 'verify'>('select');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const RETURN_URL_KEY = 'rento_login_return';

  const bookingReturnUrl = useMemo(() => {
    const fromState = (location.state as any)?.from as string | undefined;
    const stored = localStorage.getItem(RETURN_URL_KEY) || undefined;

    if (fromState) {
      localStorage.setItem(RETURN_URL_KEY, fromState);
      return fromState;
    }

    if (stored) {
      return stored;
    }

    if (flow?.vehicleId && flow.startDate && flow.endDate) {
      const params = new URLSearchParams();
      params.set('vehicleId', flow.vehicleId);
      params.set('startDate', flow.startDate);
      params.set('endDate', flow.endDate);
      return `/checkout?${params.toString()}`;
    }

    if (flow?.state && flow.city && flow.startDate && flow.endDate) {
      const params = new URLSearchParams();
      params.set('state', flow.state);
      params.set('city', flow.city);
      params.set('startDate', flow.startDate);
      params.set('endDate', flow.endDate);
      return `/search?${params.toString()}`;
    }

    return '/';
  }, [flow, location.state]);

  const bookingContextLabel = useMemo(() => {
    if (!flow?.state || !flow.city) return null;
    if (!flow.startDate || !flow.endDate) return `${flow.city}, ${flow.state}`;
    return `${flow.city}, ${flow.state}`;
  }, [flow]);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.removeItem(RETURN_URL_KEY);
      navigate(bookingReturnUrl, { replace: true });
    }
  }, [bookingReturnUrl, isAuthenticated, navigate]);

  const handleEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpSent) {
      // Send OTP
      const result = await signInWithOTP(email);
      if (result.success) {
        setOtpSent(true);
        setMode('verify');
      }
    } else {
      // Verify OTP
      const result = await verifyOTP(email, otp);
      if (result.success) {
        localStorage.removeItem(RETURN_URL_KEY);
        navigate(bookingReturnUrl, { replace: true });
      }
    }
  };

  const handlePhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await signInWithPhone(phone);
    if (result.success) {
      setOtpSent(true);
      setMode('verify');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back Button */}
        {mode !== 'select' && (
          <button
            onClick={() => {
              setMode('select');
              setOtpSent(false);
              setOtp('');
            }}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button>
        )}

        {/* Card */}
        <div className="rounded-lg bg-white p-8 shadow-lg">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary">
              <span className="text-2xl font-bold text-secondary">R</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Rento</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to continue</p>
            {bookingReturnUrl !== '/' && (
              <div className="mt-4 rounded-lg bg-primary/10 px-4 py-3 text-sm text-secondary">
                You’re logging in to complete your booking.
                {bookingContextLabel && (
                  <div className="mt-2 text-xs text-secondary/80">
                    {bookingContextLabel}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <ErrorMessage message={error} variant="error" />}

          {/* Selection Mode */}
          {mode === 'select' && (
            <div className="space-y-4">
              <Button
                onClick={() => setMode('email')}
                variant="outline"
                fullWidth
                size="lg"
              >
                <Mail className="mr-2 h-5 w-5" />
                Continue with Email
              </Button>
              <Button
                onClick={() => setMode('phone')}
                variant="outline"
                fullWidth
                size="lg"
              >
                <Phone className="mr-2 h-5 w-5" />
                Continue with Phone
              </Button>
            </div>
          )}

          {/* Email Mode */}
          {mode === 'email' && !otpSent && (
            <form onSubmit={handleEmailOTP} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button type="submit" fullWidth loading={loading}>
                Send OTP
              </Button>
            </form>
          )}

          {/* Phone Mode */}
          {mode === 'phone' && !otpSent && (
            <form onSubmit={handlePhoneOTP} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXXXXXXX"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button type="submit" fullWidth loading={loading}>
                Send OTP
              </Button>
            </form>
          )}

          {/* Verify Mode */}
          {mode === 'verify' && otpSent && (
            <form onSubmit={handleEmailOTP} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-2xl tracking-widest focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-sm text-gray-600">
                OTP sent to {email || phone}
              </p>
              <Button type="submit" fullWidth loading={loading}>
                Verify & Sign In
              </Button>
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  if (email) {
                    setMode('email');
                  } else {
                    setMode('phone');
                  }
                }}
              >
                Resend OTP
              </Button>
              {bookingReturnUrl !== '/' && (
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => navigate(bookingReturnUrl)}
                >
                  Back to booking
                </Button>
              )}
            </form>
          )}
        </div>

        {/* Terms */}
        <p className="mt-6 text-center text-xs text-gray-600">
          By signing in, you agree to our{' '}
          <a href="#" className="text-secondary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-secondary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
