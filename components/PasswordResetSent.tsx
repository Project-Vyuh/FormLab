/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CubeIcon } from './icons';
import { SparklesCore } from './ui/sparkles';

interface PasswordResetSentProps {
    email: string;
    onBackToSignIn: () => void;
}

const PasswordResetSent: React.FC<PasswordResetSentProps> = ({ email, onBackToSignIn }) => {
    return (
        <div className="w-full h-screen flex items-center justify-center bg-[#111111]">
            <div className="w-full h-full flex flex-col lg:flex-row">
                {/* Reset Sent Message */}
                <div className="w-full lg:w-1/2 h-auto lg:h-full flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-100">Check Your Email</h2>
                            <p className="text-md text-gray-400 mt-2">
                                We sent you a password change link to
                            </p>
                            <p className="text-lg font-semibold text-blue-400 mt-2">{email}</p>
                        </div>

                        <div className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-6 mb-6">
                            <p className="text-sm text-gray-300 mb-4">
                                Click the link in the email to reset your password.
                            </p>
                            <p className="text-xs text-gray-400">
                                After resetting your password, you can sign in with your new credentials.
                            </p>
                        </div>

                        <button
                            onClick={onBackToSignIn}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
                        >
                            Sign In
                        </button>

                        <div className="mt-6 text-center text-xs text-gray-500">
                            Didn't receive the email? Check your spam folder or try again.
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

export default PasswordResetSent;
