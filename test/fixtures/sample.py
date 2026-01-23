"""Sample Python file for testing."""

def simple_function(x):
    """Simple function with low complexity."""
    return x * 2

def moderate_complexity(a, b, c):
    """Function with moderate complexity."""
    if a > 0:
        if b > 0:
            return a + b
        else:
            return a - b
    elif c > 0:
        return c
    else:
        return 0

def high_complexity(x, y, z, w):
    """Function with high complexity for testing."""
    result = 0
    if x > 0:
        if y > 0:
            if z > 0:
                if w > 0:
                    result = x + y + z + w
                else:
                    result = x + y + z
            else:
                result = x + y
        else:
            result = x
    elif y > 0:
        if z > 0:
            result = y + z
        else:
            result = y
    else:
        result = 0
    return result

# codecomplexity: ignore
def ignored_function(a, b):
    """This function should be ignored."""
    if a:
        if b:
            return a + b
    return 0
