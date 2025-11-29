/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EmailVerificationProps {
    email: string;
    onBackToLogin: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ email, onBackToLogin }) => {
    return (
        <div
            className="w-full h-screen flex flex-col bg-[#111111] bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/auth_bg_bw.png')" }}
        >
            {/* Header */}
            <header className="w-full bg-transparent py-6 px-8">
                <h1 className="text-2xl font-bold text-white tracking-wide">FormLab</h1>
            </header>

            {/* Main Content - Centered Card */}
            <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-md">
                    <div className="w-full h-auto flex items-center justify-center p-8 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                        {/* Verification Message */}
                        <div className="w-full">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-white">
                                    Verify Your Email
                                </h2>
                                <p className="text-sm text-gray-300 mt-2">
                                    We've sent a verification link to
                                </p>
                                <p className="text-sm font-bold text-white underline mt-1">
                                    {email}
                                </p>
                            </div>

                            {/* Info Box */}
                            <div className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-4 mb-6">
                                <p className="text-sm text-gray-300 mb-3">
                                    Please check your inbox and click the verification link to activate your account.
                                </p>
                                <p className="text-xs text-gray-400">
                                    After verifying your email, you can sign in to access FormLab.
                                </p>
                            </div>

                            {/* Sign In Button */}
                            <button
                                onClick={onBackToLogin}
                                className="w-full py-2.5 bg-[#318CE7] text-white text-sm font-medium rounded-lg hover:bg-[#2a7bc9] transition-colors duration-200"
                            >
                                Sign In
                            </button>

                            {/* Help Text */}
                            <p className="mt-4 text-center text-xs text-gray-400">
                                Didn't receive the email? Check your spam folder or contact support.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="w-full bg-black/30 backdrop-blur-xl border-t border-white/10 py-4 px-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-sm text-gray-300">
                    {/* Left side - Legal notice */}
                    <p className="text-left">
                        Use FormLab responsibly. Avoid uploading or generating unlawful or inappropriate content.
                    </p>

                    {/* Right side - Copyright and links */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-0">
                        <span className="whitespace-nowrap">© 2025 FormLab. All rights reserved.</span>
                        <span className="hidden lg:inline mx-2">|</span>
                        <a
                            href="#"
                            className="hover:underline transition-all duration-200"
                        >
                            Terms & Privacy
                        </a>
                        <span className="hidden lg:inline mx-2">|</span>
                        <a
                            href="#"
                            className="hover:underline transition-all duration-200"
                        >
                            Cookie Preferences
                        </a>
                        <span className="hidden lg:inline mx-2">|</span>
                        <a
                            href="#"
                            className="hover:underline transition-all duration-200"
                        >
                            Support
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default EmailVerification;
