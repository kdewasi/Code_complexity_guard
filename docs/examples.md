# Refactoring Examples

Real-world examples of code refactoring to reduce complexity.

## Example 1: Validation Chain

### Before (Complexity: 8)

```python
def create_user(email, password, name, age):
    """Create a new user account."""
    if not email:
        raise ValueError("Email is required")
    if '@' not in email:
        raise ValueError("Invalid email format")
    if not password:
        raise ValueError("Password is required")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not name:
        raise ValueError("Name is required")
    if not age:
        raise ValueError("Age is required")
    if age < 18:
        raise ValueError("Must be 18 or older")
    
    # Create user...
    return User(email=email, password=password, name=name, age=age)
```

### After (Complexity: 2 + 5 = 7 total, but cleaner)

```python
def create_user(email, password, name, age):
    """Create a new user account."""
    validate_user_input(email, password, name, age)
    return User(email=email, password=password, name=name, age=age)

def validate_user_input(email, password, name, age):
    """Validate all user input fields."""
    if not email or '@' not in email:
        raise ValueError("Valid email is required")
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not name:
        raise ValueError("Name is required")
    if not age or age < 18:
        raise ValueError("Must be 18 or older")
```

**Improvements:**
- ✅ Separated concerns (creation vs validation)
- ✅ More testable (can test validation independently)
- ✅ Combined related checks
- ✅ Clearer function purpose

---

## Example 2: Nested Conditionals

### Before (Complexity: 12)

```python
def process_order(order, user, config):
    """Process a customer order."""
    if order is not None:
        if user.is_authenticated:
            if order.status == 'pending':
                if config.auto_approve:
                    if order.total < config.limit:
                        if order.items:
                            if all(item.in_stock for item in order.items):
                                return approve_order(order)
                            else:
                                return "Items out of stock"
                        else:
                            return "No items in order"
                    else:
                        return "Order exceeds limit"
                else:
                    return "Manual approval required"
            else:
                return f"Invalid status: {order.status}"
        else:
            return "User not authenticated"
    else:
        return "No order provided"
```

### After (Complexity: 4)

```python
def process_order(order, user, config):
    """Process a customer order."""
    # Early returns for invalid states
    if not order:
        return "No order provided"
    if not user.is_authenticated:
        return "User not authenticated"
    if order.status != 'pending':
        return f"Invalid status: {order.status}"
    
    # Check if can auto-approve
    if not can_auto_approve(order, config):
        return "Manual approval required"
    
    return approve_order(order)

def can_auto_approve(order, config):
    """Check if order can be auto-approved."""
    if not config.auto_approve:
        return False
    if order.total >= config.limit:
        return False
    if not order.items:
        return False
    return all(item.in_stock for item in order.items)
```

**Improvements:**
- ✅ Early returns eliminate nesting
- ✅ Extracted approval logic
- ✅ Much easier to read
- ✅ Easier to add new conditions

---

## Example 3: Long If/Elif Chain

### Before (Complexity: 8)

```python
def calculate_shipping(method, weight, distance):
    """Calculate shipping cost."""
    if method == 'standard':
        base = 5
        rate = 0.5
    elif method == 'express':
        base = 10
        rate = 1.0
    elif method == 'overnight':
        base = 20
        rate = 2.0
    elif method == 'international':
        base = 30
        rate = 3.0
    elif method == 'economy':
        base = 3
        rate = 0.3
    else:
        base = 5
        rate = 0.5
    
    return base + (weight * rate) + (distance * 0.1)
```

### After (Complexity: 1)

```python
# Configuration
SHIPPING_METHODS = {
    'standard': {'base': 5, 'rate': 0.5},
    'express': {'base': 10, 'rate': 1.0},
    'overnight': {'base': 20, 'rate': 2.0},
    'international': {'base': 30, 'rate': 3.0},
    'economy': {'base': 3, 'rate': 0.3},
}

DEFAULT_SHIPPING = {'base': 5, 'rate': 0.5}

def calculate_shipping(method, weight, distance):
    """Calculate shipping cost."""
    config = SHIPPING_METHODS.get(method, DEFAULT_SHIPPING)
    return config['base'] + (weight * config['rate']) + (distance * 0.1)
```

**Improvements:**
- ✅ Data-driven instead of procedural
- ✅ Easy to add new shipping methods
- ✅ Configuration can be externalized
- ✅ Much simpler logic

---

## Example 4: Complex Boolean Logic

### Before (Complexity: 9)

