"""Command-line interface for codecomplexity."""

import argparse
import json
import sys
import os
from typing import Dict, Any, List
from codecomplexity.analyzers import analyze_file
from codecomplexity.refactoring.suggestions import (
    find_function_in_file,
    generate_suggestions,
    format_suggestions,
)



# ANSI color codes for terminal output
class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    YELLOW = '\033[93m'
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'
    
    @staticmethod
    def disable():
        """Disable colors (for non-TTY or Windows compatibility)."""
        Colors.RED = ''
        Colors.YELLOW = ''
        Colors.GREEN = ''
        Colors.BLUE = ''
        Colors.CYAN = ''
        Colors.BOLD = ''
        Colors.RESET = ''


def colorize(text: str, color: str) -> str:
    """Apply color to text."""
    return f"{color}{text}{Colors.RESET}"


def print_pretty_output(results: Dict[str, Any], detailed: bool = False, threshold: int = 15) -> int:
    """Print analysis results in a pretty, colorful format.
    
    Args:
        results: Analysis results from analyze_file()
        detailed: Whether to show detailed breakdown
        threshold: Complexity threshold for warnings
    
    Returns:
        Exit code (0 if no critical issues, 1 if threshold exceeded)
    """
    print("\n" + "=" * 80)
    print(colorize(f"📊 CODE COMPLEXITY ANALYSIS", Colors.BOLD + Colors.CYAN))
    print("=" * 80)
    
    # File information
    filename = os.path.basename(results['file'])
    print(f"\n{colorize('File:', Colors.BOLD)} {filename}")
    print(f"{colorize('Path:', Colors.BOLD)} {results['file']}")
    
    # Summary statistics
    print(f"\n{colorize('SUMMARY STATISTICS', Colors.BOLD + Colors.BLUE)}")
    print("-" * 80)
    print(f"  Total Functions:    {len(results['functions'])}")
    print(f"  Average Complexity: {results['avg_complexity']:.2f}")
    print(f"  Maximum Complexity: {results['max_complexity']}")
    
    # Categorize functions by severity
    critical = []  # > threshold
    warning = []   # 9-15 (or 9 to threshold if threshold < 15)
    good = []      # <= 8
    
    warning_threshold = min(9, threshold)
    
    for func in results['functions']:
        complexity = func['complexity']
        if complexity > threshold:
            critical.append(func)
        elif complexity >= warning_threshold:
            warning.append(func)
        else:
            good.append(func)
    
    # Print categorized results
    print(f"\n{colorize('COMPLEXITY BREAKDOWN', Colors.BOLD + Colors.BLUE)}")
    print("-" * 80)
    
    if critical:
        print(f"\n{colorize('🔴 CRITICAL', Colors.BOLD + Colors.RED)} (Complexity > {threshold}): {len(critical)} function(s)")
        for func in critical:
            print(f"  Line {func['line']:4d} | {func['name']:30s} | Complexity: {colorize(str(func['complexity']), Colors.RED)}")
            if detailed:
                print_decision_points(func['decision_points'])
    
    if warning:
        threshold_range = f"{warning_threshold}-{threshold}" if warning_threshold < threshold else str(threshold)
        print(f"\n{colorize('🟡 WARNING', Colors.BOLD + Colors.YELLOW)} (Complexity {threshold_range}): {len(warning)} function(s)")
        for func in warning:
            print(f"  Line {func['line']:4d} | {func['name']:30s} | Complexity: {colorize(str(func['complexity']), Colors.YELLOW)}")
            if detailed:
                print_decision_points(func['decision_points'])
    
    if good:
        print(f"\n{colorize('✅ GOOD', Colors.BOLD + Colors.GREEN)} (Complexity ≤ 8): {len(good)} function(s)")
        for func in good:
            print(f"  Line {func['line']:4d} | {func['name']:30s} | Complexity: {colorize(str(func['complexity']), Colors.GREEN)}")
            if detailed:
                print_decision_points(func['decision_points'])
    
    # Recommendations
    print(f"\n{colorize('RECOMMENDATIONS', Colors.BOLD + Colors.BLUE)}")
    print("-" * 80)
    
    if critical:
        print(f"{colorize('⚠️  CRITICAL:', Colors.RED)} {len(critical)} function(s) exceed threshold ({threshold})")
        print(f"   Consider refactoring these functions to reduce complexity.")
    elif warning:
        print(f"{colorize('⚠️  WARNING:', Colors.YELLOW)} {len(warning)} function(s) have moderate complexity")
        print(f"   Review these functions for potential simplification.")
    else:
        print(f"{colorize('✓ EXCELLENT:', Colors.GREEN)} All functions have low complexity!")
        print(f"   Code is maintainable and easy to test.")
    
    print("\n" + "=" * 80)
    
    # Return exit code
    return 1 if critical else 0


def print_decision_points(decision_points: List[Dict[str, Any]]) -> None:
    """Print decision points for a function."""
    if not decision_points:
        return
    
    print(f"    {colorize('Decision Points:', Colors.CYAN)}")
    for dp in decision_points:
        print(f"      Line {dp['line']:3d}: {dp['description']}")


def print_json_output(results: Dict[str, Any]) -> None:
    """Print analysis results as JSON.
    
    Args:
        results: Analysis results from analyze_file()
    """
    print(json.dumps(results, indent=2))


