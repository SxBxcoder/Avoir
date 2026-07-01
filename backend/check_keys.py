#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Avoir - AWS Credentials Verification Script
Checks if AWS credentials are properly loaded from .env file
"""

import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

def check_credentials():
    """Verify AWS credentials are available."""
    print("\n" + "="*60)
    print("🔐 AWS CREDENTIALS VERIFICATION")
    print("="*60 + "\n")
    
    # Check for .env file
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        print(f"✅ .env file found at: {env_file}")
    else:
        print(f"❌ .env file NOT FOUND at: {env_file}")
        print(f"   Create a .env file with your AWS credentials")
        return False
    
    # Check required environment variables
    required_vars = {
        'AWS_ACCESS_KEY_ID': os.getenv('AWS_ACCESS_KEY_ID'),
        'AWS_SECRET_ACCESS_KEY': os.getenv('AWS_SECRET_ACCESS_KEY'),
        'AWS_REGION': os.getenv('AWS_REGION', 'us-east-1')
    }
    
    optional_vars = {
        'AWS_SESSION_TOKEN': os.getenv('AWS_SESSION_TOKEN')
    }
    
    all_found = True
    
    print("\n📋 Required Credentials:")
    print("-" * 60)
    for var_name, var_value in required_vars.items():
        if var_value:
            # Mask the value for security
            if var_name == 'AWS_REGION':
                masked_value = var_value
            else:
                masked_value = var_value[:8] + "..." + var_value[-4:] if len(var_value) > 12 else "***"
            print(f"✅ {var_name}: {masked_value}")
        else:
            print(f"❌ {var_name}: NOT FOUND")
            all_found = False
    
    print("\n📋 Optional Credentials:")
    print("-" * 60)
    for var_name, var_value in optional_vars.items():
        if var_value:
            masked_value = var_value[:8] + "..." + var_value[-4:] if len(var_value) > 12 else "***"
            print(f"✅ {var_name}: {masked_value}")
        else:
            print(f"ℹ️  {var_name}: Not set (only needed for temporary credentials)")
    
    # Final status
    print("\n" + "="*60)
    if all_found:
        print("✅ CREDENTIALS STATUS: FOUND")
        print("="*60 + "\n")
        print("🎉 All required AWS credentials are properly configured!")
        print("🚀 You can now run the agent with: python test_agent.py")
        return True
    else:
        print("❌ CREDENTIALS STATUS: NOT FOUND")
        print("="*60 + "\n")
        print("⚠️  Missing required AWS credentials!")
        print("\n📝 To fix this, create a .env file in the backend folder with:")
        print("""
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
        """)
        print("🔗 Get your credentials from: https://console.aws.amazon.com/iam/")
        return False


if __name__ == "__main__":
    success = check_credentials()
    exit(0 if success else 1)
