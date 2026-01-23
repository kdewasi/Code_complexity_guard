"""Tests for cyclomatic complexity analyzer."""

import ast
import os
import tempfile
import pytest
from codecomplexity.analyzers import (
    ComplexityAnalyzer,
    calculate_complexity,
    analyze_file,
)


# Pytest fixtures for common test cases
@pytest.fixture
def simple_function_code():
    """Fixture: Simple function with no branches - Complexity: 1."""
    return """
def simple():
    return 42
"""


@pytest.fixture
def single_if_code():
    """Fixture: Function with single if statement - Complexity: 2."""
    return """
def with_if(x):
    if x > 0:
        return x
    return 0
"""


@pytest.fixture
def nested_ifs_code():
    """Fixture: Function with nested if statements - Complexity: 4."""
    return """
def nested_ifs(x, y, z):
    if x > 0:
        if y > 0:
            if z > 0:
                return x + y + z
    return 0
"""


@pytest.fixture
def complex_realistic_code():
    """Fixture: Complex realistic function with multiple decision points."""
    return """
def process_data(items, threshold=10):
    '''Process a list of items with various conditions.'''
    results = []
    
    if not items:
        return results
    
    for item in items:
        try:
            value = int(item)
            
            if value > threshold and value < 100:
                results.append(value * 2)
            elif value <= threshold or value >= 100:
                results.append(value)
            
            # Comprehension with condition
            squares = [x**2 for x in range(value) if x % 2 == 0]
            
            # Ternary operator
            status = "high" if value > 50 else "low"
            
        except ValueError:
            continue
        except TypeError:
            break
    
    while len(results) > 100:
        results.pop()
    
    return results
"""


