# publishing Guide: AI Code Quality Guard

This guide walks you through the process of publishing your VS Code extension to the Marketplace.

## Prerequisites

- **Microsoft Account** (Hotmail, Outlook, GitHub, etc.)
- **GitHub Repository** for your code
- **Node.js** installed locally

---

## Step 1: Create a Publisher Account

The "Publisher" is your identity on the VS Code Marketplace.

1.  **Sign in to the Marketplace Management Portal**:
    -   Go to [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
    -   Sign in with your Microsoft account.

2.  **Create a Publisher**:
    -   Click **"Create a new publisher"**.
    -   **Name**: Enter a human-readable name (e.g., "John Doe" or "My Company").
    -   **ID**: Enter a unique identifier (alphanumeric). **Remember this ID!** You will need it for `package.json`.
        -   *Example ID*: `johndoe-codecomplexity`

3.  **Verify Publisher**:
    -   (Optional but recommended) Verify your domain if you have one.

---

## Step 2: Generate Personal Access Token (PAT)

You need a secure token to allow the publishing command to authenticate.

1.  **Create Azure DevOps Organization** (if you don't have one):
    -   Go to [https://dev.azure.com/](https://dev.azure.com/)
    -   Click "New Organization" (it's free).

2.  **Generate Token**:
    -   Go to your Organization page (e.g., `https://dev.azure.com/your-org`).
    -   Click the **User Settings** icon (next to your profile photo) → **Personal access tokens**.
    -   Click **"New Token"**.
    -   **Name**: `VS Code Marketplace`
    -   **Organization**: "All accessible organizations"
    -   **Scopes**: Scroll down to **Marketplace**. Select **Acquire** and **Manage**.
    -   **Expiration**: Set to 1 year (custom).
    -   Click **Create**.

3.  **Copy the Token**: 
    -   **Important**: Copy the token string now. You won't see it again!
    -   Save it securely (e.g., password manager).

---

## Step 3: Configure Project

1.  **Update `package.json`**:
    -   Open `codecomplexity-vscode/package.json`.
    -   Find the `"publisher"` field.
    -   Change `your-publisher-name` to your **actual Publisher ID** from Step 1.
    -   Example: `"publisher": "johndoe-codecomplexity"`

2.  **Verify Metadata**:
    -   Ensure `repository`, `bugs`, and `homepage` URLs in `package.json` point to your actual GitHub repo.
    -   Ensure `icon` is set to `icon.png`.

---

## Step 4: Publish Manually (First Time)

We recommend doing the first publish manually to ensure everything works.

1.  **Install vsce**:
    Open your terminal in `codecomplexity-vscode`:
    ```bash
    npm install -g @vscode/vsce
    ```

2.  **Login**:
    ```bash
    vsce login <your-publisher-id>
    ```
    -   It will ask for your **Personal Access Token**. Paste it.
    -   It might verify the publisher.

3.  **Package**:
    ```bash
    vsce package
    ```
    -   This creates a file like `codecomplexity-0.1.0.vsix`.
    -   Check that the file size is reasonable (~500KB).

4.  **Publish**:
    ```bash
    vsce publish
    ```
    -   It will upload the package.
    -   **Success!** Your extension is now in verification (usually takes 2-5 minutes).

5.  **Check Listing**:
    -   Go to the Marketplace URL provided in the output.
    -   Verify the README, icon, and categories look correct.

---

## Step 5: Automate with GitHub Actions

We have created `.github/workflows/publish.yml` for you. This will automatically publish whenever you create a new release tag.

1.  **Push Code to GitHub**:
    -   Initialize git if needed: `git init`
    -   Commit all files.
    -   Push to your GitHub repository.

2.  **Add Secrets**:
    -   Go to your GitHub Repo → **Settings** → **Secrets and variables** → **Actions**.
    -   Click **New repository secret**.
    -   Name: `VSCE_PAT`
    -   Value: Paste your **Personal Access Token**.
    -   Click **Add secret**.

3.  **Trigger a Release**:
    -   Create a tag:
        ```bash
        git tag v0.1.0
        git push origin v0.1.0
        ```
    -   Go to the **Actions** tab in GitHub.
    -   You should see "Publish Extension" workflow running.
    -   It will test, build, and publish version 0.1.0 to the Marketplace!

---

## Step 6: Marketing & Distribution

Once live:

1.  **Share the Link**:
    -   Url format: `https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension>`

2.  **Post Announcements**:
    -   **Reddit**: r/vscode, r/Python, r/programming
    -   **Twitter/X**: Use hashtags #vscode #python #coding
    -   **Dev.to**: Write a "How I built a code complexity analyzer" article.

3.  **Badges**:
    -   Add Marketplace badges to your repository `README.md`:
        ```markdown
        [![Installs](https://img.shields.io/visual-studio-marketplace/i/<publisher>.<extension>)](https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension>)
        [![Rating](https://img.shields.io/visual-studio-marketplace/r/<publisher>.<extension>)](https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension>)
        ```

---

## Checklist Before First Publish

- [ ] Publisher Account Created
- [ ] PAT Generated and Saved
- [ ] `package.json` updated with Publisher ID
- [ ] `README.md` looks good
- [ ] `CHANGELOG.md` has 0.1.0 notes
- [ ] License is correct
- [ ] Tests pass locally

**Congratulations on your new extension!** 🚀
