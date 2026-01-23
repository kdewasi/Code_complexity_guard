"""Refactoring pattern detection for identifying code improvement opportunities.

This module provides pattern detectors that analyze Python functions and identify
common code smells and refactoring opportunities.
"""

import ast
from typing import Dict, List, Optional, Any, Tuple
from abc import ABC, abstractmethod


class RefactoringPattern(ABC):
    """Base class for refactoring pattern detectors.
    
    Each pattern detector analyzes a function's AST and identifies specific
    code patterns that could benefit from refactoring.
    """
    
    @abstractmethod
    def detect(self, function_node: ast.FunctionDef) -> Optional[Dict[str, Any]]:
        """Detect the pattern in a function.
        
        Args:
            function_node: AST node representing a function definition
        
        Returns:
            Dictionary with pattern details if detected, None otherwise.
            Dictionary should contain:
            - pattern: Pattern name (str)
            - description: Human-readable description (str)
            - lines: Tuple of (start_line, end_line) (Tuple[int, int])
            - complexity_reduction: Estimated complexity reduction (int)
            - suggestion: Specific refactoring suggestion (str)
        """
        pass


class ExtractValidationPattern(RefactoringPattern):
    """Detects consecutive validation checks that could be extracted.
    
    Identifies 3+ consecutive if statements at the start of a function that
    only raise exceptions (validation checks).
    """
    
    def detect(self, function_node: ast.FunctionDef) -> Optional[Dict[str, Any]]:
        """Detect validation pattern.
        
        Looks for consecutive if statements that:
        1. Are at the beginning of the function
        2. Only raise exceptions (no other logic)
        3. Have 3 or more such statements
        """
        if not function_node.body:
            return None
        
        validation_checks = []
        
        # Look for consecutive if statements at the start
        for i, stmt in enumerate(function_node.body):
            if not isinstance(stmt, ast.If):
                # Stop at first non-if statement
                break
            
            # Check if the if statement only raises an exception
            if self._is_validation_check(stmt):
                validation_checks.append(stmt)
            else:
                # Stop if we find an if that doesn't just raise
                break
        
        # Need at least 3 validation checks
        if len(validation_checks) >= 3:
            start_line = validation_checks[0].lineno
            end_line = validation_checks[-1].end_lineno or validation_checks[-1].lineno
            
            return {
                'pattern': 'extract_validation',
                'description': f'Found {len(validation_checks)} consecutive validation checks',
                'lines': (start_line, end_line),
                'complexity_reduction': len(validation_checks),
                'suggestion': f'Extract {len(validation_checks)} validation checks into a separate validate_inputs() function'
            }
        
        return None
    
    def _is_validation_check(self, if_node: ast.If) -> bool:
        """Check if an if statement is a validation check (only raises exception)."""
        # Check if body only contains a Raise statement
        if len(if_node.body) == 1 and isinstance(if_node.body[0], ast.Raise):
            return True
        
        # Check if body is a single expression that raises
        if len(if_node.body) == 1 and isinstance(if_node.body[0], ast.Expr):
            return False
        
        return False


class ExtractNestedLoopPattern(RefactoringPattern):
    """Detects nested loops that could be extracted into separate functions.
    
    Identifies for/while loops that contain another for/while loop inside them.
    """
    
    def detect(self, function_node: ast.FunctionDef) -> Optional[Dict[str, Any]]:
        """Detect nested loop pattern.
        
        Looks for loops (for/while) that contain another loop inside.
        """
        nested_loops = []
        
        for node in ast.walk(function_node):
            if isinstance(node, (ast.For, ast.While)):
                # Check if this loop contains another loop
                for child in ast.walk(node):
                    if child is not node and isinstance(child, (ast.For, ast.While)):
                        # Found a nested loop
                        nested_loops.append((node, child))
                        break  # Only count once per outer loop
        
        if nested_loops:
            outer_loop, inner_loop = nested_loops[0]  # Report the first one
            loop_type = 'for' if isinstance(outer_loop, ast.For) else 'while'
            inner_type = 'for' if isinstance(inner_loop, ast.For) else 'while'
            
            start_line = outer_loop.lineno
            end_line = outer_loop.end_lineno or outer_loop.lineno
            
            return {
                'pattern': 'extract_nested_loop',
                'description': f'Found nested {inner_type} loop inside {loop_type} loop',
                'lines': (start_line, end_line),
                'complexity_reduction': 2,  # Reduces by at least 2 (the two loops)
                'suggestion': f'Extract nested {inner_type} loop into a separate function to improve readability'
            }
        
        return None


class ExtractErrorHandlingPattern(RefactoringPattern):
    """Detects complex error handling that could be simplified.
    
    Identifies try blocks with 3 or more except handlers.
    """
    
    def detect(self, function_node: ast.FunctionDef) -> Optional[Dict[str, Any]]:
        """Detect complex error handling pattern.
        
        Looks for try/except blocks with 3+ except handlers.
        """
        for node in ast.walk(function_node):
            if isinstance(node, ast.Try):
                num_handlers = len(node.handlers)
                
                if num_handlers >= 3:
                    start_line = node.lineno
                    end_line = node.end_lineno or node.lineno
                    
                    return {
                        'pattern': 'extract_error_handling',
                        'description': f'Found try block with {num_handlers} except handlers',
                        'lines': (start_line, end_line),
                        'complexity_reduction': num_handlers,
                        'suggestion': f'Extract error handling with {num_handlers} except clauses into a separate error handler function'
                    }
        
        return None


