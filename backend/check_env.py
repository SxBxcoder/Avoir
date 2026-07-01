#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Avoir - Environment Dependency Checker
Verifies all required modules are installed and provides fix commands
"""

import sys
import importlib
from typing import List, Tuple

# Core modules required for Avoir
REQUIRED_MODULES = [
    # Web Framework
    ('fastapi', 'pip install fastapi>=0.115.0'),
    ('uvicorn', 'pip install uvicorn[standard]>=0.32.0'),
    ('pydantic', 'pip install pydantic>=2.10.0'),
    
    # AWS SDK
    ('boto3', 'pip install boto3>=1.35.0'),
    ('botocore', 'pip install botocore>=1.35.0'),
    
    # Agentic AI Framework
    ('strands', 'pip install strands-agents>=1.26.0'),
    
    # Utilities
    ('dotenv', 'pip install python-dotenv>=1.0.1'),
    
    # Additional (usually auto-installed)
    ('httpx', 'pip install httpx'),
    ('starlette', 'pip install starlette'),
    ('anyio', 'pip install anyio'),
]

# Optional modules (nice to have but not critical)
OPTIONAL_MODULES = [
    ('opentelemetry', 'pip install opentelemetry-api'),
    ('mcp', 'pip install mcp'),
]


def check_module(module_name: str, install_command: str) -> Tuple[bool, str]:
    """
    Check if a module can be imported.
    
    Args:
        module_name: Name of the module to import
        install_command: Command to install the module
    
    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        # Try to import the module
        importlib.import_module(module_name)
        return True, f"✅ [{module_name.upper()}] LOADED"
    except ImportError as e:
        return False, f"❌ [{module_name.upper()}] MISSING - Run: {install_command}"
    except Exception as e:
        return False, f"⚠️  [{module_name.upper()}] ERROR - {str(e)}"


def check_python_version() -> Tuple[bool, str]:
    """Check if Python version is compatible."""
    version = sys.version_info
    if version.major == 3 and version.minor >= 11:
        return True, f"✅ [PYTHON] Version {version.major}.{version.minor}.{version.micro}"
    else:
        return False, f"❌ [PYTHON] Version {version.major}.{version.minor}.{version.micro} (Need 3.11+)"


def main():
    """Run comprehensive environment check."""
    print("\n" + "="*70)
    print("🔍 AVOIR ENVIRONMENT DEPENDENCY CHECKER")
    print("="*70 + "\n")
    
    # Check Python version
    print("📋 Python Version Check:")
    print("-" * 70)
    py_ok, py_msg = check_python_version()
    print(py_msg)
    
    if not py_ok:
        print("\n⚠️  WARNING: Python 3.11+ is recommended for best compatibility")
        print("   Download from: https://www.python.org/downloads/\n")
    
    # Check required modules
    print("\n📦 Required Modules:")
    print("-" * 70)
    
    required_results = []
    for module_name, install_cmd in REQUIRED_MODULES:
        success, message = check_module(module_name, install_cmd)
        print(message)
        required_results.append((module_name, success, install_cmd))
    
    # Check optional modules
    print("\n📦 Optional Modules:")
    print("-" * 70)
    
    optional_results = []
    for module_name, install_cmd in OPTIONAL_MODULES:
        success, message = check_module(module_name, install_cmd)
        print(message)
        optional_results.append((module_name, success, install_cmd))
    
    # Summary
    print("\n" + "="*70)
    print("📊 SUMMARY")
    print("="*70 + "\n")
    
    required_ok = sum(1 for _, success, _ in required_results if success)
    required_total = len(required_results)
    optional_ok = sum(1 for _, success, _ in optional_results if success)
    optional_total = len(optional_results)
    
    print(f"Required Modules: {required_ok}/{required_total} ✅")
    print(f"Optional Modules: {optional_ok}/{optional_total} ✅")
    
    # Check if all required modules are present
    all_required_ok = required_ok == required_total
    
    if all_required_ok:
        print("\n✅ ALL REQUIRED DEPENDENCIES INSTALLED!")
        print("="*70 + "\n")
        print("🎉 Your environment is ready to run Avoir!")
        print("\n📝 Next steps:")
        print("   1. Configure AWS credentials: python check_keys.py")
        print("   2. Test the agent: python test_agent.py")
        print("   3. Start the server: python server.py")
        print()
        return 0
    else:
        print("\n❌ MISSING REQUIRED DEPENDENCIES")
        print("="*70 + "\n")
        print("🔧 To fix, run these commands:\n")
        
        # Print install commands for missing modules
        for module_name, success, install_cmd in required_results:
            if not success:
                print(f"   {install_cmd}")
        
        print("\n💡 Or install all at once:")
        print("   pip install -r requirements.txt")
        print()
        
        # Additional troubleshooting
        print("🔍 Troubleshooting:")
        print("   - Ensure pip is up to date: python -m pip install --upgrade pip")
        print("   - Use virtual environment: python -m venv .venv")
        print("   - Activate venv (Windows): .venv\\Scripts\\activate")
        print("   - Activate venv (Unix): source .venv/bin/activate")
        print()
        
        return 1


def check_specific_imports():
    """Check specific imports used in the application."""
    print("\n" + "="*70)
    print("🔬 DETAILED IMPORT CHECK")
    print("="*70 + "\n")
    
    specific_imports = [
        ('fastapi', 'FastAPI', 'from fastapi import FastAPI'),
        ('fastapi', 'HTTPException', 'from fastapi import HTTPException'),
        ('fastapi.middleware.cors', 'CORSMiddleware', 'from fastapi.middleware.cors import CORSMiddleware'),
        ('pydantic', 'BaseModel', 'from pydantic import BaseModel'),
        ('uvicorn', 'run', 'import uvicorn'),
        ('boto3', 'client', 'import boto3'),
        ('strands', 'Agent', 'from strands import Agent'),
        ('strands', 'tool', 'from strands import tool'),
        ('dotenv', 'load_dotenv', 'from dotenv import load_dotenv'),
    ]
    
    print("Testing specific imports used in application:\n")
    
    all_ok = True
    for module, attr, import_statement in specific_imports:
        try:
            mod = importlib.import_module(module)
            if hasattr(mod, attr):
                print(f"✅ {import_statement}")
            else:
                print(f"⚠️  {import_statement} - Attribute '{attr}' not found")
                all_ok = False
        except ImportError:
            print(f"❌ {import_statement} - Module not found")
            all_ok = False
    
    if all_ok:
        print("\n✅ All specific imports working correctly!")
    else:
        print("\n⚠️  Some imports failed - check module versions")
    
    return all_ok


if __name__ == "__main__":
    try:
        # Run main check
        exit_code = main()
        
        # Run detailed import check if main check passed
        if exit_code == 0:
            check_specific_imports()
        
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Check interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error during check: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
