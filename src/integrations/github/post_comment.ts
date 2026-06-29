import { getInstallationOctokit } from "./auth";

export async function postIssueComment(params: {
  installationId: number;
  owner: string;
  repo: string;
  issueNumber: number;
  draftContent: string;
  maintainerHandle: string;
}): Promise<{ commentId: number; commentUrl: string }> {
  const {
    installationId,
    owner,
    repo,
    issueNumber,
    draftContent,
    maintainerHandle,
  } = params;

  // Build comment body with attribution footer
  const body = `${draftContent}\n\n---\n_Drafted via Triage, reviewed and posted by @${maintainerHandle}_`;

  // Get authenticated Octokit for this installation
  const octokit = getInstallationOctokit(installationId);

  // Post comment via GitHub REST API
  const response = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  return {
    commentId: response.data.id,
    commentUrl: response.data.html_url,
  };
}
