"""Suggestion generator for refactoring recommendations.

This module combines complexity analysis with pattern detection to generate
comprehensive refactoring suggestions with code snippets and estimated improvements.
"""

import ast
from typing import Dict, List, Any, Optional
from codecomplexity.analyzers import calculate_complexity
from codecomplexity.refactoring.patterns import detect_refactoring_opportunities


def extract_code_snippet(source_code: str, start_line: int, end_line: int) -> str:
    """Extract a code snippet from source code by line numbers.
    
    Args:
        source_code: Full source code as string
        start_line: Starting line number (1-indexed)
        end_line: Ending line number (1-indexed, inclusive)
    
    Returns:
        Code snippet as string
    """
    lines = source_code.split('\n')
    # Convert to 0-indexed and extract
    snippet_lines = lines[start_line - 1:end_line]
    return '\n'.join(snippet_lines)


def generate_suggestions(function_node: ast.FunctionDef, source_code: str) -> Dict[str, Any]:
    """Generate comprehensive refactoring suggestions for a function.
    
    Combines complexity analysis with pattern detection to provide actionable
    refactoring recommendations with code snippets and estimated improvements.
    
    Args:
        function_node: AST node representing a function definition
        source_code: Full source code containing the function
    
    Returns:
        Dictionary containing:
        - function_name: Name of the function
        - current_complexity: Current cyclomatic complexity
        - opportunities: List of refactoring opportunities with code snippets
        - estimated_new_complexity: Estimated complexity after refactoring
        - total_reduction: Total estimated complexity reduction
    
    Example:
        >>> import ast
        >>> code = '''
        ... def example(x, y):
        ...     if not x:
        ...         raise ValueError()
        ...     if not y:
        ...         raise ValueError()
        ...     if x < 0:
        ...         raise ValueError()
        ...     return x + y
        ... '''
        >>> tree = ast.parse(code)
        >>> func = tree.body[0]
        >>> suggestions = generate_suggestions(func, code)
        >>> print(suggestions['function_name'])
        example
        >>> print(suggestions['current_complexity'])
        4
    """
    # Calculate current complexity
    complexity, decision_points = calculate_complexity(function_node)
    
    # Detect refactoring opportunities
    opportunities = detect_refactoring_opportunities(function_node)
    
    # Enhance opportunities with code snippets
    enhanced_opportunities = []
    for opp in opportunities:
        start_line, end_line = opp['lines']
        code_snippet = extract_code_snippet(source_code, start_line, end_line)
        
        enhanced_opp = {
            'pattern': opp['pattern'],
            'description': opp['description'],
            'lines': opp['lines'],
            'complexity_reduction': opp['complexity_reduction'],
            'suggestion': opp['suggestion'],
            'code_snippet': code_snippet
        }
        enhanced_opportunities.append(enhanced_opp)
    
    # Calculate estimated improvements
    total_reduction = sum(opp['complexity_reduction'] for opp in opportunities)
    estimated_new_complexity = max(1, complexity - total_reduction)
    
    return {
        'function_name': function_node.name,
        'current_complexity': complexity,
        'opportunities': enhanced_opportunities,
        'estimated_new_complexity': estimated_new_complexity,
        'total_reduction': total_reduction
    }