def analyze_command(args: argparse.Namespace) -> int:
    """Execute the analyze command.
    
    Args:
        args: Parsed command-line arguments
    
    Returns:
        Exit code
    """
    filepath = args.filepath
    
    # Validate file exists
    if not os.path.exists(filepath):
        print(colorize(f"❌ ERROR: File not found: {filepath}", Colors.RED), file=sys.stderr)
        return 2
    
    # Validate it's a Python file
    if not filepath.endswith('.py'):
        print(colorize(f"❌ ERROR: Not a Python file: {filepath}", Colors.RED), file=sys.stderr)
        print(f"   Expected a .py file extension.", file=sys.stderr)
        return 2
    
    # Analyze the file
    try:
        results = analyze_file(filepath)
    except SyntaxError as e:
        print(colorize(f"❌ SYNTAX ERROR in {filepath}:", Colors.RED), file=sys.stderr)
        print(f"   Line {e.lineno}: {e.msg}", file=sys.stderr)
        if e.text:
            print(f"   {e.text.strip()}", file=sys.stderr)
        return 2
    except Exception as e:
        print(colorize(f"❌ ERROR analyzing {filepath}:", Colors.RED), file=sys.stderr)
        print(f"   {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    
    # Output results
    if args.json:
        print_json_output(results)
        # For JSON output, still return exit code based on threshold
        max_complexity = results['max_complexity']
        return 1 if max_complexity > args.threshold else 0
    else:
        return print_pretty_output(results, args.detailed, args.threshold)


def suggest_command(args: argparse.Namespace) -> int:
    """Execute the suggest command.
    
    Args:
        args: Parsed command-line arguments
    
    Returns:
        Exit code
    """
    filepath = args.filepath
    function_name = args.function
    
    # Validate file exists
    if not os.path.exists(filepath):
        print(colorize(f"❌ ERROR: File not found: {filepath}", Colors.RED), file=sys.stderr)
        return 2
    
    # Validate it's a Python file
    if not filepath.endswith('.py'):
        print(colorize(f"❌ ERROR: Not a Python file: {filepath}", Colors.RED), file=sys.stderr)
        print(f"   Expected a .py file extension.", file=sys.stderr)
        return 2
    
    # Find the function
    try:
        result = find_function_in_file(filepath, function_name)
    except SyntaxError as e:
        print(colorize(f"❌ SYNTAX ERROR in {filepath}:", Colors.RED), file=sys.stderr)
        print(f"   Line {e.lineno}: {e.msg}", file=sys.stderr)
        if e.text:
            print(f"   {e.text.strip()}", file=sys.stderr)
        return 2
    except Exception as e:
        print(colorize(f"❌ ERROR reading {filepath}:", Colors.RED), file=sys.stderr)
        print(f"   {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    
    if result is None:
        print(colorize(f"❌ ERROR: Function '{function_name}' not found in {filepath}", Colors.RED), file=sys.stderr)
        print(f"   Make sure the function name is spelled correctly (case-sensitive).", file=sys.stderr)
        return 1
    
    function_node, source_code = result
    
    # Generate suggestions
    try:
        suggestions = generate_suggestions(function_node, source_code)
        
        if args.json:
            print_json_output(suggestions)
        else:
            formatted = format_suggestions(suggestions)
            print(formatted)
        return 0
    except Exception as e:
        print(colorize(f"❌ ERROR generating suggestions:", Colors.RED), file=sys.stderr)
        print(f"   {type(e).__name__}: {e}", file=sys.stderr)
        return 2



def create_parser() -> argparse.ArgumentParser:
    """Create and configure the argument parser.
    
    Returns:
        Configured ArgumentParser
    """
    parser = argparse.ArgumentParser(
        prog='codecomplexity',
        description='AI Code Quality Guard - Analyze Python code complexity',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  codecomplexity analyze myfile.py
  codecomplexity analyze myfile.py --detailed
  codecomplexity analyze myfile.py --threshold 10
  codecomplexity analyze myfile.py --json

Exit Codes:
  0 - No critical complexity issues found
  1 - One or more functions exceed the threshold
  2 - Error (file not found, parse error, etc.)
        """
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 0.1.0'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Analyze command
    analyze_parser = subparsers.add_parser(
        'analyze',
        help='Analyze a Python file for cyclomatic complexity'
    )
    
    analyze_parser.add_argument(
        'filepath',
        help='Path to the Python file to analyze'
    )
    
    analyze_parser.add_argument(
        '--detailed',
        action='store_true',
        help='Show detailed breakdown with decision points'
    )
    
    analyze_parser.add_argument(
        '--threshold',
        type=int,
        default=15,
        metavar='N',
        help='Complexity threshold for warnings (default: 15)'
    )
    
    analyze_parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    
    analyze_parser.add_argument(
        '--no-color',
        action='store_true',
        help='Disable colored output'
    )
    
    # Suggest command
    suggest_parser = subparsers.add_parser(
        'suggest',
        help='Generate refactoring suggestions for a specific function'
    )
    
    suggest_parser.add_argument(
        'filepath',
        help='Path to the Python file'
    )
    
    suggest_parser.add_argument(
        '--function',
        '-f',
        required=True,
        metavar='NAME',
        help='Name of the function to analyze'
    )

    suggest_parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    
    suggest_parser.add_argument(
        '--no-color',
        action='store_true',
        help='Disable colored output'
    )
    
    return parser



def main() -> int:
    """Main entry point for the codecomplexity CLI.
    
    Returns:
        Exit code
    """
    parser = create_parser()
    args = parser.parse_args()
    
    # Disable colors if requested or if not a TTY
    if hasattr(args, 'no_color') and args.no_color or not sys.stdout.isatty():
        Colors.disable()
    
    # Handle no command
    if not args.command:
        parser.print_help()
        return 0
    
    # Execute command
    if args.command == 'analyze':
        return analyze_command(args)
    elif args.command == 'suggest':
        return suggest_command(args)
    else:
        parser.print_help()
        return 0



if __name__ == '__main__':
    sys.exit(main())
