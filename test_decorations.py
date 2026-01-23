"""Test file for VS Code extension decorations.

This file contains functions with different complexity levels
to test the visual decorations in the VS Code extension.
"""


def simple_function():
    """Complexity: 1 - Should show GREEN decoration"""
    return 42


def low_complexity(x):
    """Complexity: 2 - Should show GREEN decoration"""
    if x > 0:
        return x
    return 0


def moderate_complexity(x, y):
    """Complexity: 4 - Should show GREEN decoration"""
    if x > 0:
        if y > 0:
            return x + y
        return x
    return 0


def warning_complexity(a, b, c):
    """Complexity: 10 - Should show YELLOW decoration"""
    if a > 0:
        if b > 0:
            if c > 0:
                if a > b:
                    if b > c:
                        return a + b + c
    return 0


def critical_complexity(a, b, c, d, e):
    """Complexity: 16+ - Should show RED decoration"""
    if a > 0:
        if b > 0:
            if c > 0:
                if d > 0:
                    if e > 0:
                        if a > b:
                            if b > c:
                                if c > d:
                                    if d > e:
                                        return a + b + c + d + e
    return 0


def mixed_complexity(items, threshold):
    """Complexity: 8 - Should show GREEN decoration"""
    result = []
    for item in items:
        if item > threshold:
            result.append(item * 2)
        elif item < 0:
            result.append(0)
        else:
            result.append(item)
    return result
