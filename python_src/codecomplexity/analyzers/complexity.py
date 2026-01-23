"""Cyclomatic Complexity Analyzer for Python code.

Cyclomatic complexity is a software metric used to measure the complexity of a program.
It quantifies the number of linearly independent paths through a program's source code.

The formula used is: Complexity = 1 + number of decision points

Decision points include:
- if, elif statements
- for, while loops
- except handlers
- and, or operators in boolean expressions
- List/dict/set comprehensions with if clauses
- Conditional expressions (ternary operators)
"""

import ast
from typing import Dict, List, Tuple, Any


class DecisionPoint:
    """Represents a decision point in the code that increases complexity."""
    
    def __init__(self, line: int, node_type: str, description: str):
        """Initialize a decision point.
        
        Args:
            line: Line number where the decision point occurs
            node_type: Type of AST node (e.g., 'If', 'For', 'While')
            description: Human-readable description of the decision point
        """
        self.line = line
        self.node_type = node_type
        self.description = description
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'line': self.line,
            'type': self.node_type,
            'description': self.description
        }
    
    def __repr__(self) -> str:
        return f"DecisionPoint(line={self.line}, type={self.node_type})"


class ComplexityAnalyzer(ast.NodeVisitor):
    """AST visitor that calculates cyclomatic complexity for Python functions.
    
    This analyzer walks through the Abstract Syntax Tree (AST) of Python code
    and identifies decision points that contribute to cyclomatic complexity.
    """
    
    def __init__(self):
        """Initialize the complexity analyzer."""
        self.complexity = 1  # Base complexity starts at 1
        self.decision_points: List[DecisionPoint] = []
    
    def visit_If(self, node: ast.If) -> None:
        """Visit if statement.
        
        Each 'if' adds 1 to complexity. 'elif' is represented as nested If nodes.
        """
        self.complexity += 1
        self.decision_points.append(
            DecisionPoint(node.lineno, 'If', 'if statement')
        )
        self.generic_visit(node)
    
    def visit_For(self, node: ast.For) -> None:
        """Visit for loop.
        
        Each 'for' loop adds 1 to complexity.
        """
        self.complexity += 1
        self.decision_points.append(
            DecisionPoint(node.lineno, 'For', 'for loop')
        )
        self.generic_visit(node)
    
    def visit_While(self, node: ast.While) -> None:
        """Visit while loop.
        
        Each 'while' loop adds 1 to complexity.
        """
        self.complexity += 1
        self.decision_points.append(
            DecisionPoint(node.lineno, 'While', 'while loop')
        )
        self.generic_visit(node)
    
    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        """Visit except handler.
        
        Each 'except' clause adds 1 to complexity.
        """
        self.complexity += 1
        exception_type = 'any exception' if node.type is None else 'specific exception'
        self.decision_points.append(
            DecisionPoint(node.lineno, 'ExceptHandler', f'except handler ({exception_type})')
        )
        self.generic_visit(node)
    
    def visit_BoolOp(self, node: ast.BoolOp) -> None:
        """Visit boolean operation (and, or).
        
        For boolean operators, complexity increases by (n-1) where n is the number of operands.
        Example: 'a and b and c' has 3 operands, so complexity += 2
        """
        num_operands = len(node.values)
        complexity_increase = num_operands - 1
        self.complexity += complexity_increase
        
        op_name = 'and' if isinstance(node.op, ast.And) else 'or'
        self.decision_points.append(
            DecisionPoint(
                node.lineno,
                'BoolOp',
                f'{op_name} operator with {num_operands} operands (+{complexity_increase})'
            )
        )
        self.generic_visit(node)
    
    def visit_ListComp(self, node: ast.ListComp) -> None:
        """Visit list comprehension.
        
        Each 'if' clause in a comprehension adds 1 to complexity.
        """
        self._visit_comprehension(node, 'list comprehension')
    
    def visit_SetComp(self, node: ast.SetComp) -> None:
        """Visit set comprehension.
        
        Each 'if' clause in a comprehension adds 1 to complexity.
        """
        self._visit_comprehension(node, 'set comprehension')
    
    def visit_DictComp(self, node: ast.DictComp) -> None:
        """Visit dictionary comprehension.
        
        Each 'if' clause in a comprehension adds 1 to complexity.
        """
        self._visit_comprehension(node, 'dict comprehension')
    
    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        """Visit generator expression.
        
        Each 'if' clause in a generator adds 1 to complexity.
        """
        self._visit_comprehension(node, 'generator expression')
    
    def _visit_comprehension(self, node: Any, comp_type: str) -> None:
        """Helper to visit comprehensions and count if clauses."""
        for generator in node.generators:
            for if_clause in generator.ifs:
                self.complexity += 1
                self.decision_points.append(
                    DecisionPoint(
                        if_clause.lineno,
                        'Comprehension',
                        f'if clause in {comp_type}'
                    )
                )
        self.generic_visit(node)
    
    def visit_IfExp(self, node: ast.IfExp) -> None:
        """Visit conditional expression (ternary operator).
        
        Ternary expressions like 'x if condition else y' add 1 to complexity.
        """
        self.complexity += 1
        self.decision_points.append(
            DecisionPoint(node.lineno, 'IfExp', 'conditional expression (ternary)')
        )
        self.generic_visit(node)


