# /backend/registry_check.py
import requests
import ast

def check_pypi(package_name):
    """
    Returns TRUE if package exists on PyPI.
    Returns FALSE if it is a hallucination.
    """
    url = f"https://pypi.org/pypi/{package_name}/json"
    response = requests.get(url)
    return response.status_code == 200

def extract_imports(code_snippet):
    """
    Parses Python code and finds all 'import' statements.
    """
    libraries = []
    try:
        tree = ast.parse(code_snippet)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    libraries.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                libraries.append(node.module)
    except SyntaxError:
        pass # Code might be incomplete
    return libraries

def scan_code_dependencies(code_snippet):
    libs = extract_imports(code_snippet)
    results = []
    
    for lib in libs:
        # Skip standard library modules (os, sys, etc)
        # In production, use stdlib_list to filter these
        if lib in ["os", "sys", "json", "math"]: 
            continue
            
        exists = check_pypi(lib)
        results.append({
            "library": lib,
            "status": "VERIFIED" if exists else "VOID (Potential Hallucination)",
            "risk": "LOW" if exists else "CRITICAL"
        })
        
    return results
