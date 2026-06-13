// AWS Amplify Auth Configuration
// This is like your passport.js config in MERN, but for AWS Cognito

import { Amplify } from 'aws-amplify';

// Configure Amplify with your Cognito User Pool
// You'll get these values after creating a Cognito User Pool in AWS Console
export function configureAuth() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
        loginWith: {
          email: true, // Users login with email (like username in MERN)
        },
        signUpVerificationMethod: 'code', // Email verification code
        userAttributes: {
          email: { required: true },
          'custom:brand_name': { required: false }, // Custom field for brand name
        } as any,
        passwordFormat: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true,
        },
      },
    },
  });
}
