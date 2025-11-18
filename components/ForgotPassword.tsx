/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { resetPassword } from '../services/authService';
import Spinner from './Spinner';
import PasswordResetSent from './PasswordResetSent';

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
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-100">Reset Password</h2>
                <p className="text-md text-gray-400 mt-2">
                    Enter your email to receive a password reset link
                </p>
            </div>

            {error && (
                <div className="text-xs text-center mb-4 p-3 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                        Email Address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-[#1f1f1f] border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="you@example.com"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? <Spinner /> : 'Get Reset Link'}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-400">
                Remember your password?{' '}
                <button
                    onClick={onBackToSignIn}
                    className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                    Sign In
                </button>
            </div>
        </div>
    );
};

export default ForgotPassword;
