/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { resetPassword } from '../services/authService';
import Spinner from './Spinner';
import PasswordResetSent from './PasswordResetSent.tsx';

interface ForgotPasswordProps {
    initialEmail?: string;
    onBackToSignIn: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ initialEmail = '', onBackToSignIn }) => {
    const [email, setEmail] = useState(initialEmail);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await resetPassword(email);
            setResetSent(true);
        } catch (err: any) {
            setError(err.message || 'An error occurred while sending reset email');
        } finally {
            setIsLoading(false);
        }
    };

    if (resetSent) {
        return <PasswordResetSent email={email} onBackToSignIn={onBackToSignIn} />;
    }

    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white">Reset Password</h2>
                <p className="text-sm text-gray-300 mt-2">
                    Enter your email to receive a password reset link
                </p>
            </div>

            {error && (
                <div className="text-xs text-center mb-4 p-3 rounded-lg bg-red-500/10 text-white border border-red-500/20">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1f1f1f] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Email Address"
                        style={{
                            WebkitTextFillColor: 'white',
                            WebkitBoxShadow: '0 0 0px 1000px #1f1f1f inset',
                            transition: 'background-color 5000s ease-in-out 0s'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 bg-[#318CE7] text-white rounded-lg font-medium hover:bg-[#2a7bc9] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                >
                    {isLoading ? <Spinner /> : 'Get Reset Link'}
                </button>
            </form>

            <div className="mt-5 text-center text-sm text-gray-400">
                Remember your password?{' '}
                <button
                    onClick={onBackToSignIn}
                    className="text-[#318CE7] hover:text-[#2a7bc9] font-semibold"
                >
                    Sign In
                </button>
            </div>
        </div>
    );
};

export default ForgotPassword;
