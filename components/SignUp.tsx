/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { signUpWithEmail, signInWithGoogle } from '../services/authService';
import Spinner from './Spinner';
import { UserIcon } from './icons';
import EmailVerification from './EmailVerification';

interface SignUpProps {
    onSwitchToSignIn: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSwitchToSignIn }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoURL(reader.result as string);
            };
            reader.readAsDataURL(file);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate passwords match
        if (password !== repeatPassword) {
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
            const userEmail = await signUpWithEmail(email, password, name, photoURL || undefined);
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

    // Show verification screen if registration was successful
    if (showVerification) {
        return <EmailVerification email={registeredEmail} onBackToLogin={onSwitchToSignIn} />;
    }

    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-100">Create Account</h2>
                <p className="text-md text-gray-400 mt-2">Join FormLab and start creating</p>
            </div>

            {error && (
                <div className="text-xs text-center mb-4 p-3 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Profile Photo Upload */}
                <div className="flex flex-col items-center mb-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors overflow-hidden border-2 border-gray-600"
                    >
                        {photoURL ? (
                            <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-12 h-12 text-gray-400" />
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Click to upload profile photo (optional)</p>
                </div>

                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                        Full Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-[#1f1f1f] border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                    />
                </div>

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

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-[#1f1f1f] border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                    />
                </div>

                <div>
                    <label htmlFor="repeatPassword" className="block text-sm font-medium text-gray-300 mb-1">
                        Repeat Password
                    </label>
                    <input
                        id="repeatPassword"
                        type="password"
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-[#1f1f1f] border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? <Spinner /> : 'Sign Up'}
                </button>
            </form>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                    <span className="bg-[#1a1a1a] px-2 text-gray-500">Or continue with</span>
                </div>
            </div>

            <button
                onClick={handleGoogleSignUp}
                disabled={isLoading}
                className="w-full py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-300"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLoading ? <Spinner /> : 'Sign up with Google'}
            </button>

            <div className="mt-6 text-center text-sm text-gray-400">
                Already have an account?{' '}
                <button
                    onClick={onSwitchToSignIn}
                    className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                    Sign In
                </button>
            </div>
        </div>
    );
};

export default SignUp;
