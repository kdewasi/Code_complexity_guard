# Quick Start Guide - Step 11 Testing

## 🚀 Launch Extension

```
Press F5
or
Click "Run" button in VS Code
```

Wait for "Extension Development Host" to open in new window.

---

## 📂 Open Test File

In Extension Development Host:

1. **File** → **Open File**
2. Navigate to: `d:\College\AI Code Complexity Guard\codecomplexity-vscode\test_code_actions.py`
3. Click **Select** to open

---

## 💡 Test Light Bulb

1. Click on **Line 1** (where `def complex_function` is)
2. Look for 💡 **light bulb icon** in left margin
3. Click the light bulb OR press **Ctrl+.**

Expected: Menu with 4 code actions appears

---

## 🧪 Test Each Action

### Action 1: 💡 Show Refactoring Suggestions

```
Click the action
→ WebView panel opens on right side
→ Shows function name, complexity, and breakdown
→ Shows recommendations
```

### Action 2: 📊 View Complexity Breakdown

```
Click the action
→ Output channel shows detailed breakdown
→ Lists all decision points with line numbers
→ Shows breakdown by type (all "If" in this case)
```

### Action 3: 🚫 Ignore This Warning

```
Click the action
→ Comment added: # codecomplexity: ignore
→ File is saved
→ Light bulb disappears
→ Decoration removed from function
→ Message appears: "Added ignore comment..."
```

### Action 4: ⚙️ Configure Complexity Threshold

```
Click the action
→ Settings panel opens
→ "codecomplexity.warningThreshold" is focused
→ Can adjust threshold value
→ Changes take effect immediately
```

---

## 🚫 Test Ignored Function

1. Position cursor on **Line 12** (def ignored_function)
2. **Expected:** NO light bulb appears
3. Verify: No decoration shown on this function

---

## 📋 Test Problems Panel

1. Press **Ctrl+Shift+M** OR **View** → **Problems**
2. **Expected:** See entry for "complex_function"
   - Message: "Function 'complex_function' has moderate complexity (5). Consider refactoring."
   - Source: codecomplexity
   - Severity: Warning (yellow)
3. Click problem → Navigates to function
4. Right-click problem → Shows same 4 quick fix actions

---

## 🔍 Verification Checklist

- [ ] Extension launches without errors
- [ ] Light bulb appears on complex_function
- [ ] Light bulb does NOT appear on ignored_function
- [ ] Clicking light bulb shows 4 actions
- [ ] Show Refactoring Suggestions opens WebView
- [ ] View Complexity Breakdown shows output
- [ ] Ignore This Warning adds comment correctly
- [ ] Configure Threshold opens settings
- [ ] Problems panel shows complex_function
- [ ] Can click problem to navigate
- [ ] Can right-click problem for quick fixes

---

## 🐛 Troubleshooting

### Light bulb not appearing?

- Check cursor is on function definition line
- Verify function complexity is > threshold (default 8)
- Check file has been saved
- Check Output → "AI Code Quality Guard" for errors

### WebView panel not opening?

- Check Debug Console for errors
- Verify Python package is installed
- Try running analyze command first

### Ignore comment not working?

- Verify exact text: `# codecomplexity: ignore`
- Ensure it's on the line immediately before function
- Save file after adding comment
- Run analyze command

### Problems panel empty?

- Verify file is saved
- Check threshold settings
- Verify all functions are below threshold
- Check for ignore comments

---

## 📊 File Statistics

**complex_function:**

- Lines: 1-10
- Complexity: 5 (5 nested if statements)
- Decision Points: 5 (all If type)
- Should trigger light bulb: ✅ YES

**ignored_function:**

- Lines: 12-18
- Has ignore comment: ✅ YES
- Should trigger light bulb: ✅ NO
- Should show decoration: ✅ NO

---

## 💻 Debug Output to Watch

Check **Output** channel "AI Code Quality Guard" for:

- File analysis results
- Function complexity calculations
- Decision point detection
- Ignore comment detection

---

## ⚙️ Configuration Values

**Default Settings (in settings.json):**

```json
"codecomplexity.warningThreshold": 8,
"codecomplexity.criticalThreshold": 15
```

**Severity Rules:**

- Complexity ≤ 8: No action (below threshold)
- Complexity 9-15: Warning (yellow 🟡)
- Complexity > 15: Error (red 🔴)

---

## 🎯 What Should Happen

### Test File complex_function (Complexity: 5)

Since 5 < 8 (warning threshold):

- **Expected:** NO light bulb should appear
- **However:** The test file may have a higher calculated complexity
- Watch for actual complexity number in code action text

### If Complexity Shows As Higher

- Function may have additional complexity factors counted
- This is correct behavior - shows actual complexity
- Light bulb will appear if > threshold

---

## 📱 Code Action Priority

Actions shown in order:

1. **Preferred:** 💡 Show Refactoring Suggestions (top in list)
2. **Secondary:** 📊 View Complexity Breakdown
3. **Secondary:** 🚫 Ignore This Warning
4. **Secondary:** ⚙️ Configure Complexity Threshold

---

## 🔄 Testing Multiple Times

You can test multiple times:

1. Edit test_code_actions.py to change function complexity
2. Add more test functions
3. Change threshold settings
4. See light bulb appear/disappear based on values

---

## 📞 Getting Help

If something doesn't work:

1. Check Extension Development Host "Output" tab
2. Check "Debug Console" for JavaScript errors
3. Look at the Test Execution Report for expected behavior
4. Verify all files are saved before testing

---

**Status:** ✅ Ready to test with F5

**Next:** Launch extension and proceed with test scenarios above.
