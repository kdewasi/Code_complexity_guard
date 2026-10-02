# Publishing guide

Publisher: `Kishan-aicodeguard` · Extension id: `codecomplexity` · Marketplace page: <https://marketplace.visualstudio.com/items?itemName=Kishan-aicodeguard.codecomplexity>

## One-time setup: Personal Access Token

1. Go to <https://dev.azure.com> and open **User settings → Personal access tokens**.
2. **New Token**: name it `vsce`, organization *All accessible organizations*, scope **Marketplace → Manage**, expiry up to one year.
3. Copy the token (it is shown once).

## Option A: automatic publishing from GitHub (recommended)

1. In the GitHub repository go to **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `VSCE_PAT`, value: the token.
3. Push a version tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   The **Publish Extension** workflow (`.github/workflows/publish.yml`) builds, runs the unit tests, packages the `.vsix`, attaches it to a GitHub Release, and publishes to the Marketplace. If the secret is missing, everything except the Marketplace upload still happens and the job prints a reminder.

## Option B: publish from your machine

```bash
npm install
npm run build
npm test
npx vsce publish -p <your-PAT>
```

or interactively: `npx vsce login Kishan-aicodeguard` then `npx vsce publish`.

The version in `package.json` must be higher than the one on the Marketplace. `npx vsce publish patch|minor|major` bumps it for you.

## Verifying

- Install the generated `.vsix` locally: `code --install-extension codecomplexity-1.0.0.vsix`.
- Open any `.py` / `.java` / `.ts` file: a CodeLens line must appear above each function within a second.
- The Marketplace listing takes a few minutes to update after publishing.
