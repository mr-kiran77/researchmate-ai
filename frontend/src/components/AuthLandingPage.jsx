import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { api } from '../api/client';

/**
 * Country code options for Sign Up phone number validation.
 * Extend or reorder this list to match your target user regions.
 */
const COUNTRY_CODES = [
  { code: '+1', label: 'US / CA (+1)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+971', label: 'UAE (+971)' },
];

// ============================================================================
// VALIDATION HELPERS (Shared, explicit, and easy to customize)
// ============================================================================

const GMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@gmail\.com$/i;
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,24}$/;
const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

/**
 * Evaluates password strength for the 8-character minimum requirement in Sign Up.
 */
function evaluatePasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Too Short', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['bg-rose-400', 'bg-amber-400', 'bg-yellow-300', 'bg-emerald-400', 'bg-teal-300'];
  return {
    score,
    meetsMinLength: password.length >= 8,
    label: password.length === 0 ? '' : password.length < 8 ? 'Minimum 8 characters' : labels[score],
    barColor: colors[score],
  };
}

/**
 * Detects whether a Log In identifier looks like a Gmail address, phone number, or username.
 */
function detectLoginIdentifierType(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return 'Gmail';
  if (/^[\d\s+\-()]+$/.test(trimmed)) return 'Phone';
  return 'Username';
}

function validateLoginIdentifier(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Please enter your username, 10-digit phone number, or Gmail address.';
  }
  if (trimmed.includes('@')) {
    if (!GMAIL_REGEX.test(trimmed)) {
      return 'Please enter a valid Gmail address ending in @gmail.com.';
    }
    return '';
  }
  if (/^[\d\s+\-()]+$/.test(trimmed)) {
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      return 'Phone numbers must contain 10 digits (or include country code).';
    }
    return '';
  }
  const cleanUser = trimmed.replace(/^@/, '');
  if (!USERNAME_REGEX.test(cleanUser)) {
    return 'Username must be 3–24 characters (letters, numbers, periods, or underscores).';
  }
  return '';
}

function validateGmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Gmail address is required.';
  if (trimmed.includes('..') || !GMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid Gmail address ending in @gmail.com (e.g. alex.smith@gmail.com).';
  }
  return '';
}

function validatePhone(value) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'Phone number is required.';
  if (!TEN_DIGIT_PHONE_REGEX.test(digits)) {
    return 'Please enter an exact 10-digit phone number.';
  }
  return '';
}

function validateUsername(value) {
  const cleaned = value.trim().replace(/^@/, '');
  if (!cleaned) return 'Username is required.';
  if (cleaned.startsWith('.') || cleaned.endsWith('.') || cleaned.includes('..')) {
    return 'Username cannot start/end with a period or contain consecutive periods.';
  }
  if (!USERNAME_REGEX.test(cleaned)) {
    return 'Use 3–24 characters: letters, numbers, underscores (_), or periods (.).';
  }
  return '';
}

/**
 * AuthLandingPage — Creative Instagram-inspired glassmorphism authentication front page.
 *
 * Props:
 * - onAuthenticated(user): Called after a successful Log In or Sign Up to enter the app.
 */
