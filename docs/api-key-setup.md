# API Key Setup Guide

Complete guide to setting up Claude API for AI-powered refactoring.

## Do I Need an API Key?

**No!** The extension works great without an API key. You get:
- ✅ Real-time complexity analysis
- ✅ Visual decorations
- ✅ Code action suggestions
- ✅ Problems panel integration
- ✅ Manual refactoring recommendations

**With an API key**, you additionally get:
- 🤖 AI-powered automatic refactoring
- 🔄 One-click code improvements
- 📊 Intelligent pattern recognition
- ✨ Context-aware suggestions

## Getting a Claude API Key

### Step 1: Create Anthropic Account

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Click **Sign Up** (or **Log In** if you have an account)
3. Complete the registration process
4. Verify your email address

### Step 2: Add Payment Method

1. Navigate to **Settings** → **Billing**
2. Click **Add Payment Method**
3. Enter your credit/debit card information
4. Anthropic charges only for actual usage (no monthly fees)

**Pricing:**
- Claude 3.5 Sonnet: $3 per 1M input tokens, $15 per 1M output tokens
- Typical refactoring: 500-2000 tokens = **$0.01-0.05 per function**

### Step 3: Create API Key

1. Navigate to **API Keys** in the console
2. Click **Create Key**
3. Give it a descriptive name (e.g., "VS Code Extension")
4. Click **Create**
5. **Copy the key immediately** (starts with `sk-ant-`)
6. Store it securely - you won't see it again!

## Configuring the API Key

### Option 1: VS Code Settings (Recommended)

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "codecomplexity api"
3. Find `codecomplexity.apiKey`
4. Paste your API key
5. Save (happens automatically)

**Settings JSON:**
```json
{
  "codecomplexity.apiKey": "sk-ant-api03-..."
}
```

**Pros:**
- ✅ Secure storage in VS Code
- ✅ Easy to update
- ✅ Works across all projects

**Cons:**
- ❌ Stored on your machine only
- ❌ Need to reconfigure on new machines

---

### Option 2: Environment Variable

Set the `ANTHROPIC_API_KEY` environment variable.

**Windows (PowerShell):**
```powershell
# Temporary (current session)
$env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"

# Permanent (all sessions)
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-your-key-here', 'User')
```

**Windows (Command Prompt):**
```cmd
# Temporary
set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Permanent
setx ANTHROPIC_API_KEY "sk-ant-your-key-here"
```