class ExtractConditionalLogicPattern(RefactoringPattern):
    """Detects long if/elif chains that could use better patterns.
    
    Identifies if statements with 4 or more elif clauses, suggesting
    dictionary dispatch or strategy pattern.
    """
    
    def detect(self, function_node: ast.FunctionDef) -> Optional[Dict[str, Any]]:
        """Detect long conditional logic pattern.
        
        Looks for if statements with 4+ elif clauses.
        """
        for node in ast.walk(function_node):
            if isinstance(node, ast.If):
                # Count elif clauses
                elif_count = self._count_elif_clauses(node)
                
                if elif_count >= 4:
                    start_line = node.lineno
                    end_line = node.end_lineno or node.lineno
                    
                    return {
                        'pattern': 'extract_conditional_logic',
                        'description': f'Found if statement with {elif_count} elif clauses',
                        'lines': (start_line, end_line),
                        'complexity_reduction': elif_count,
                        'suggestion': f'Replace {elif_count} elif clauses with dictionary dispatch or strategy pattern'
                    }
        
        return None
    
    def _count_elif_clauses(self, if_node: ast.If) -> int:
        """Count the number of elif clauses in an if statement."""
        count = 0
        current = if_node
        
        while current.orelse:
            # Check if orelse is another If (elif)
            if len(current.orelse) == 1 and isinstance(current.orelse[0], ast.If):
                count += 1
                current = current.orelse[0]
            else:
                # It's an else clause, stop counting
                break
        
        return count


# Registry of all pattern detectors
ALL_PATTERNS: List[RefactoringPattern] = [
    ExtractValidationPattern(),
    ExtractNestedLoopPattern(),
    ExtractErrorHandlingPattern(),
    ExtractConditionalLogicPattern(),
]


def detect_refactoring_opportunities(function_node: ast.FunctionDef) -> List[Dict[str, Any]]:
    """Detect all refactoring opportunities in a function.
    
    Runs all registered pattern detectors on the function and returns
    a list of detected opportunities, sorted by potential complexity reduction.
    
    Args:
        function_node: AST node representing a function definition
    
    Returns:
        List of detected refactoring opportunities, sorted by complexity_reduction
        (highest first). Each opportunity is a dictionary with:
        - pattern: Pattern name
        - description: Human-readable description
        - lines: Tuple of (start_line, end_line)
        - complexity_reduction: Estimated complexity reduction
        - suggestion: Specific refactoring suggestion
    
    Example:
        >>> import ast
        >>> code = '''
        ... def validate_user(user, email, password):
        ...     if not user:
        ...         raise ValueError("User required")
        ...     if not email:
        ...         raise ValueError("Email required")
        ...     if not password:
        ...         raise ValueError("Password required")
        ...     return True
        ... '''
        >>> tree = ast.parse(code)
        >>> func = tree.body[0]
        >>> opportunities = detect_refactoring_opportunities(func)
        >>> print(opportunities[0]['pattern'])
        extract_validation
    """
    opportunities = []
    
    for pattern_detector in ALL_PATTERNS:
        result = pattern_detector.detect(function_node)
        if result:
            opportunities.append(result)
    
    # Sort by complexity reduction (highest first)
    opportunities.sort(key=lambda x: x['complexity_reduction'], reverse=True)
    
    return opportunities


if __name__ == '__main__':
    # Demonstration of pattern detection
    sample_code = '''
def example_with_validation(user, email, password):
    """Function with validation pattern."""
    if not user:
        raise ValueError("User required")
    if not email:
        raise ValueError("Email required")
    if not password:
        raise ValueError("Password required")
    
    return process_user(user, email, password)


def example_with_nested_loop(items):
    """Function with nested loop pattern."""
    results = []
    for item in items:
        for detail in item.details:
            results.append(process_detail(detail))
    return results


def example_with_error_handling(data):
    """Function with complex error handling."""
    try:
        result = process_data(data)
    except NetworkError as e:
        log_error(e)
        return None
    except TimeoutError as e:
        retry(data)
        return None
    except ValueError as e:
        handle_invalid_data(e)
        return None
    except Exception as e:
        log_critical(e)
        return None
    return result


def example_with_many_elif(payment_method):
    """Function with long if/elif chain."""
    if payment_method == 'card':
        return process_card_payment()
    elif payment_method == 'paypal':
        return process_paypal_payment()
    elif payment_method == 'bank':
        return process_bank_transfer()
    elif payment_method == 'crypto':
        return process_crypto_payment()
    elif payment_method == 'cash':
        return process_cash_payment()
    else:
        raise ValueError("Unknown payment method")
'''
    
    tree = ast.parse(sample_code)
    
    print("=" * 80)
    print("REFACTORING PATTERN DETECTION DEMO")
    print("=" * 80)
    
    for func in tree.body:
        if isinstance(func, ast.FunctionDef):
            opportunities = detect_refactoring_opportunities(func)
            
            if opportunities:
                print(f"\n📋 Function: {func.name} (line {func.lineno})")
                print("-" * 80)
                
                for opp in opportunities:
                    print(f"\n  🔍 Pattern: {opp['pattern']}")
                    print(f"     Description: {opp['description']}")
                    print(f"     Lines: {opp['lines'][0]}-{opp['lines'][1]}")
                    print(f"     Complexity Reduction: -{opp['complexity_reduction']}")
                    print(f"     💡 Suggestion: {opp['suggestion']}")
    
    print("\n" + "=" * 80)