export default function AuthLandingPage({ onAuthenticated }) {
  // Active form mode: 'login' (2 fields) | 'signup' (4 fields)
  const [mode, setMode] = useState('login');

  // Shared UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');

  // ---------------- Log In Mode State (2 Fields) ----------------
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState({});

  // ---------------- Sign Up Mode State (4 Fields) ----------------
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gmail, setGmail] = useState('');
  const [username, setUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupErrors, setSignupErrors] = useState({});

  const identifierBadge = useMemo(() => detectLoginIdentifierType(loginIdentifier), [loginIdentifier]);
  const passwordStrength = useMemo(() => evaluatePasswordStrength(signupPassword), [signupPassword]);

  /** Switch smoothly between Log In and Sign Up while resetting stale alerts */
  const switchMode = (nextMode) => {
    setMode(nextMode);
    setServerError('');
    setSuccessMessage('');
    setForgotOpen(false);
    setLoginErrors({});
    setSignupErrors({});
  };

  // ============================================================================
  // BACKEND INTEGRATION HANDLERS
  // Replace or extend `api.authLogin` / `api.authSignup` below if connecting
  // to an external authentication provider (Firebase, Supabase, OAuth, etc.).
  // ============================================================================

  /**
   * Handles "Log In" form submission (Username / Phone / Gmail + Password).
   */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    // 1. Validate both Log In fields
    const errors = {
      identifier: validateLoginIdentifier(loginIdentifier),
      password: loginPassword.trim() ? '' : 'Password is required.',
    };
    setLoginErrors(errors);
    if (errors.identifier || errors.password) return;

    setIsSubmitting(true);
    try {
      // 2. Call your backend Log In API endpoint (FastAPI POST /api/auth/login)
      const user = await api.authLogin({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      setSuccessMessage(`Welcome back, @${user.username}! Launching ResearchMate AI...`);
      setTimeout(() => onAuthenticated?.(user), 450);
    } catch (err) {
      setServerError(err.message || 'Unable to log in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles "Sign Up" form submission (Phone + Gmail + Username + Password).
   */
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    // 1. Validate all 4 Sign Up fields strictly
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    const errors = {
      phone: validatePhone(cleanDigits),
      gmail: validateGmail(gmail),
      username: validateUsername(username),
      password:
        signupPassword.length < 8
          ? 'Password must be at least 8 characters long.'
          : '',
    };
    setSignupErrors(errors);
    if (errors.phone || errors.gmail || errors.username || errors.password) return;

    setIsSubmitting(true);
    try {
      // 2. Call your backend Sign Up API endpoint (FastAPI POST /api/auth/signup)
      const createdUser = await api.authSignup({
        country_code: countryCode,
        phone_number: cleanDigits,
        gmail: gmail.trim().toLowerCase(),
        username: username.trim().replace(/^@/, '').toLowerCase(),
        password: signupPassword,
      });

      setSuccessMessage(`Account @${createdUser.username} created! Entering workspace...`);
      setTimeout(() => onAuthenticated?.(createdUser), 500);
    } catch (err) {
      setServerError(err.message || 'Could not create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotStatus('Please enter your registered Gmail or username.');
      return;
    }
    setForgotStatus(
      `If an account matches "${forgotEmail.trim()}", password reset instructions are ready via your backend mailer.`
    );
  };

  return (
    <div className="ig-animated-bg relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      {/* Subtle Animated Floating Shapes & Ambient Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top-left glowing sunset sphere */}
        <div className="animate-float-slow absolute -left-20 -top-20 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl sm:h-96 sm:w-96" />
        {/* Bottom-right indigo/violet orb */}
        <div className="animate-float-reverse absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-indigo-500/35 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        {/* Mid-right magenta bloom */}
        <div className="animate-float-slow absolute right-1/4 top-1/4 h-56 w-56 rounded-full bg-pink-400/25 blur-3xl" />

        {/* Floating frosted glass decorative badges (desktop/tablet) */}
        <div className="animate-float-slow absolute left-10 top-16 hidden items-center gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-white/90 shadow-lg backdrop-blur-md lg:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 to-pink-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="text-xs">
            <div className="font-bold">AI Research Agent</div>
            <div className="text-[11px] text-white/75">Multi-source synthesis</div>
          </div>
        </div>

        <div className="animate-float-reverse absolute bottom-16 left-16 hidden items-center gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-white/90 shadow-lg backdrop-blur-md lg:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-500">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="text-xs">
            <div className="font-bold">Fact Verification</div>
            <div className="text-[11px] text-white/75">Conflict-aware citations</div>
          </div>
        </div>

        <div className="animate-float-slow absolute right-14 top-24 hidden items-center gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-white/90 shadow-lg backdrop-blur-md xl:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-blue-500">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="text-xs">
            <div className="font-bold">PyMuPDF &amp; Papers</div>
            <div className="text-[11px] text-white/75">14-section reports</div>
          </div>
        </div>
      </div>

      {/* Centered Frosted Glassmorphism Authentication Card */}
      <div className="relative z-10 w-full max-w-[460px]">
        <div className="rounded-3xl border border-white/30 bg-white/15 p-6 text-white shadow-[0_28px_80px_-15px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:p-8">
          {/* Creative Brand Logo & Header */}
          <div className="flex flex-col items-center text-center">
            <div className="group relative mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 p-[2px] shadow-xl transition-transform duration-300 hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[20px] bg-slate-950/30 backdrop-blur-md">
                <Layers className="h-7 w-7 text-white drop-shadow" />
              </div>
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-pink-600 shadow">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>

            <h1 className="font-serif text-3xl font-bold tracking-tight text-white drop-shadow-sm">
              ResearchMate AI
            </h1>
            <p className="mt-1 text-xs font-medium text-white/85">
              Research Smarter. Discover Faster. Make Better Decisions.
            </p>
          </div>

          {/* 1. Smooth Pill-Shaped Mode Toggle Switch (Log In vs Sign Up) */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="relative mt-6 grid grid-cols-2 rounded-full border border-white/25 bg-black/25 p-1 backdrop-blur-md"
          >
            {/* Sliding Indicator */}
            <div
              aria-hidden="true"
              className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${
                mode === 'login' ? 'translate-x-0' : 'translate-x-full'
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`relative z-10 rounded-full py-2 text-xs font-bold tracking-wide transition-colors duration-200 sm:text-sm ${
                mode === 'login' ? 'text-slate-900' : 'text-white/85 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
              className={`relative z-10 rounded-full py-2 text-xs font-bold tracking-wide transition-colors duration-200 sm:text-sm ${
                mode === 'signup' ? 'text-slate-900' : 'text-white/85 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Global API Alert Banners */}
          {serverError && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-300/60 bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-100 backdrop-blur-md">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <span>{serverError}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-950/45 px-3.5 py-2.5 text-xs font-semibold text-emerald-100 backdrop-blur-md">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Animated Panels Container */}
          <div className="mt-5">
            {/* ============================================================== */}
            {/* PANEL A: LOG IN MODE (2 FIELDS)                                */}
            {/* ============================================================== */}
            <div
              className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === 'login' ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <form onSubmit={handleLoginSubmit} noValidate className="space-y-4 pt-1">
                  {/* Field 1: Username, Phone Number, or Gmail */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="login-identifier" className="text-xs font-semibold text-white/90">
                        Username, Phone Number, or Gmail
                      </label>
                      {identifierBadge && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          {identifierBadge}
                        </span>
                      )}
                    </div>
                    <div
                      className={`group flex items-center gap-2.5 rounded-2xl border bg-white/15 px-3.5 py-2.5 transition-all duration-200 focus-within:bg-white/25 focus-within:ring-2 focus-within:ring-white/70 ${
                        loginErrors.identifier ? 'border-rose-300 bg-rose-950/30' : 'border-white/25 hover:border-white/45'
                      }`}
                    >
                      <User className="h-4 w-4 shrink-0 text-white/75 transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-white" />
                      <input
                        id="login-identifier"
                        type="text"
                        autoComplete="username"
                        value={loginIdentifier}
                        onChange={(e) => {
                          setLoginIdentifier(e.target.value);
                          if (loginErrors.identifier) {
                            setLoginErrors((prev) => ({
                              ...prev,
                              identifier: validateLoginIdentifier(e.target.value),
                            }));
                          }
                        }}
                        onBlur={() =>
                          setLoginErrors((prev) => ({
                            ...prev,
                            identifier: validateLoginIdentifier(loginIdentifier),
                          }))
                        }
                        placeholder="alex_research, 9876543210, or alex@gmail.com"
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
                      />
                    </div>
                    {loginErrors.identifier && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-rose-200">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{loginErrors.identifier}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Password with Show/Hide Eye Toggle */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="login-password" className="text-xs font-semibold text-white/90">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotOpen((v) => !v);
                          setForgotStatus('');
                        }}
                        className="text-xs font-semibold text-amber-200 transition hover:text-white hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div
                      className={`group flex items-center gap-2.5 rounded-2xl border bg-white/15 px-3.5 py-2.5 transition-all duration-200 focus-within:bg-white/25 focus-within:ring-2 focus-within:ring-white/70 ${
                        loginErrors.password ? 'border-rose-300 bg-rose-950/30' : 'border-white/25 hover:border-white/45'
                      }`}
                    >
                      <Lock className="h-4 w-4 shrink-0 text-white/75 transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-white" />
                      <input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          if (loginErrors.password) {
                            setLoginErrors((prev) => ({
                              ...prev,
                              password: e.target.value.trim() ? '' : 'Password is required.',
                            }));
                          }
                        }}
                        placeholder="Enter your password"
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowLoginPassword((v) => !v)}
                        className="rounded-lg p-1 text-white/75 transition hover:bg-white/15 hover:text-white"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-rose-200">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{loginErrors.password}</span>
                      </p>
                    )}
                  </div>

                  {/* Optional Inline Forgot Password Panel */}
                  {forgotOpen && (
                    <div className="rounded-2xl border border-white/25 bg-black/25 p-3 text-xs backdrop-blur-md">
                      <div className="mb-1.5 flex items-center gap-1.5 font-bold text-white">
                        <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                        <span>Reset Your Password</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="Enter your @gmail.com or username"
                          className="flex-1 rounded-xl border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-white/55 focus:border-white/60 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleForgotSubmit}
                          className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-white/90"
                        >
                          Send
                        </button>
                      </div>
                      {forgotStatus && <p className="mt-1.5 text-[11px] text-amber-100">{forgotStatus}</p>}
                    </div>
                  )}

                  {/* Log In Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-pink-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Log In</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ============================================================== */}
            {/* PANEL B: SIGN UP MODE (4 FIELDS)                               */}
            {/* ============================================================== */}
            <div
              className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === 'signup' ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <form onSubmit={handleSignUpSubmit} noValidate className="space-y-3.5 pt-1">
                  {/* Field 1: Phone Number with Country Code Selector & 10-digit validation */}
                  <div>
                    <label htmlFor="signup-phone" className="mb-1.5 block text-xs font-semibold text-white/90">
                      Phone Number (10 digits)
                    </label>
                    <div
                      className={`group flex items-center gap-2 rounded-2xl border bg-white/15 px-3 py-2 transition-all duration-200 focus-within:bg-white/25 focus-within:ring-2 focus-within:ring-white/70 ${
                        signupErrors.phone ? 'border-rose-300 bg-rose-950/30' : 'border-white/25 hover:border-white/45'
                      }`}
                    >
                      <Phone className="h-4 w-4 shrink-0 text-white/75" />
                      <select
                        aria-label="Country code"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="rounded-lg bg-slate-900/50 px-2 py-1 text-xs font-semibold text-white focus:outline-none"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        id="signup-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={phoneNumber}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhoneNumber(digitsOnly);
                          if (signupErrors.phone) {
                            setSignupErrors((prev) => ({
                              ...prev,
                              phone: validatePhone(digitsOnly),
                            }));
                          }
                        }}
                        onBlur={() =>
                          setSignupErrors((prev) => ({
                            ...prev,
                            phone: validatePhone(phoneNumber),
                          }))
                        }
                        placeholder="9876543210"
                        className="w-full bg-transparent text-sm tracking-wide text-white placeholder:text-white/55 focus:outline-none"
                      />
                    </div>
                    {signupErrors.phone && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-200">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{signupErrors.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Real Gmail Address (@gmail.com) */}
                  <div>
                    <label htmlFor="signup-gmail" className="mb-1.5 block text-xs font-semibold text-white/90">
                      Real Gmail Address
                    </label>
                    <div
                      className={`group flex items-center gap-2.5 rounded-2xl border bg-white/15 px-3.5 py-2.5 transition-all duration-200 focus-within:bg-white/25 focus-within:ring-2 focus-within:ring-white/70 ${
                        signupErrors.gmail ? 'border-rose-300 bg-rose-950/30' : 'border-white/25 hover:border-white/45'
                      }`}
                    >
                      <Mail className="h-4 w-4 shrink-0 text-white/75 transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-white" />
                      <input
                        id="signup-gmail"
                        type="email"
                        autoComplete="email"
                        value={gmail}
                        onChange={(e) => {
                          setGmail(e.target.value);
                          if (signupErrors.gmail) {
                            setSignupErrors((prev) => ({
                              ...prev,
                              gmail: validateGmail(e.target.value),
                            }));
                          }
                        }}
                        onBlur={() =>
                          setSignupErrors((prev) => ({
                            ...prev,
                            gmail: validateGmail(gmail),
                          }))
                        }
                        placeholder="your.name@gmail.com"
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
                      />
                    </div>
                    {signupErrors.gmail && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-200">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{signupErrors.gmail}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 3: Username with '@' prefix icon */}
                  <div>
                    <label htmlFor="signup-username" className="mb-1.5 block text-xs font-semibold text-white/90">
                      Username
                    </label>
                    <div
                      className={`group flex items-center gap-2 rounded-2xl border bg-white/15 px-3.5 py-2.5 transition-all duration-200 focus-within:bg-white/25 focus-within:ring-2 focus-within:ring-white/70 ${
                        signupErrors.username ? 'border-rose-300 bg-rose-950/30' : 'border-white/25 hover:border-white/45'
                      }`}
                    >
                      <AtSign className="h-4 w-4 shrink-0 text-amber-200 transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-white" />
                      <input
                        id="signup-username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => {
                          const val = e.target.value.replace(/^@+/, '');
                          setUsername(val);
                          if (signupErrors.username) {
                            setSignupErrors((prev) => ({
                              ...prev,
                              username: validateUsername(val),
                            }));
                          }
                        }}
                        onBlur={() =>
                          setSignupErrors((prev) => ({
                            ...prev,
                            username: validateUsername(username),
                          }))
                        }
                        placeholder="alex.researcher"
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
                      />
                    </div>
                    {signupErrors.username && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-200">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{signupErrors.username}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 4: Password with Eye Toggle & 8-Character Strength Check */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="signup-password" className="text-xs font-semibold text-white/90">
                        Password
                      </label>
                      {passwordStrength.label && (
                        <span
                          className={`text-[11px] font-bold ${
                            passwordStrength.meetsMinLength ? 'text-emerald-200' : 'text-amber-200'
                          }`}
                        >
                          {passwordStrength.label}
                        </span>
                      )}
                    </div>
                    <div
                      className={`group flex items-center gap-2.5 rounded-2xl border bg-white/15 px-3.5 py-2.5 transition-all duration-200 focus-within:bg-white/25 focus-within:ring-2 focus-within:ring-white/70 ${
                        signupErrors.password ? 'border-rose-300 bg-rose-950/30' : 'border-white/25 hover:border-white/45'
                      }`}
                    >
                      <Lock className="h-4 w-4 shrink-0 text-white/75 transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-white" />
                      <input
                        id="signup-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={(e) => {
                          setSignupPassword(e.target.value);
                          if (signupErrors.password) {
                            setSignupErrors((prev) => ({
                              ...prev,
                              password:
                                e.target.value.length < 8
                                  ? 'Password must be at least 8 characters long.'
                                  : '',
                            }));
                          }
                        }}
                        placeholder="Minimum 8 characters"
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowSignupPassword((v) => !v)}
                        className="rounded-lg p-1 text-white/75 transition hover:bg-white/15 hover:text-white"
                      >
                        {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* 4-segment Password Strength Indicator */}
                    {signupPassword.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 rounded-full transition-all duration-300 ${
                              passwordStrength.score >= level ? passwordStrength.barColor : 'bg-white/20'
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {signupErrors.password && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-200">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{signupErrors.password}</span>
                      </p>
                    )}
                  </div>

                  {/* Create Account Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-pink-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Card Footer Switch Prompt */}
          <div className="mt-5 border-t border-white/20 pt-4 text-center text-xs text-white/80">
            {mode === 'login' ? (
              <span>
                New to ResearchMate AI?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-bold text-white underline decoration-amber-300 underline-offset-2 hover:text-amber-200"
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-white underline decoration-amber-300 underline-offset-2 hover:text-amber-200"
                >
                  Log in here
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Optional Quick Guest Preview Entry below the Glass Card */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() =>
              onAuthenticated?.({
                id: 'guest-demo',
                username: 'guest_researcher',
                gmail: 'guest@gmail.com',
                phone: '+10000000000',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/20 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md transition hover:bg-white/20 hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Continue as Guest Researcher</span>
          </button>
        </div>
      </div>
    </div>
  );
}