```python
def can_edit_post(user, post):
    """Check if user can edit post."""
    if user.is_admin or user.is_moderator:
        if post.is_published or post.is_draft:
            if not post.is_deleted:
                if not post.is_locked:
                    if user.id == post.author_id or user.is_admin:
                        return True
    return False
```

### After (Complexity: 5)

```python
def can_edit_post(user, post):
    """Check if user can edit post."""
    if not has_edit_permission(user):
        return False
    if not is_editable_status(post):
        return False
    if not is_author_or_admin(user, post):
        return False
    return True

def has_edit_permission(user):
    """Check if user has editing permissions."""
    return user.is_admin or user.is_moderator

def is_editable_status(post):
    """Check if post is in editable status."""
    if post.is_deleted or post.is_locked:
        return False
    return post.is_published or post.is_draft

def is_author_or_admin(user, post):
    """Check if user is author or admin."""
    return user.id == post.author_id or user.is_admin
```

**Improvements:**
- ✅ Named helper functions explain intent
- ✅ Each function has single responsibility
- ✅ Easier to test each condition
- ✅ More maintainable

---

## Example 5: Error Handling

### Before (Complexity: 10)

```python
def load_config(filepath):
    """Load configuration from file."""
    try:
        with open(filepath) as f:
            data = json.load(f)
            if 'version' in data:
                if data['version'] == '2.0':
                    return parse_v2_config(data)
                elif data['version'] == '1.0':
                    return parse_v1_config(data)
                else:
                    raise ValueError(f"Unsupported version: {data['version']}")
            else:
                raise ValueError("No version specified")
    except FileNotFoundError:
        return get_default_config()
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format")
    except KeyError as e:
        raise ValueError(f"Missing required field: {e}")
```

### After (Complexity: 3 + 3 = 6 total)

```python
def load_config(filepath):
    """Load configuration from file."""
    try:
        data = read_config_file(filepath)
        return parse_config_data(data)
    except FileNotFoundError:
        return get_default_config()

def read_config_file(filepath):
    """Read and parse JSON config file."""
    try:
        with open(filepath) as f:
            return json.load(f)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format")

def parse_config_data(data):
    """Parse configuration data based on version."""
    version = data.get('version')
    
    if not version:
        raise ValueError("No version specified")
    
    parsers = {
        '1.0': parse_v1_config,
        '2.0': parse_v2_config,
    }
    
    parser = parsers.get(version)
    if not parser:
        raise ValueError(f"Unsupported version: {version}")
    
    return parser(data)
```

**Improvements:**
- ✅ Separated file I/O from parsing
- ✅ Strategy pattern for version handling
- ✅ Easier to add new versions
- ✅ Better error messages

---

## Example 6: Loop with Complex Logic

### Before (Complexity: 8)

```python
def process_transactions(transactions):
    """Process a list of transactions."""
    results = []
    for transaction in transactions:
        if transaction.status == 'pending':
            if transaction.amount > 0:
                if transaction.account.balance >= transaction.amount:
                    transaction.account.balance -= transaction.amount
                    transaction.status = 'completed'
                    results.append(transaction)
                else:
                    transaction.status = 'failed'
                    transaction.error = 'Insufficient funds'
            else:
                transaction.status = 'failed'
                transaction.error = 'Invalid amount'
    return results
```

### After (Complexity: 2 + 4 = 6 total)

```python
def process_transactions(transactions):
    """Process a list of transactions."""
    return [
        process_transaction(t)
        for t in transactions
        if t.status == 'pending'
    ]

def process_transaction(transaction):
    """Process a single transaction."""
    if transaction.amount <= 0:
        return fail_transaction(transaction, 'Invalid amount')
    
    if transaction.account.balance < transaction.amount:
        return fail_transaction(transaction, 'Insufficient funds')
    
    # Process successful transaction
    transaction.account.balance -= transaction.amount
    transaction.status = 'completed'
    return transaction

def fail_transaction(transaction, error):
    """Mark transaction as failed."""
    transaction.status = 'failed'
    transaction.error = error
    return transaction
```

**Improvements:**
- ✅ Extracted single transaction processing
- ✅ Separate function for failures
- ✅ List comprehension for filtering
- ✅ Easier to test individual transactions

---

## Example 7: State Machine

### Before (Complexity: 15)

```python
def handle_request(request, state):
    """Handle request based on current state."""
    if state == 'idle':
        if request.type == 'start':
            return 'processing', start_processing(request)
        else:
            return 'idle', error('Invalid request')
    elif state == 'processing':
        if request.type == 'cancel':
            return 'idle', cancel_processing()
        elif request.type == 'complete':
            return 'completed', finish_processing()
        else:
            return 'processing', continue_processing(request)
    elif state == 'completed':
        if request.type == 'reset':
            return 'idle', reset()
        else:
            return 'completed', error('Already completed')
    else:
        return 'error', error('Unknown state')
```