def calculate_complexity(function_node: ast.FunctionDef) -> Tuple[int, List[DecisionPoint]]:
    """Calculate cyclomatic complexity for a function.
    
    Args:
        function_node: AST node representing a function definition
    
    Returns:
        Tuple of (complexity score, list of decision points)
    
    Example:
        >>> import ast
        >>> code = '''
        ... def example(x):
        ...     if x > 0:
        ...         return x
        ...     return 0
        ... '''
        >>> tree = ast.parse(code)
        >>> func = tree.body[0]
        >>> complexity, points = calculate_complexity(func)
        >>> print(f"Complexity: {complexity}")
        Complexity: 2
    """
    analyzer = ComplexityAnalyzer()
    analyzer.visit(function_node)
    return analyzer.complexity, analyzer.decision_points


def analyze_file(filepath: str) -> Dict[str, Any]:
    """Analyze all functions in a Python file for cyclomatic complexity.
    
    Args:
        filepath: Path to the Python file to analyze
    
    Returns:
        Dictionary containing:
        - file: filepath
        - functions: list of function analysis results
        - avg_complexity: average complexity across all functions
        - max_complexity: maximum complexity found
    
    Raises:
        FileNotFoundError: If the file doesn't exist
        SyntaxError: If the file contains invalid Python syntax
    
    Example:
        >>> results = analyze_file('mymodule.py')
        >>> print(f"Average complexity: {results['avg_complexity']:.2f}")
        >>> for func in results['functions']:
        ...     if func['complexity'] > 10:
        ...         print(f"High complexity: {func['name']} = {func['complexity']}")
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        source_code = f.read()
    
    tree = ast.parse(source_code, filename=filepath)
    
    functions = []
    
    # Walk through all nodes to find function definitions
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            complexity, decision_points = calculate_complexity(node)
            
            functions.append({
                'name': node.name,
                'line': node.lineno,
                'complexity': complexity,
                'decision_points': [dp.to_dict() for dp in decision_points]
            })
    
    # Calculate statistics
    if functions:
        complexities = [f['complexity'] for f in functions]
        avg_complexity = sum(complexities) / len(complexities)
        max_complexity = max(complexities)
    else:
        avg_complexity = 0.0
        max_complexity = 0
    
    return {
        'file': filepath,
        'functions': functions,
        'avg_complexity': avg_complexity,
        'max_complexity': max_complexity
    }


if __name__ == '__main__':
    # Demonstration with a complex sample function
    sample_code = '''
def complex_function(data, threshold=10):
    """A complex function to demonstrate cyclomatic complexity analysis."""
    result = []
    
    # Multiple decision points
    if not data:
        return result
    
    for item in data:
        try:
            value = int(item)
            
            # Nested conditions
            if value > threshold and value < 100:
                result.append(value * 2)
            elif value <= threshold or value >= 100:
                result.append(value)
            
            # List comprehension with condition
            squares = [x**2 for x in range(value) if x % 2 == 0]
            
            # Ternary operator
            status = "high" if value > 50 else "low"
            
        except (ValueError, TypeError):
            continue
        except Exception:
            break
    
    # While loop
    while len(result) > 100:
        result.pop()
    
    return result
'''
    
    # Parse and analyze the sample function
    tree = ast.parse(sample_code)
    function_node = tree.body[0]
    
    complexity, decision_points = calculate_complexity(function_node)
    
    print("=" * 70)
    print("CYCLOMATIC COMPLEXITY ANALYSIS DEMO")
    print("=" * 70)
    print(f"\nFunction: {function_node.name}")
    print(f"Cyclomatic Complexity: {complexity}")
    print(f"\nDecision Points ({len(decision_points)}):")
    print("-" * 70)
    
    for dp in decision_points:
        print(f"  Line {dp.line:3d} | {dp.node_type:15s} | {dp.description}")
    
    print("\n" + "=" * 70)
    print("COMPLEXITY INTERPRETATION:")
    print("=" * 70)
    print("  1-5:   Simple function, low risk")
    print("  6-10:  Moderate complexity, medium risk")
    print("  11-20: Complex function, high risk")
    print("  21+:   Very complex, very high risk - consider refactoring")
    print("=" * 70)
    
    if complexity <= 5:
        risk = "LOW RISK"
    elif complexity <= 10:
        risk = "MEDIUM RISK"
    elif complexity <= 20:
        risk = "HIGH RISK"
    else:
        risk = "VERY HIGH RISK - REFACTOR RECOMMENDED"
    
    print(f"\nThis function has complexity {complexity}: {risk}")
    print("=" * 70)
