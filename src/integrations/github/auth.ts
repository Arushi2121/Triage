import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

interface GitHubEnv {
  appId: string;
  privateKey: string;
}

function validateGitHubEnv(): GitHubEnv {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId) {
    throw new Error(
      "Missing GITHUB_APP_ID. Set it in .env.local (see .env.local.example).",
    );
  }

  if (!privateKey) {
    throw new Error(
      "Missing GITHUB_PRIVATE_KEY. Set it in .env.local (see .env.local.example). Use the full PEM format with \\n for line breaks.",
    );
  }

  return { appId, privateKey };
}

export function getInstallationOctokit(installationId: number): Octokit {
  const { appId, privateKey } = validateGitHubEnv();

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });

  return octokit;
}