### After (Complexity: 2)

```python
# State transition table
STATE_TRANSITIONS = {
    'idle': {
        'start': ('processing', start_processing),
    },
    'processing': {
        'cancel': ('idle', cancel_processing),
        'complete': ('completed', finish_processing),
        'continue': ('processing', continue_processing),
    },
    'completed': {
        'reset': ('idle', reset),
    },
}

def handle_request(request, state):
    """Handle request based on current state."""
    transitions = STATE_TRANSITIONS.get(state, {})
    transition = transitions.get(request.type)
    
    if not transition:
        return state, error(f'Invalid request: {request.type} in state {state}')
    
    new_state, handler = transition
    result = handler(request) if callable(handler) else handler()
    return new_state, result
```

**Improvements:**
- ✅ Declarative state machine
- ✅ Easy to visualize transitions
- ✅ Simple to add new states/transitions
- ✅ Testable transition table

---

## AI Refactoring Examples

These examples show actual AI-powered refactorings from the extension:

### Example: Payment Processing

**Original (Complexity: 18):**
```python
def process_payment(user, amount, payment_method, billing_address):
    if not user:
        raise ValueError("User required")
    if not amount or amount <= 0:
        raise ValueError("Valid amount required")
    if not payment_method:
        raise ValueError("Payment method required")
    
    if payment_method == 'credit_card':
        if not billing_address:
            raise ValueError("Billing address required for credit card")
        if not validate_credit_card(payment_method.card_number):
            raise ValueError("Invalid credit card")
        charge = process_credit_card(amount, payment_method, billing_address)
    elif payment_method == 'paypal':
        if not payment_method.email:
            raise ValueError("PayPal email required")
        charge = process_paypal(amount, payment_method.email)
    elif payment_method == 'bank_transfer':
        if not payment_method.account_number:
            raise ValueError("Account number required")
        charge = process_bank_transfer(amount, payment_method.account_number)
    else:
        raise ValueError(f"Unsupported payment method: {payment_method}")
    
    if charge.success:
        user.balance += amount
        return charge
    else:
        raise ValueError(f"Payment failed: {charge.error}")
```

**AI Refactored (Complexity: 3 + 4 + 3 = 10 total):**
```python
def process_payment(user, amount, payment_method, billing_address):
    """Process payment with given method."""
    validate_payment_request(user, amount, payment_method)
    charge = execute_payment(amount, payment_method, billing_address)
    return finalize_payment(user, amount, charge)

def validate_payment_request(user, amount, payment_method):
    """Validate payment request parameters."""
    if not user:
        raise ValueError("User required")
    if not amount or amount <= 0:
        raise ValueError("Valid amount required")
    if not payment_method:
        raise ValueError("Payment method required")

def execute_payment(amount, payment_method, billing_address):
    """Execute payment based on method type."""
    processors = {
        'credit_card': lambda: process_credit_card_payment(amount, payment_method, billing_address),
        'paypal': lambda: process_paypal_payment(amount, payment_method),
        'bank_transfer': lambda: process_bank_transfer_payment(amount, payment_method),
    }
    
    processor = processors.get(payment_method.type)
    if not processor:
        raise ValueError(f"Unsupported payment method: {payment_method.type}")
    
    return processor()

def finalize_payment(user, amount, charge):
    """Finalize successful payment."""
    if not charge.success:
        raise ValueError(f"Payment failed: {charge.error}")
    user.balance += amount
    return charge
```

**AI Insights:**
- Separated validation, execution, and finalization
- Used strategy pattern for payment methods
- Improved error handling
- 44% complexity reduction

---

## Summary of Techniques

| Technique | Best For | Complexity Reduction |
|-----------|----------|---------------------|
| Extract Method | Long functions | 20-40% |
| Early Returns | Nested conditions | 30-50% |
| Strategy Pattern | If/elif chains | 40-60% |
| Data-Driven | Configuration logic | 50-70% |
| Helper Functions | Complex boolean logic | 20-30% |
| State Machines | Complex state handling | 40-60% |

---

## Next Steps

1. **Try these patterns** in your own code
2. **Use the extension** to identify complex functions
3. **Let AI help** with automatic refactoring
4. **Measure results** - track complexity before/after

---

**Happy refactoring!** ✨