def test_simple_function(simple_function_code):
    """Test complexity of a simple function with no branches.
    
    Expected calculation:
    - Base complexity: 1
    - No decision points: +0
    - Total: 1
    """
    tree = ast.parse(simple_function_code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 1, f"Expected complexity 1, got {complexity}"
    assert len(decision_points) == 0, f"Expected 0 decision points, got {len(decision_points)}"


def test_single_if(single_if_code):
    """Test complexity with single if statement.
    
    Expected calculation:
    - Base complexity: 1
    - if statement: +1
    - Total: 2
    """
    tree = ast.parse(single_if_code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 2, f"Expected complexity 2, got {complexity}"
    assert len(decision_points) == 1, f"Expected 1 decision point, got {len(decision_points)}"


def test_nested_ifs(nested_ifs_code):
    """Test complexity with nested if statements.
    
    Expected calculation:
    - Base complexity: 1
    - First if: +1
    - Second nested if: +1
    - Third nested if: +1
    - Total: 4
    
    Note: Each if is counted separately, even when nested.
    """
    tree = ast.parse(nested_ifs_code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    # 1 (base) + 3 (three nested ifs) = 4
    assert complexity == 4, f"Expected complexity 4, got {complexity}"
    assert len(decision_points) == 3, f"Expected 3 decision points, got {len(decision_points)}"


def test_for_loop():
    """Test complexity with for loop.
    
    Expected calculation:
    - Base complexity: 1
    - for loop: +1
    - Total: 2
    """
    code = """
def with_for(items):
    for item in items:
        print(item)
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 2, f"Expected complexity 2, got {complexity}"
    assert len(decision_points) == 1, f"Expected 1 decision point, got {len(decision_points)}"


def test_while_loop():
    """Test complexity with while loop.
    
    Expected calculation:
    - Base complexity: 1
    - while loop: +1
    - Total: 2
    """
    code = """
def with_while():
    i = 0
    while i < 10:
        i += 1
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 2, f"Expected complexity 2, got {complexity}"
    assert len(decision_points) == 1, f"Expected 1 decision point, got {len(decision_points)}"


def test_multiple_branches():
    """Test complexity with multiple if/elif statements.
    
    Expected calculation:
    - Base complexity: 1
    - if: +1
    - elif: +1
    - elif: +1
    - Total: 4
    """
    code = """
def multiple_branches(x):
    if x > 10:
        return "high"
    elif x > 5:
        return "medium"
    elif x > 0:
        return "low"
    return "zero"
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 4, f"Expected complexity 4, got {complexity}"
    assert len(decision_points) == 3, f"Expected 3 decision points, got {len(decision_points)}"


def test_both_loops():
    """Test complexity with both for and while loops.
    
    Expected calculation:
    - Base complexity: 1
    - for loop: +1
    - while loop: +1
    - Total: 3
    """
    code = """
def with_loops(items):
    for item in items:
        print(item)
    
    i = 0
    while i < 10:
        i += 1
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 3, f"Expected complexity 3, got {complexity}"
    assert len(decision_points) == 2, f"Expected 2 decision points, got {len(decision_points)}"


def test_try_except_multiple_clauses():
    """Test complexity with try/except with multiple except clauses.
    
    Expected calculation:
    - Base complexity: 1
    - except ZeroDivisionError: +1
    - except ValueError: +1
    - Total: 3
    """
    code = """
def with_exceptions(x):
    try:
        result = 10 / x
    except ZeroDivisionError:
        result = 0
    except ValueError:
        result = -1
    return result
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 3, f"Expected complexity 3, got {complexity}"
    assert len(decision_points) == 2, f"Expected 2 decision points, got {len(decision_points)}"


def test_boolean_and_operator():
    """Test complexity with 'and' boolean operator.
    
    Expected calculation:
    - Base complexity: 1
    - if statement: +1
    - 'and' with 3 operands (a, b, c): +(3-1) = +2
    - Total: 4
    """
    code = """
def with_bool_ops(a, b, c):
    if a and b and c:
        return True
    return False
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 4, f"Expected complexity 4, got {complexity}"


def test_boolean_or_operator():
    """Test complexity with 'or' boolean operator.
    
    Expected calculation:
    - Base complexity: 1
    - if statement: +1
    - 'or' with 2 operands: +(2-1) = +1
    - Total: 3
    """
    code = """
def with_or(a, b):
    if a or b:
        return True
    return False
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 3, f"Expected complexity 3, got {complexity}"


def test_comprehensions():
    """Test complexity with list and set comprehensions.
    
    Expected calculation:
    - Base complexity: 1
    - List comprehension with if: +1
    - Set comprehension with if: +1
    - Total: 3
    """
    code = """
def with_comprehensions(data):
    evens = [x for x in data if x % 2 == 0]
    odds = {x for x in data if x % 2 != 0}
    return evens, odds
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 3, f"Expected complexity 3, got {complexity}"
    assert len(decision_points) == 2, f"Expected 2 decision points, got {len(decision_points)}"


def test_ternary_operator():
    """Test complexity with ternary operator (conditional expression).
    
    Expected calculation:
    - Base complexity: 1
    - Ternary operator: +1
    - Total: 2
    """
    code = """
def with_ternary(x):
    result = "positive" if x > 0 else "non-positive"
    return result
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 2, f"Expected complexity 2, got {complexity}"
    assert len(decision_points) == 1, f"Expected 1 decision point, got {len(decision_points)}"


def test_complex_realistic_function(complex_realistic_code):
    """Test a complex realistic function with mix of all decision point types.
    
    Expected calculation:
    - Base complexity: 1
    - if not items: +1
    - for loop: +1
    - except ValueError: +1
    - except TypeError: +1
    - if with 'and' (2 operands): +1 (if) +1 (and) = +2
    - elif with 'or' (2 operands): +1 (elif) +1 (or) = +2
    - List comprehension with if: +1
    - Ternary operator: +1
    - while loop: +1
    - Total: 1 + 1 + 1 + 1 + 1 + 2 + 2 + 1 + 1 + 1 = 12
    """
    tree = ast.parse(complex_realistic_code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    # Verify exact complexity
    assert complexity == 12, f"Expected complexity 12, got {complexity}"
    
    # Verify we have the right number of decision points
    assert len(decision_points) == 11, f"Expected 11 decision points, got {len(decision_points)}"
    
    # Verify decision point types are tracked
    point_types = [dp.node_type for dp in decision_points]
    assert 'If' in point_types
    assert 'For' in point_types
    assert 'While' in point_types
    assert 'ExceptHandler' in point_types
    assert 'BoolOp' in point_types
    assert 'Comprehension' in point_types
    assert 'IfExp' in point_types


def test_analyze_file():
    """Test analyzing a complete Python file with analyze_file() function.
    
    This verifies that the file-level analysis works correctly.
    """
    code = """
def simple():
    return 1

def complex_func(x, y):
    if x > 0:
        if y > 0:
            return x + y
    return 0
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name
    
    try:
        results = analyze_file(temp_path)
        
        # Verify file path
        assert results['file'] == temp_path
        
        # Verify function count
        assert len(results['functions']) == 2
        
        # Verify first function
        assert results['functions'][0]['name'] == 'simple'
        assert results['functions'][0]['complexity'] == 1
        
        # Verify second function (1 + if + nested if = 3)
        assert results['functions'][1]['name'] == 'complex_func'
        assert results['functions'][1]['complexity'] == 3
        
        # Verify statistics
        assert results['max_complexity'] == 3
        assert results['avg_complexity'] == 2.0
        
    finally:
        os.unlink(temp_path)


def test_empty_function():
    """Test complexity of an empty function (edge case).
    
    Expected calculation:
    - Base complexity: 1
    - Total: 1
    """
    code = """
def empty():
    pass
"""
    tree = ast.parse(code)
    func = tree.body[0]
    complexity, decision_points = calculate_complexity(func)
    
    assert complexity == 1, f"Expected complexity 1, got {complexity}"
    assert len(decision_points) == 0, f"Expected 0 decision points, got {len(decision_points)}"


if __name__ == '__main__':
    print("=" * 70)
    print("Running Cyclomatic Complexity Analyzer Tests")
    print("=" * 70)
    
    # Run tests manually (pytest will discover them automatically)
    test_simple_function(simple_function_code())
    test_single_if(single_if_code())
    test_nested_ifs(nested_ifs_code())
    test_for_loop()
    test_while_loop()
    test_multiple_branches()
    test_both_loops()
    test_try_except_multiple_clauses()
    test_boolean_and_operator()
    test_boolean_or_operator()
    test_comprehensions()
    test_ternary_operator()
    test_complex_realistic_function(complex_realistic_code())
    test_analyze_file()
    test_empty_function()
    
    print("=" * 70)
    print("All tests passed! ✓")
    print("=" * 70)
