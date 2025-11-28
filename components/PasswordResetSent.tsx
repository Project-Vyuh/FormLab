/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface PasswordResetSentProps {
    email: string;
    onBackToSignIn: () => void;
}

const PasswordResetSent: React.FC<PasswordResetSentProps> = ({ email, onBackToSignIn }) => {
    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white">Check Your Email</h2>
                <p className="text-sm text-gray-300 mt-2">
                    We sent you a password change link to
                </p>
                <p className="text-base font-medium text-[#318CE7] mt-1">{email}</p>
            </div>

            <div className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-5 mb-5">
                <p className="text-sm text-gray-300 mb-3">
                    Click the link in the email to reset your password.
                </p>
                <p className="text-xs text-gray-400">
                    After resetting your password, you can sign in with your new credentials.
                </p>
            </div>

            <button
                onClick={onBackToSignIn}
                className="w-full py-2.5 bg-[#318CE7] text-white rounded-lg font-medium hover:bg-[#2a7bc9] transition-colors duration-200 text-sm"
            >
                Sign In
            </button>

            <div className="mt-5 text-center text-xs text-gray-500">
                Didn't receive the email? Check your spam folder or try again.
            </div>
        </div>
    );
};

export default PasswordResetSent;
