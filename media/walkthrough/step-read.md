# The four numbers

| Metric | Question it answers | Comfortable range |
|---|---|---|
| **Cyclomatic** | How many paths run through the function? (= test cases needed) | 1–8 |
| **Cognitive** | How hard is it for a person to follow? Nesting costs extra. | 0–15 |
| **Time** | How does run time grow when the input grows? | O(1), O(log n), O(n), O(n log n) |
| **Space** | How much extra memory grows with the input? | O(1), O(log n), O(n) |

Big-O is estimated from the structure of the code: nested loops multiply, a loop variable that halves each step is `log n`, sort calls cost `n log n`, recursion follows the standard recurrences, and calls to helpers in the same file are included.

Hover over a function name to see **why** it got each number, line by line.
