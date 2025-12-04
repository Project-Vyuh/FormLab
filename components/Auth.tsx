/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ForgotPassword from './ForgotPassword';
import { CubeIcon } from './icons';
import { SparklesCore } from './ui/sparkles';

const Auth: React.FC = () => {
    const [isSignIn, setIsSignIn] = useState(true);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

    return (
        <div className="w-full h-screen flex flex-col bg-[#111111] relative overflow-hidden">
            {/* Video Background */}
            <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover z-0"
            >
                <source src="/assets/FormLab_bg.mp4" type="video/mp4" />
            </video>

            {/* Overlay for better text readability */}
            <div className="absolute top-0 left-0 w-full h-full bg-black/20 z-[1]"></div>

            {/* Header */}
            <header className="w-full bg-transparent py-6 px-8 relative z-10">
                <h1 className="text-2xl font-bold text-white tracking-wide">FormLab</h1>
            </header>

            {/* Auth Container */}
            <div className="flex-1 flex items-center justify-center relative z-10">
                <div className="w-full max-w-md">
                    {/* Auth Form */}
                    <div className="w-full h-auto flex items-center justify-center p-8 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                        {showForgotPassword ? (
                            <ForgotPassword
                                initialEmail={forgotPasswordEmail}
                                onBackToSignIn={() => {
                                    setShowForgotPassword(false);
                                    setIsSignIn(true);
                                }}
                            />
                        ) : isSignIn ? (
                            <SignIn
                                onSwitchToSignUp={() => setIsSignIn(false)}
                                onForgotPassword={(email) => {
                                    setForgotPasswordEmail(email);
                                    setShowForgotPassword(true);
                                }}
                            />
                        ) : (
                            <SignUp onSwitchToSignIn={() => setIsSignIn(true)} />
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="w-full bg-black/30 backdrop-blur-xl border-t border-white/10 py-4 px-8 relative z-10">
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

export default Auth;
