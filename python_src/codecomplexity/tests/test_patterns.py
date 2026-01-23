"""Tests for refactoring pattern detection."""

import ast
import pytest
from codecomplexity.refactoring.patterns import (
    ExtractValidationPattern,
    ExtractNestedLoopPattern,
    ExtractErrorHandlingPattern,
    ExtractConditionalLogicPattern,
    detect_refactoring_opportunities,
)


def test_extract_validation_pattern():
    """Test detection of validation pattern."""
    code = """
def validate_user(user, email, password):
    if not user:
        raise ValueError("User required")
    if not email:
        raise ValueError("Email required")
    if not password:
        raise ValueError("Password required")
    return True
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractValidationPattern()
    result = detector.detect(func)
    
    assert result is not None
    assert result['pattern'] == 'extract_validation'
    assert result['complexity_reduction'] == 3
    assert 'validate_inputs()' in result['suggestion']


def test_validation_pattern_not_detected_with_few_checks():
    """Test that validation pattern is not detected with < 3 checks."""
    code = """
def validate_user(user):
    if not user:
        raise ValueError("User required")
    if not user.email:
        raise ValueError("Email required")
    return True
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractValidationPattern()
    result = detector.detect(func)
    
    assert result is None


def test_extract_nested_loop_pattern():
    """Test detection of nested loop pattern."""
    code = """
def process_items(items):
    results = []
    for item in items:
        for detail in item.details:
            results.append(detail)
    return results
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractNestedLoopPattern()
    result = detector.detect(func)
    
    assert result is not None
    assert result['pattern'] == 'extract_nested_loop'
    assert result['complexity_reduction'] == 2
    assert 'separate function' in result['suggestion']


def test_nested_loop_with_while():
    """Test detection of nested while loop."""
    code = """
def process_data(data):
    i = 0
    while i < len(data):
        j = 0
        while j < len(data[i]):
            process(data[i][j])
            j += 1
        i += 1
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractNestedLoopPattern()
    result = detector.detect(func)
    
    assert result is not None
    assert result['pattern'] == 'extract_nested_loop'


def test_extract_error_handling_pattern():
    """Test detection of complex error handling pattern."""
    code = """
def fetch_data(url):
    try:
        response = requests.get(url)
    except NetworkError:
        return None
    except TimeoutError:
        return None
    except ValueError:
        return None
    return response
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractErrorHandlingPattern()
    result = detector.detect(func)
    
    assert result is not None
    assert result['pattern'] == 'extract_error_handling'
    assert result['complexity_reduction'] == 3
    assert 'error handler' in result['suggestion']


def test_error_handling_not_detected_with_few_handlers():
    """Test that error handling pattern is not detected with < 3 handlers."""
    code = """
def fetch_data(url):
    try:
        response = requests.get(url)
    except NetworkError:
        return None
    except TimeoutError:
        return None
    return response
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractErrorHandlingPattern()
    result = detector.detect(func)
    
    assert result is None


def test_extract_conditional_logic_pattern():
    """Test detection of long if/elif chain pattern."""
    code = """
def process_payment(method):
    if method == 'card':
        return process_card()
    elif method == 'paypal':
        return process_paypal()
    elif method == 'bank':
        return process_bank()
    elif method == 'crypto':
        return process_crypto()
    elif method == 'check':
        return process_check()
    else:
        raise ValueError()
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractConditionalLogicPattern()
    result = detector.detect(func)
    
    assert result is not None
    assert result['pattern'] == 'extract_conditional_logic'
    assert result['complexity_reduction'] == 4
    assert 'dictionary dispatch' in result['suggestion'] or 'strategy pattern' in result['suggestion']


def test_conditional_logic_not_detected_with_few_elif():
    """Test that conditional logic pattern is not detected with < 4 elif."""
    code = """
def process_payment(method):
    if method == 'card':
        return process_card()
    elif method == 'paypal':
        return process_paypal()
    elif method == 'bank':
        return process_bank()
    else:
        raise ValueError()
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    detector = ExtractConditionalLogicPattern()
    result = detector.detect(func)
    
    assert result is None