def format_suggestions(suggestions: Dict[str, Any]) -> str:
    """Format suggestions for CLI output with nice formatting.
    
    Creates a visually appealing formatted output using box-drawing characters
    and emojis to display refactoring suggestions.
    
    Args:
        suggestions: Suggestions dictionary from generate_suggestions()
    
    Returns:
        Formatted string ready for printing
    """
    output = []
    
    # Header
    output.append("╔" + "═" * 78 + "╗")
    output.append("║" + " " * 78 + "║")
    output.append("║" + f"  📋 REFACTORING SUGGESTIONS".ljust(78) + "║")
    output.append("║" + " " * 78 + "║")
    output.append("╚" + "═" * 78 + "╝")
    output.append("")
    
    # Function info
    func_name = suggestions['function_name']
    current_complexity = suggestions['current_complexity']
    
    # Determine complexity emoji
    if current_complexity <= 8:
        complexity_emoji = "✅"
        complexity_label = "GOOD"
    elif current_complexity <= 15:
        complexity_emoji = "🟡"
        complexity_label = "WARNING"
    else:
        complexity_emoji = "🔴"
        complexity_label = "CRITICAL"
    
    output.append(f"Function: {func_name}")
    output.append(f"Current Complexity: {current_complexity} {complexity_emoji} ({complexity_label})")
    output.append("")
    
    # Opportunities
    if suggestions['opportunities']:
        output.append("🎯 REFACTORING OPPORTUNITIES:")
        output.append("─" * 80)
        output.append("")
        
        for i, opp in enumerate(suggestions['opportunities'], 1):
            output.append(f"{i}. {opp['description']}")
            output.append(f"   Lines: {opp['lines'][0]}-{opp['lines'][1]}")
            output.append(f"   Complexity reduction: {opp['complexity_reduction']}")
            output.append(f"   💡 {opp['suggestion']}")
            output.append("")
            
            # Show code snippet (indented)
            output.append("   Code to refactor:")
            for line in opp['code_snippet'].split('\n'):
                output.append(f"   │ {line}")
            output.append("")
    else:
        output.append("✨ No refactoring opportunities detected!")
        output.append("   This function already has good complexity.")
        output.append("")
    
    # Estimated result
    if suggestions['opportunities']:
        output.append("📊 ESTIMATED RESULT:")
        output.append("─" * 80)
        
        new_complexity = suggestions['estimated_new_complexity']
        total_reduction = suggestions['total_reduction']
        
        # Determine new complexity emoji
        if new_complexity <= 8:
            new_emoji = "✅"
            new_label = "GOOD"
        elif new_complexity <= 15:
            new_emoji = "🟡"
            new_label = "WARNING"
        else:
            new_emoji = "🔴"
            new_label = "CRITICAL"
        
        output.append(f"   Current complexity:  {current_complexity} {complexity_emoji}")
        output.append(f"   Total reduction:     -{total_reduction}")
        output.append(f"   New complexity:      {new_complexity} {new_emoji} ({new_label})")
        output.append("")
        
        # Improvement message
        if new_complexity < current_complexity:
            improvement_pct = ((current_complexity - new_complexity) / current_complexity) * 100
            output.append(f"   🎉 {improvement_pct:.1f}% complexity reduction!")
        output.append("")
    
    output.append("═" * 80)
    
    return '\n'.join(output)


def find_function_in_file(filepath: str, function_name: str) -> Optional[tuple]:
    """Find a function by name in a Python file.
    
    Args:
        filepath: Path to Python file
        function_name: Name of function to find
    
    Returns:
        Tuple of (function_node, source_code) if found, None otherwise
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        source_code = f.read()
    
    try:
        tree = ast.parse(source_code, filename=filepath)
    except SyntaxError:
        return None
    
    # Search for the function
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return (node, source_code)
    
    return None


if __name__ == '__main__':
    # Demonstration
    sample_code = '''
def complex_function(user, data, items):
    """A complex function with multiple refactoring opportunities."""
    # Validation checks
    if not user:
        raise ValueError("User required")
    if not user.email:
        raise ValueError("Email required")
    if not data:
        raise ValueError("Data required")
    if not items:
        raise ValueError("Items required")
    
    # Process items with nested loop
    results = []
    for item in items:
        try:
            value = int(item)
            
            # Nested processing
            for detail in item.details:
                results.append(process_detail(detail))
                
        except ValueError:
            continue
        except TypeError:
            continue
        except KeyError:
            continue
    
    return results
'''
    
    tree = ast.parse(sample_code)
    func = tree.body[0]
    
    suggestions = generate_suggestions(func, sample_code)
    formatted = format_suggestions(suggestions)
    
    print(formatted)
