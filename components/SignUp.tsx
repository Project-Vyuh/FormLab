/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { signUpWithEmail, signInWithGoogle } from '../services/authService';
import Spinner from './Spinner';
import EmailVerification from './EmailVerification';

interface SignUpProps {
    onSwitchToSignIn: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSwitchToSignIn }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showEmailField, setShowEmailField] = useState(false);
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    const handleNameContinue = (e: React.FormEvent) => {
        e.preventDefault();
        if (firstName && lastName) {
            setShowEmailField(true);
        }
    };

    const handleEmailContinue = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            setShowPasswordFields(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            const fullName = `${firstName} ${lastName}`;
            const userEmail = await signUpWithEmail(email, password, fullName);
            // Show verification screen
            setRegisteredEmail(userEmail);
            setShowVerification(true);
        } catch (err: any) {
            if (err.message === 'User already exists. Sign in?') {
                setError(
                    <span>
                        User already exists.{' '}
                        <button
                            onClick={onSwitchToSignIn}
                            className="underline hover:text-red-300"
                        >
                            Sign in?
                        </button>
                    </span>
                );
            } else {
                setError(err.message || 'An error occurred during sign up');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        setError(null);
        setIsLoading(true);

        try {
            await signInWithGoogle();
            // User state will be handled by onAuthStateChanged in App.tsx
        } catch (err: any) {
            setError(err.message || 'An error occurred during Google sign up');
        } finally {
            setIsLoading(false);
        }
    };

    // Show verification screen if registration was successful
    if (showVerification) {
        return <EmailVerification email={registeredEmail} onBackToLogin={onSwitchToSignIn} />;
    }

    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white">Your Studio for Hyperreal Fashion Visuals</h2>
                <p className="text-sm text-gray-300 mt-2">Create your FormLab account</p>
            </div>

            {error && (
                <div className="text-xs text-center mb-4 p-3 rounded-lg bg-red-500/10 text-white border border-red-500/20">
                    {error}
                </div>
            )}

            {/* Google Sign Up Button */}
            <button
                onClick={handleGoogleSignUp}
                disabled={isLoading}
                className="w-full py-2.5 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-300 text-sm"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLoading ? <Spinner /> : 'Sign up with Google'}
            </button>

            {/* OR Divider */}
            <div className="relative my-5">
                <div className="relative flex justify-center text-xs">
                    <span className="text-gray-400">OR</span>
                </div>
            </div>

            {/* Multi-step Form */}
            <form onSubmit={showPasswordFields ? handleSubmit : (showEmailField ? handleEmailContinue : handleNameContinue)} className="space-y-3">
                {/* Name Field(s) */}
                {!showEmailField ? (
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="First Name"
                            />
                        </div>
                        <div className="relative flex-1">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Last Name"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={`${firstName} ${lastName}`}
                            disabled
                            className="w-full pl-10 pr-20 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[#1f1f1f] disabled:text-white disabled:cursor-not-allowed disabled:opacity-100"
                            placeholder="Full Name"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setShowEmailField(false);
                                setShowPasswordFields(false);
                                setEmail('');
                                setPassword('');
                                setConfirmPassword('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white hover:text-gray-300 font-medium"
                        >
                            Change
                        </button>
                    </div>
                )}

                {!showEmailField ? (
                    <button
                        type="submit"
                        disabled={isLoading || !firstName || !lastName}
                        className="w-full py-2.5 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                    >
                        Continue
                    </button>
                ) : (
                    <>
                        {/* Email Field */}
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={showPasswordFields}
                                className="w-full pl-10 pr-20 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[#1f1f1f] disabled:text-white disabled:cursor-not-allowed disabled:opacity-100"
                                placeholder="Email"
                                style={{
                                    WebkitTextFillColor: 'white',
                                    WebkitBoxShadow: '0 0 0px 1000px #1f1f1f inset',
                                    transition: 'background-color 5000s ease-in-out 0s'
                                }}
                            />
                            {showPasswordFields && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordFields(false);
                                        setPassword('');
                                        setConfirmPassword('');
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white hover:text-gray-300 font-medium"
                                >
                                    Change
                                </button>
                            )}
                        </div>

                        {!showPasswordFields ? (
                            <button
                                type="submit"
                                disabled={isLoading || !email}
                                className="w-full py-2.5 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                            >
                                Continue
                            </button>
                        ) : (
                            <>
                                {/* Password Fields */}
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Password"
                                    />
                                </div>

                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Confirm Password"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-2.5 bg-[#318CE7] text-white rounded-lg font-medium hover:bg-[#2a7bc9] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                                >
                                    {isLoading ? <Spinner /> : 'Sign Up'}
                                </button>
                            </>
                        )}
                    </>
                )}
            </form>

            <div className="mt-5 text-center text-sm text-gray-400">
                Already have an account?{' '}
                <button
                    onClick={onSwitchToSignIn}
                    className="text-[#318CE7] hover:text-[#2a7bc9] font-semibold"
                >
                    Sign In
                </button>
            </div>
        </div>
    );
};

export default SignUp;
