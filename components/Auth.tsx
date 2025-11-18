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
        <div className="w-full h-screen flex items-center justify-center bg-[#111111]">
            <div className="w-full h-full flex flex-col lg:flex-row">
                {/* Auth Form */}
                <div className="w-full lg:w-1/2 h-auto lg:h-full flex items-center justify-center p-4">
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

export default Auth;
