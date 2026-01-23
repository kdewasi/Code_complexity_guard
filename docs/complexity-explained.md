# Understanding Cyclomatic Complexity

A comprehensive guide to understanding code complexity metrics.

## What is Cyclomatic Complexity?

**Cyclomatic complexity** is a software metric that measures the number of linearly independent paths through a program's source code. In simpler terms, it counts how many different ways your code can execute.

### Why It Matters

Complex code is:
- **Harder to understand** - More cognitive load for developers
- **Harder to test** - More test cases needed for full coverage
- **More likely to have bugs** - Complexity correlates with defect density
- **Harder to maintain** - Changes are riskier and take longer

### The Formula

```
Complexity = 1 + number of decision points
```

A **decision point** is anywhere the code can branch:
- `if` / `elif` statements
- `for` / `while` loops
- `and` / `or` operators
- `try` / `except` blocks
- Ternary operators (`x if condition else y`)
- List/dict comprehensions with `if`

---

## Complexity Levels

### ✅ Simple (1-5)

**Characteristics:**
- Linear flow with few branches
- Easy to understand at a glance
- Low testing burden
- Low risk of bugs

**Example:**
```python
def calculate_total(price, quantity):
    """Complexity: 1"""
    return price * quantity
```

**Recommendation:** ✅ Good code - no action needed

---

### 🟡 Moderate (6-10)

**Characteristics:**
- Some branching logic
- Still manageable
- Moderate testing needed
- Medium risk

**Example:**
```python
def calculate_discount(price, customer_type):
    """Complexity: 3"""
    if customer_type == 'premium':
        return price * 0.8
    elif customer_type == 'regular':
        return price * 0.9
    else:
        return price
```

**Recommendation:** 🟡 Consider simplifying if it grows more complex

---

### 🟠 Complex (11-20)

**Characteristics:**
- Multiple nested conditions
- Hard to follow logic
- Extensive testing required
- High risk of bugs

**Example:**
```python
def process_order(order, user, config):
    """Complexity: 12"""
    if order is not None:
        if user.is_authenticated:
            if order.status == 'pending':
                if config.auto_approve:
                    if order.total < config.limit:
                        if order.items:
                            if all(item.in_stock for item in order.items):
                                return approve_order(order)
    return None
```

**Recommendation:** 🟠 Refactoring recommended

---

### 🔴 Very Complex (21+)

**Characteristics:**
- Deeply nested logic
- Nearly impossible to understand
- Testing is very difficult
- Very high bug risk

**Example:**
```python
def legacy_processor(data, options, flags):
    """Complexity: 25+"""
    # Imagine 25+ decision points here...
    # This is a maintenance nightmare!
```

**Recommendation:** 🔴 Refactor immediately

---

## How Complexity is Calculated

### Basic Example

```python
def example1(x):
    """Complexity: 1"""
    return x * 2
```

**Calculation:**
- Base: 1
- Decision points: 0
- **Total: 1**

---

### With If Statement

```python
def example2(x):
    """Complexity: 2"""
    if x > 0:
        return x
    return 0
```

**Calculation:**
- Base: 1
- `if`: +1
- **Total: 2**

---

### With If/Elif/Else

```python
def example3(x):
    """Complexity: 3"""
    if x > 0:
        return 1
    elif x < 0:
        return -1
    else:
        return 0
```

