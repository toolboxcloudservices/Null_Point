"""
The Void Registry - Dependency Check Module
Checks if generated code imports are from real packages
"""

import re
import requests
from typing import Dict, Any, List, Set
import time

# Cache for package checks to avoid rate limiting
package_cache = {}
CACHE_TTL = 3600  # 1 hour


def extract_python_imports(code: str) -> Set[str]:
    """Extract Python package names from import statements"""
    imports = set()
    
    # Match: import package, import package.module, from package import ...
    patterns = [
        r'^import\s+([a-zA-Z0-9_]+)',
        r'^from\s+([a-zA-Z0-9_]+)\s+import',
    ]
    
    for line in code.split('\n'):
        line = line.strip()
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                package_name = match.group(1)
                # Filter out standard library modules
                if not package_name.startswith('_'):
                    imports.add(package_name)
    
    return imports


def extract_javascript_imports(code: str) -> Set[str]:
    """Extract JavaScript/TypeScript package names from import statements"""
    imports = set()
    
    # Match: import ... from 'package', require('package')
    patterns = [
        r"from\s+['\"]([^'\"]+)['\"]",
        r"require\(['\"]([^'\"]+)['\"]\)",
        r"import\s+['\"]([^'\"]+)['\"]",
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, code)
        for match in matches:
            # Remove path prefixes (e.g., './', '../', '@scope/')
            package_name = match.split('/')[0].replace('@', '')
            if package_name and not package_name.startswith('.'):
                imports.add(package_name)
    
    return imports


def check_pypi_package(package_name: str) -> Dict[str, Any]:
    """Check if a Python package exists on PyPI"""
    # Check cache first
    if package_name in package_cache:
        cached = package_cache[package_name]
        if time.time() - cached['timestamp'] < CACHE_TTL:
            return cached['result']
    
    try:
        url = f"https://pypi.org/pypi/{package_name}/json"
        response = requests.get(url, timeout=5)
        result = {
            "exists": response.status_code == 200,
            "verified": True,
            "source": "pypi"
        }
        
        # Cache the result
        package_cache[package_name] = {
            "result": result,
            "timestamp": time.time()
        }
        
        return result
    except Exception as e:
        # If check fails, mark as unverified
        return {
            "exists": False,
            "verified": False,
            "error": str(e),
            "source": "pypi"
        }


def check_npm_package(package_name: str) -> Dict[str, Any]:
    """Check if a JavaScript package exists on NPM"""
    # Check cache first
    if package_name in package_cache:
        cached = package_cache[package_name]
        if time.time() - cached['timestamp'] < CACHE_TTL:
            return cached['result']
    
    try:
        url = f"https://registry.npmjs.org/{package_name}"
        response = requests.get(url, timeout=5)
        result = {
            "exists": response.status_code == 200,
            "verified": True,
            "source": "npm"
        }
        
        # Cache the result
        package_cache[package_name] = {
            "result": result,
            "timestamp": time.time()
        }
        
        return result
    except Exception as e:
        # If check fails, mark as unverified
        return {
            "exists": False,
            "verified": False,
            "error": str(e),
            "source": "npm"
        }


def check_dependencies(code: str, language: str) -> Dict[str, Any]:
    """
    Check dependencies in generated code.
    
    Args:
        code: The code to analyze
        language: 'python' or 'javascript'
    
    Returns:
        {
            "dependencies": List of found dependencies,
            "void_packages": List of packages that don't exist or are suspicious,
            "verified_packages": List of verified packages,
            "status": "SECURE" | "WARNING" | "VOID"
        }
    """
    if language.lower() == 'python':
        imports = extract_python_imports(code)
        check_func = check_pypi_package
    elif language.lower() in ['javascript', 'typescript', 'js', 'ts']:
        imports = extract_javascript_imports(code)
        check_func = check_npm_package
    else:
        return {
            "dependencies": [],
            "void_packages": [],
            "verified_packages": [],
            "status": "UNKNOWN",
            "error": f"Unsupported language: {language}"
        }
    
    dependencies = []
    void_packages = []
    verified_packages = []
    
    for package_name in imports:
        check_result = check_func(package_name)
        dependency_info = {
            "name": package_name,
            "exists": check_result.get("exists", False),
            "verified": check_result.get("verified", False),
            "source": check_result.get("source", "unknown")
        }
        
        dependencies.append(dependency_info)
        
        if not check_result.get("exists", False):
            void_packages.append(dependency_info)
        else:
            verified_packages.append(dependency_info)
    
    # Determine overall status
    if void_packages:
        status = "VOID"
    elif not verified_packages:
        status = "WARNING"
    else:
        status = "SECURE"
    
    return {
        "dependencies": dependencies,
        "void_packages": void_packages,
        "verified_packages": verified_packages,
        "status": status,
        "language": language
    }
