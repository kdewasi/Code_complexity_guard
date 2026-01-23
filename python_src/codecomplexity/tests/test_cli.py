"""Tests for CLI commands."""

import os
import sys
import subprocess
import tempfile
import pytest


def run_cli(*args):
    """Run CLI command and return result."""
    cmd = [sys.executable, '-m', 'codecomplexity.cli'] + list(args)
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    )
    if result.returncode != 0:
        print(f"Command failed: {cmd}")
        # print(f"STDOUT: {result.stdout}")
        try:
            print(f"STDERR: {result.stderr.encode('ascii', 'replace').decode('ascii')}")
        except:
            print("Could not print stderr")
    return result


def test_analyze_valid_file():
    """Test analyze command with a valid file."""
    # Create a temporary test file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def simple_function():
    return 42
""")
        temp_file = f.name
    
    try:
        result = run_cli('analyze', temp_file)
        assert result.returncode == 0
        assert 'simple_function' in result.stdout
        assert 'Complexity' in result.stdout
    finally:
        os.unlink(temp_file)


def test_analyze_file_not_found():
    """Test analyze command with non-existent file."""
    result = run_cli('analyze', 'nonexistent_file.py')
    assert result.returncode == 2
    assert 'ERROR' in result.stderr
    assert 'not found' in result.stderr


def test_analyze_not_python_file():
    """Test analyze command with non-Python file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write("Not Python code")
        temp_file = f.name
    
    try:
        result = run_cli('analyze', temp_file)
        assert result.returncode == 2
        assert 'ERROR' in result.stderr
        assert 'Python file' in result.stderr
    finally:
        os.unlink(temp_file)


def test_analyze_with_detailed_flag():
    """Test analyze command with --detailed flag."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def function_with_if(x):
    if x > 0:
        return x
    return 0
""")
        temp_file = f.name
    
    try:
        result = run_cli('analyze', temp_file, '--detailed')
        assert result.returncode == 0
        assert 'Decision Points' in result.stdout or 'decision' in result.stdout.lower()
    finally:
        os.unlink(temp_file)


def test_analyze_with_json_flag():
    """Test analyze command with --json flag."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def simple():
    return 1
""")
        temp_file = f.name
    
    try:
        result = run_cli('analyze', temp_file, '--json')
        assert result.returncode == 0
        # Should be valid JSON
        import json
        data = json.loads(result.stdout)
        assert 'file' in data
        assert 'functions' in data
        assert 'avg_complexity' in data
    finally:
        os.unlink(temp_file)


def test_analyze_with_threshold():
    """Test analyze command with custom threshold."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def complex_function(x):
    if x > 0:
        if x > 10:
            if x > 20:
                return x
    return 0
""")
        temp_file = f.name
    
    try:
        # Should exceed threshold of 2
        result = run_cli('analyze', temp_file, '--threshold', '2')
        assert result.returncode == 1  # Threshold exceeded
    finally:
        os.unlink(temp_file)


def test_analyze_exit_code_success():
    """Test analyze command returns 0 for low complexity."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def simple():
    return 42
""")
        temp_file = f.name
    
    try:
        result = run_cli('analyze', temp_file)
        assert result.returncode == 0
    finally:
        os.unlink(temp_file)


def test_suggest_valid_function():
    """Test suggest command with valid function."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def test_function(x, y, z):
    if not x:
        raise ValueError()
    if not y:
        raise ValueError()
    if not z:
        raise ValueError()
    return x + y + z
""")
        temp_file = f.name
    
    try:
        result = run_cli('suggest', temp_file, '--function', 'test_function')
        assert result.returncode == 0
        assert 'REFACTORING SUGGESTIONS' in result.stdout
        assert 'test_function' in result.stdout
    finally:
        os.unlink(temp_file)


def test_suggest_function_not_found():
    """Test suggest command with non-existent function."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def existing_function():
    return 42
""")
        temp_file = f.name
    
    try:
        result = run_cli('suggest', temp_file, '--function', 'nonexistent')
        assert result.returncode == 1
        assert 'ERROR' in result.stderr
        assert 'not found' in result.stderr
    finally:
        os.unlink(temp_file)


def test_suggest_file_not_found():
    """Test suggest command with non-existent file."""
    result = run_cli('suggest', 'nonexistent.py', '--function', 'test')
    assert result.returncode == 2
    assert 'ERROR' in result.stderr


def test_help_message():
    """Test that help message works."""
    result = run_cli('--help')
    assert result.returncode == 0
    assert 'codecomplexity' in result.stdout
    assert 'analyze' in result.stdout


def test_version():
    """Test version flag."""
    result = run_cli('--version')
    assert result.returncode == 0
    assert '0.1.0' in result.stdout


def test_analyze_help():
    """Test analyze command help."""
    result = run_cli('analyze', '--help')
    assert result.returncode == 0
    assert 'analyze' in result.stdout
    assert 'filepath' in result.stdout


def test_suggest_help():
    """Test suggest command help."""
    result = run_cli('suggest', '--help')
    assert result.returncode == 0
    assert 'suggest' in result.stdout
    assert 'function' in result.stdout


if __name__ == '__main__':
    print("=" * 80)
    print("Running CLI Tests")
    print("=" * 80)
    
    test_analyze_valid_file()
    print("✓ Analyze valid file test passed")
    
    test_analyze_file_not_found()
    print("✓ Analyze file not found test passed")
    
    test_analyze_not_python_file()
    print("✓ Analyze not Python file test passed")
    
    test_analyze_with_detailed_flag()
    print("✓ Analyze with detailed flag test passed")
    
    test_analyze_with_json_flag()
    print("✓ Analyze with JSON flag test passed")
    
    test_analyze_with_threshold()
    print("✓ Analyze with threshold test passed")
    
    test_analyze_exit_code_success()
    print("✓ Analyze exit code test passed")
    
    test_suggest_valid_function()
    print("✓ Suggest valid function test passed")
    
    test_suggest_function_not_found()
    print("✓ Suggest function not found test passed")
    
    test_suggest_file_not_found()
    print("✓ Suggest file not found test passed")
    
    test_help_message()
    print("✓ Help message test passed")
    
    test_version()
    print("✓ Version test passed")
    
    test_analyze_help()
    print("✓ Analyze help test passed")
    
    test_suggest_help()
    print("✓ Suggest help test passed")
    
    print("=" * 80)
    print("All CLI tests passed! ✓")
    print("=" * 80)