**macOS/Linux (Bash/Zsh):**
```bash
# Temporary (current session)
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

**Pros:**
- ✅ Works across all applications
- ✅ Easy to share across team (via .env files)
- ✅ Standard practice for API keys

**Cons:**
- ❌ Requires terminal/system knowledge
- ❌ Need to restart VS Code after setting

---

### Option 3: .env File (For Projects)

Create a `.env` file in your project root:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Important:** Add `.env` to `.gitignore`:
```
# .gitignore
.env
```

**Pros:**
- ✅ Per-project configuration
- ✅ Easy to manage
- ✅ Won't be committed to git

**Cons:**
- ❌ Requires additional setup
- ❌ Extension must support .env files

---

## Verifying Your Setup

### Test 1: Check Configuration

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "codecomplexity api"
3. Verify key is set (shows as `••••••••`)

### Test 2: Try AI Refactoring

1. Open a Python file with a complex function
2. Click the 💡 light bulb
3. Select "Auto-Refactor with AI"
4. If configured correctly, you'll see a confirmation dialog
5. Click "Yes" to proceed
6. Wait for AI to generate refactoring
7. Review changes in diff view

### Test 3: Check Output Panel

1. Open Output panel: View → Output
2. Select "AI Code Quality Guard" from dropdown
3. Look for messages like:
   - ✅ "AI refactoring completed successfully"
   - ❌ "API key not configured" (if not set)
   - ❌ "Invalid API key" (if key is wrong)

---

## Security Best Practices

### ✅ DO:

- **Store in VS Code settings** or environment variables
- **Use separate keys** for different machines/projects
- **Rotate keys periodically** (every 3-6 months)
- **Revoke compromised keys** immediately
- **Add .env to .gitignore** if using .env files
- **Use workspace settings** for team projects

### ❌ DON'T:

- **Commit API keys to git** - Ever!
- **Share keys publicly** - GitHub, forums, etc.
- **Hardcode keys in code** - Use configuration
- **Use same key everywhere** - Separate keys for dev/prod
- **Share keys with untrusted people**

---

## Cost Management

### Understanding Costs

**Pricing (Claude 3.5 Sonnet):**
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

**Typical Usage:**
- Simple function refactoring: 500-1000 tokens = $0.01-0.02
- Complex function refactoring: 1000-2000 tokens = $0.02-0.05
- Very complex refactoring: 2000-4000 tokens = $0.05-0.10

**Monthly estimates:**
- Light use (5 refactorings/day): ~$3-5/month
- Medium use (20 refactorings/day): ~$10-20/month
- Heavy use (50 refactorings/day): ~$25-50/month

### Cost Control Tips

1. **Use confirmation prompts** (default: enabled)
   ```json
   {
     "codecomplexity.confirmBeforeRefactor": true
   }
   ```

2. **Reduce max tokens** for simple refactorings
   ```json
   {
     "codecomplexity.maxTokens": 2000
   }
   ```

3. **Use cheaper model** for simple cases
   ```json
   {
     "codecomplexity.aiModel": "claude-3-sonnet-20240229"
   }
   ```

4. **Set usage limits** in Anthropic Console
   - Settings → Billing → Usage Limits
   - Set monthly budget (e.g., $20)
   - Get alerts at 50%, 75%, 90%

5. **Monitor usage** in Anthropic Console
   - Dashboard shows daily/monthly usage
   - Track costs per project
   - Review API call logs

---

## Troubleshooting

### "API key not configured"

**Cause:** No API key set

**Solution:**
1. Follow setup steps above
2. Verify key is in settings or environment variable
3. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"

---

### "Invalid API key"

**Cause:** Key is incorrect or revoked

**Solution:**
1. Check for typos in key
2. Verify key starts with `sk-ant-`
3. Check for extra spaces before/after key
4. Verify key is active in Anthropic Console
5. Create a new key if needed

---

### "Rate limit exceeded"

**Cause:** Too many API calls in short time

**Solution:**
1. Wait a few minutes
2. Reduce refactoring frequency
3. Upgrade to higher tier in Anthropic Console

---

### "Insufficient credits"

**Cause:** No payment method or credits exhausted

**Solution:**
1. Add payment method in Anthropic Console
2. Check billing settings
3. Verify card is valid
4. Contact Anthropic support if issues persist

---

### API calls not working

**Cause:** Network issues or firewall

**Solution:**
1. Check internet connection
2. Verify firewall allows HTTPS to api.anthropic.com
3. Try disabling VPN temporarily
4. Check corporate proxy settings

---

## Team Setup

### For Team Leads

**Option 1: Individual Keys (Recommended)**

Each team member gets their own API key:

1. Each person creates Anthropic account
2. Each person adds their own payment method
3. Each person configures their own key
4. Track usage individually

**Pros:**
- ✅ Individual cost tracking
- ✅ Better security
- ✅ No shared credentials

**Cons:**
- ❌ Each person pays separately
- ❌ More setup overhead

---

**Option 2: Shared Key (Not Recommended)**

Use one API key for the team:

1. Create organization Anthropic account
2. Share key via secure channel (1Password, etc.)
3. Each team member configures same key
4. Monitor usage centrally

**Pros:**
- ✅ Centralized billing
- ✅ Easier setup

**Cons:**
- ❌ Security risk if key leaks
- ❌ Can't track individual usage
- ❌ One person's overuse affects everyone

---

### For Team Members

If your team provides an API key:

1. **Never commit the key to git**
2. Store in VS Code settings (user, not workspace)
3. Or use environment variable
4. Report any suspected key leaks immediately

---

## FAQ

**Q: Is my code sent to Anthropic?**  
A: Only when you use AI refactoring. Regular analysis is 100% local.

**Q: What data is sent to Anthropic?**  
A: Only the function code you're refactoring, plus context about complexity.

**Q: Can I use without an API key?**  
A: Yes! All features except AI auto-refactoring work without a key.

**Q: How much does it cost?**  
A: Typically $0.01-0.05 per function refactoring. See cost section above.

**Q: Can I use a different AI provider?**  
A: Currently only Claude is supported. Other providers may be added in future.

**Q: Is my API key secure in VS Code?**  
A: Yes, VS Code uses secure storage for sensitive settings.

**Q: Can I set different keys for different projects?**  
A: Yes, use workspace settings or .env files per project.

---

## Next Steps

Once your API key is configured:

1. **Try it out** - Refactor a complex function
2. **Monitor costs** - Check Anthropic Console
3. **Adjust settings** - Fine-tune for your needs
4. **Read examples** - See [Examples](./examples.md)

---

## Support

- **Anthropic Support**: https://support.anthropic.com/
- **Extension Issues**: [GitHub Issues](https://github.com/yourusername/codecomplexity/issues)
- **Documentation**: [Full Docs](../)

---

**Happy refactoring!** 🤖✨