def test_detect_refactoring_opportunities_multiple_patterns():
    """Test detecting multiple patterns in a complex function."""
    code = """
def complex_function(user, data, items):
    # Validation checks
    if not user:
        raise ValueError()
    if not data:
        raise ValueError()
    if not items:
        raise ValueError()
    
    # Nested loop
    results = []
    for item in items:
        for detail in item.details:
            results.append(detail)
    
    return results
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    opportunities = detect_refactoring_opportunities(func)
    
    # Should detect both validation and nested loop patterns
    assert len(opportunities) >= 2
    
    patterns = [opp['pattern'] for opp in opportunities]
    assert 'extract_validation' in patterns
    assert 'extract_nested_loop' in patterns


def test_detect_refactoring_opportunities_sorted():
    """Test that opportunities are sorted by complexity reduction."""
    code = """
def complex_function(method):
    if method == 'a':
        return 1
    elif method == 'b':
        return 2
    elif method == 'c':
        return 3
    elif method == 'd':
        return 4
    elif method == 'e':
        return 5
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    opportunities = detect_refactoring_opportunities(func)
    
    # Should be sorted by complexity_reduction (highest first)
    if len(opportunities) > 1:
        for i in range(len(opportunities) - 1):
            assert opportunities[i]['complexity_reduction'] >= opportunities[i + 1]['complexity_reduction']


def test_no_patterns_detected():
    """Test that simple functions don't trigger any patterns."""
    code = """
def simple_function(x):
    return x * 2
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    opportunities = detect_refactoring_opportunities(func)
    
    assert len(opportunities) == 0


def test_pattern_result_structure():
    """Test that pattern results have the correct structure."""
    code = """
def validate(a, b, c):
    if not a:
        raise ValueError()
    if not b:
        raise ValueError()
    if not c:
        raise ValueError()
"""
    tree = ast.parse(code)
    func = tree.body[0]
    
    opportunities = detect_refactoring_opportunities(func)
    
    assert len(opportunities) > 0
    
    for opp in opportunities:
        # Check required keys
        assert 'pattern' in opp
        assert 'description' in opp
        assert 'lines' in opp
        assert 'complexity_reduction' in opp
        assert 'suggestion' in opp
        
        # Check types
        assert isinstance(opp['pattern'], str)
        assert isinstance(opp['description'], str)
        assert isinstance(opp['lines'], tuple)
        assert len(opp['lines']) == 2
        assert isinstance(opp['complexity_reduction'], int)
        assert isinstance(opp['suggestion'], str)


if __name__ == '__main__':
    print("=" * 80)
    print("Running Refactoring Pattern Detection Tests")
    print("=" * 80)
    
    test_extract_validation_pattern()
    print("✓ Validation pattern detection test passed")
    
    test_validation_pattern_not_detected_with_few_checks()
    print("✓ Validation pattern threshold test passed")
    
    test_extract_nested_loop_pattern()
    print("✓ Nested loop pattern detection test passed")
    
    test_nested_loop_with_while()
    print("✓ Nested while loop detection test passed")
    
    test_extract_error_handling_pattern()
    print("✓ Error handling pattern detection test passed")
    
    test_error_handling_not_detected_with_few_handlers()
    print("✓ Error handling threshold test passed")
    
    test_extract_conditional_logic_pattern()
    print("✓ Conditional logic pattern detection test passed")
    
    test_conditional_logic_not_detected_with_few_elif()
    print("✓ Conditional logic threshold test passed")
    
    test_detect_refactoring_opportunities_multiple_patterns()
    print("✓ Multiple patterns detection test passed")
    
    test_detect_refactoring_opportunities_sorted()
    print("✓ Sorting by complexity reduction test passed")
    
    test_no_patterns_detected()
    print("✓ No false positives test passed")
    
    test_pattern_result_structure()
    print("✓ Result structure test passed")
    
    print("=" * 80)
    print("All tests passed! ✓")
    print("=" * 80)
