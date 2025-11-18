/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CubeIcon } from './icons';
import { SparklesCore } from './ui/sparkles';

interface EmailVerificationProps {
    email: string;
    onBackToLogin: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ email, onBackToLogin }) => {
    return (
        <div className="w-full h-screen flex items-center justify-center bg-[#111111]">
            <div className="w-full h-full flex flex-col lg:flex-row">
                {/* Verification Message */}
                <div className="w-full lg:w-1/2 h-auto lg:h-full flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-100">Verify Your Email</h2>
                            <p className="text-md text-gray-400 mt-2">
                                We've sent a verification email to
                            </p>
                            <p className="text-lg font-semibold text-blue-400 mt-2">{email}</p>
                        </div>

                        <div className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-6 mb-6">
                            <p className="text-sm text-gray-300 mb-4">
                                Please check your inbox and click the verification link to activate your account.
                            </p>
                            <p className="text-xs text-gray-400">
                                After verifying your email, you can log in to access FormLab.
                            </p>
                        </div>

                        <button
                            onClick={onBackToLogin}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
                        >
                            Login
                        </button>

                        <div className="mt-6 text-center text-xs text-gray-500">
                            Didn't receive the email? Check your spam folder or contact support.
                        </div>
                    </div>
                </div>

                {/* Brand Panel */}
                <div className="w-full lg:w-1/2 h-1/4 lg:h-full flex flex-col items-center justify-center bg-black relative p-8">
                    <div className="absolute inset-0 z-0">
                        <SparklesCore
                            background="transparent"
                            minSize={0.4}
                            maxSize={1.4}
                            particleDensity={50}
                            className="w-full h-full"
                            particleColor="#FFFFFF"
                        />
                    </div>
                    <div className="text-center z-10">
                        <CubeIcon className="w-16 h-16 text-white mx-auto mb-4" />
                        <h1 className="text-4xl font-bold text-white tracking-wide">FormLab</h1>
                        <p className="text-lg text-gray-400 mt-2">The Future of Brand Content is Here.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailVerification;
