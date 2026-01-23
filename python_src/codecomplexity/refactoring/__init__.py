"""Code refactoring suggestions."""

from .patterns import (
    RefactoringPattern,
    ExtractValidationPattern,
    ExtractNestedLoopPattern,
    ExtractErrorHandlingPattern,
    ExtractConditionalLogicPattern,
    detect_refactoring_opportunities,
    ALL_PATTERNS,
)

from .suggestions import (
    generate_suggestions,
    format_suggestions,
    find_function_in_file,
    extract_code_snippet,
)

__all__ = [
    'RefactoringPattern',
    'ExtractValidationPattern',
    'ExtractNestedLoopPattern',
    'ExtractErrorHandlingPattern',
    'ExtractConditionalLogicPattern',
    'detect_refactoring_opportunities',
    'ALL_PATTERNS',
    'generate_suggestions',
    'format_suggestions',
    'find_function_in_file',
    'extract_code_snippet',
]