**Calculation:**
- Base: 1
- `if`: +1
- `elif`: +1
- `else`: +0 (doesn't add complexity)
- **Total: 3**

---

### With Loops

```python
def example4(items):
    """Complexity: 2"""
    total = 0
    for item in items:
        total += item
    return total
```

**Calculation:**
- Base: 1
- `for`: +1
- **Total: 2**

---

### With Boolean Operators

```python
def example5(x, y):
    """Complexity: 3"""
    if x > 0 and y > 0:
        return x + y
    return 0
```

**Calculation:**
- Base: 1
- `if`: +1
- `and`: +1
- **Total: 3**

---

### With Try/Except

```python
def example6(x):
    """Complexity: 3"""
    try:
        return 1 / x
    except ZeroDivisionError:
        return 0
    except ValueError:
        return -1
```

**Calculation:**
- Base: 1
- First `except`: +1
- Second `except`: +1
- **Total: 3**

---

### Complex Example

```python
def complex_example(x, y, z):
    """Complexity: 7"""
    result = 0
    
    if x > 0:  # +1
        if y > 0:  # +1
            result = x + y
        elif y < 0:  # +1
            result = x - y
    
    for i in range(z):  # +1
        if i % 2 == 0:  # +1
            result += i
    
    return result if result > 0 else 0  # +1 (ternary)
```

**Calculation:**
- Base: 1
- First `if`: +1
- Nested `if`: +1
- `elif`: +1
- `for`: +1
- `if` in loop: +1
- Ternary: +1
- **Total: 7**

---

## Industry Guidelines

### McCabe's Original Recommendation

Thomas McCabe (who invented the metric) recommended:

- **1-10**: Low risk, simple procedure
- **11-20**: Moderate risk, more complex
- **21-50**: High risk, complex, alarming
- **50+**: Untestable, very high risk

### Modern Best Practices

Most teams use stricter thresholds:

| Threshold | Level | Action |
|-----------|-------|--------|
| 1-5 | ✅ Simple | None needed |
| 6-10 | 🟡 Moderate | Consider refactoring |
| 11-15 | 🟠 Complex | Refactoring recommended |
| 16-20 | 🔴 Very Complex | Refactoring strongly recommended |
| 21+ | ⛔ Extremely Complex | Refactor immediately |

### By Project Type

**Web Applications:**
- Warning: 8
- Critical: 15

**System Software:**
- Warning: 10
- Critical: 20

**Safety-Critical Systems:**
- Warning: 5
- Critical: 10

**Legacy Code (gradual improvement):**
- Warning: 15
- Critical: 25

---

## Common Patterns That Increase Complexity

### 1. Nested Conditions

```python
# Complexity: 5
if condition1:
    if condition2:
        if condition3:
            if condition4:
                do_something()
```

**Better:**
```python
# Complexity: 4
if not condition1:
    return
if not condition2:
    return
if not condition3:
    return
if not condition4:
    return
do_something()
```

---

### 2. Long If/Elif Chains

```python
# Complexity: 6
if status == 'pending':
    handle_pending()
elif status == 'approved':
    handle_approved()
elif status == 'rejected':
    handle_rejected()
elif status == 'cancelled':
    handle_cancelled()
elif status == 'completed':
    handle_completed()
```

**Better:**
```python
# Complexity: 2
handlers = {
    'pending': handle_pending,
    'approved': handle_approved,
    'rejected': handle_rejected,
    'cancelled': handle_cancelled,
    'completed': handle_completed,
}
handler = handlers.get(status, handle_unknown)
handler()
```

---

### 3. Complex Boolean Logic

```python
# Complexity: 5
if (user.is_admin or user.is_moderator) and \
   (post.is_published or post.is_draft) and \
   not post.is_deleted:
    allow_edit()
```

**Better:**
```python
# Complexity: 3
def can_edit_post(user, post):
    has_permission = user.is_admin or user.is_moderator
    is_editable = post.is_published or post.is_draft
    is_available = not post.is_deleted
    return has_permission and is_editable and is_available

if can_edit_post(user, post):
    allow_edit()
```

---

## Limitations of Complexity Metrics

### What Complexity Measures

✅ **Does measure:**
- Number of decision points
- Control flow complexity
- Testing difficulty

### What Complexity Doesn't Measure

❌ **Doesn't measure:**
- Code readability
- Variable naming quality
- Documentation quality
- Algorithmic complexity (Big O)
- Code duplication
- Coupling between modules

### Example of Low Complexity, Bad Code

```python
def x(a, b):
    """Complexity: 1 - but terrible code!"""
    return a * b + a / b - a ** b
```

This has low complexity but is:
- Poorly named
- Undocumented
- Unclear purpose
- No error handling

**Lesson:** Use complexity as one metric among many!

---

## Reducing Complexity

### Technique 1: Extract Methods

**Before (Complexity: 12):**
```python
def process_user(user):
    if not user.email:
        raise ValueError("Email required")
    if not user.name:
        raise ValueError("Name required")
    if not user.age or user.age < 18:
        raise ValueError("Must be 18+")
    
    if user.is_premium:
        discount = 0.2
    elif user.is_member:
        discount = 0.1
    else:
        discount = 0
    
    # ... more logic
```

**After (Complexity: 4 + 3 + 3 = 10 total, but simpler):**
```python
def process_user(user):
    validate_user(user)
    discount = calculate_discount(user)
    # ... more logic

def validate_user(user):
    if not user.email:
        raise ValueError("Email required")
    if not user.name:
        raise ValueError("Name required")
    if not user.age or user.age < 18:
        raise ValueError("Must be 18+")

def calculate_discount(user):
    if user.is_premium:
        return 0.2
    elif user.is_member:
        return 0.1
    return 0
```

---

### Technique 2: Early Returns

**Before (Complexity: 5):**
```python
def process(data):
    if data:
        if data.is_valid:
            if data.is_complete:
                return process_data(data)
    return None
```

**After (Complexity: 4):**
```python
def process(data):
    if not data:
        return None
    if not data.is_valid:
        return None
    if not data.is_complete:
        return None
    return process_data(data)
```

---

### Technique 3: Strategy Pattern

**Before (Complexity: 6):**
```python
def calculate_shipping(method, weight):
    if method == 'standard':
        return weight * 2
    elif method == 'express':
        return weight * 5
    elif method == 'overnight':
        return weight * 10
    elif method == 'international':
        return weight * 15
    return weight
```

**After (Complexity: 1):**
```python
SHIPPING_RATES = {
    'standard': 2,
    'express': 5,
    'overnight': 10,
    'international': 15,
}

def calculate_shipping(method, weight):
    rate = SHIPPING_RATES.get(method, 1)
    return weight * rate
```

---

## Tools and Integration

### VS Code Extension

This extension provides:
- Real-time complexity calculation
- Visual indicators
- Refactoring suggestions
- AI-powered improvements

### Python CLI

```bash
# Analyze a file
codecomplexity analyze myfile.py

# Get suggestions
codecomplexity suggest myfile.py --function my_function
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Check complexity
  run: codecomplexity analyze src/ --threshold 15
```

---

## Further Reading

- **Original Paper**: "A Complexity Measure" by Thomas J. McCabe (1976)
- **Book**: "Code Complete" by Steve McConnell
- **Book**: "Clean Code" by Robert C. Martin
- **Tool**: Radon (Python complexity tool)
- **Tool**: SonarQube (multi-language analysis)

---

## Summary

- **Complexity measures decision points** in code
- **Lower is better** - aim for < 10
- **Use as a guide**, not absolute rule
- **Combine with other metrics** for best results
- **Refactor complex code** to improve maintainability

---

**Remember:** The goal isn't zero complexity - it's **appropriate** complexity for the task!
