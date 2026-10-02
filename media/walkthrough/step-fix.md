# Suggestions with before/after code

When the analyser recognises a known slow pattern, it tells you what is happening, what to do, and the expected effect:

- `x in big_list` inside a loop → build a set once: **O(n²) → O(n)**
- `s += part` inside a loop → join / StringBuilder: **O(n²) → O(n)**
- `fib(n-1) + fib(n-2)` → memoize: **O(2ⁿ) → O(n)**
- `queue.pop(0)` / `array.shift()` in a loop → deque or index pointer
- sorting inside a loop → sort once outside
- five levels of `if` → guard clauses

Open them from the light bulb (`Ctrl+.`), the hover, the Problems panel, or the Complexity Report.
