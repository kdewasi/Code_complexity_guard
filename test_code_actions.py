def complex_function(a, b, c, d, e):
    """This should trigger code actions"""
    if a > 0:
        if b > 0:
            if c > 0:
                if d > 0:
                    if e > 0:
                        return a + b + c + d + e
    return 0
# codecomplexity: ignore
def ignored_function(x, y, z):
    """This should NOT show code actions"""
    if x:
        if y:
            if z:
                return x + y + z
    return 0