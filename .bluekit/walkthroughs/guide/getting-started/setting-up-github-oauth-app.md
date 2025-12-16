---
id: setting-up-github-oauth-app
alias: Setting Up GitHub OAuth App
type: walkthrough
is_base: false
version: 1
tags:
  - github
  - oauth
  - authentication
  - setup
description: Step-by-step runbook for creating and configuring a GitHub OAuth app for BlueKit authentication
complexity: simple
format: guide
---

# Setting Up GitHub OAuth App for BlueKit

This runbook walks you through creating a GitHub OAuth app and configuring it for BlueKit's device flow authentication.

## Prerequisites

- A GitHub account
- Access to GitHub Settings → Developer settings

## Step 1: Create the OAuth App

1. Go to [GitHub Settings](https://github.com/settings/profile)
2. In the left sidebar, scroll down and click **"Developer settings"**
3. Under **"Developer settings"**, select **"OAuth Apps"**
4. Click **"New OAuth App"** button

## Step 2: Fill in Application Details

Fill in the form with:

- **Application name**: `BlueKit`
- **Homepage URL**: `http://localhost` (required field, but not used for device flow)
- **Authorization callback URL**: `http://localhost` (required field, but not used for device flow)

> **Note**: The callback URL isn't actually used for device flow authentication, but GitHub requires it as a field.

5. Click **"Register application"**

## Step 3: Enable Device Flow

**Important**: Device Flow must be explicitly enabled (as of March 2022).

1. After creating the app, you'll see the application settings page
2. Scroll to the **"Identifying and authorizing users"** section
3. Check the **"Enable Device Flow"** checkbox
4. Click **"Update application"** to save

> **Why?** GitHub requires explicit enabling of Device Flow to mitigate phishing risks. Without this, the API will return 400 errors.

## Step 4: Get Your Credentials

On the application settings page, you'll see:

### Client ID
- Located in the **"Client ID"** section
- This is a public value (safe to include in code)
- Copy this value - you'll need it for the `.env` file

### Client Secret
- Located in the **"Client secrets"** section
- Click **"Generate a new client secret"**
- **Important**: Copy the secret immediately - GitHub only shows it once!
- If you lose it, you'll need to generate a new one

> **Note**: While the client secret is optional for device flow, it's **highly recommended** for security.

## Step 5: Create `.env` File

1. In your BlueKit project root, create a `.env` file (if it doesn't exist)
2. Add the following content:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

3. Replace `your_client_id_here` with your actual Client ID
4. Replace `your_client_secret_here` with your actual Client Secret

### Example `.env` file:

```bash
GITHUB_CLIENT_ID=0v23liXP244pJ0SphlcL
GITHUB_CLIENT_SECRET=gho_abc123def456ghi789jkl012mno345pqr678
```

## Step 6: Verify `.gitignore`

Make sure your `.env` file is in `.gitignore` to prevent committing secrets:

```bash
# Environment variables
.env
```

## Step 7: Restart the App

After creating the `.env` file:

1. **Restart your Tauri application** (the app loads environment variables at startup)
2. The authentication screen should now work properly
3. You should see the user code for GitHub authorization

## Troubleshooting

### "GITHUB_CLIENT_ID not set in environment variables"
- Make sure the `.env` file exists in the project root
- Verify the file is named exactly `.env` (not `.env.txt` or similar)
- Restart the app after creating/modifying `.env`

### "GitHub API error (400)"
- Make sure you enabled **"Enable Device Flow"** in the OAuth app settings
- Verify the Client ID is correct in your `.env` file

### "Failed to request device code"
- Check your internet connection
- Verify the Client ID is correct
- Make sure the OAuth app is not deleted or disabled

## What Happens Next?

Once configured:

1. The app will request a device code from GitHub
2. A user code will be displayed in the BlueKit UI
3. Users visit GitHub.com and enter the code
4. The app polls GitHub for the access token
5. The token is stored securely in the OS keychain

## Security Notes

- ✅ Client ID is public (safe to include in code)
- ⚠️ Client Secret should **never** be committed to git
- ⚠️ `.env` file should be in `.gitignore`
- ✅ Tokens are stored in OS keychain (secure)
- ✅ Device flow is more secure than redirect flow for desktop apps

## References

- [GitHub Device Flow Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)

