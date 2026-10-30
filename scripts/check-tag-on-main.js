// Checks that a release commit is on the default branch, so that a release
// contains only reviewed changes. A ruleset cannot check this for tags.
// Usage: node scripts/check-tag-on-main.js <commit> <branch>
// Needs GITHUB_REPOSITORY and GITHUB_TOKEN. Exits with 1 if the commit is not
// on the branch.
import {pathToFileURL} from 'node:url';

/**
 * The compare API gives the status of `head` relative to `base`. `identical`
 * and `behind` mean that `head` is in the history of `base`.
 * @param {string} status
 * @returns {boolean}
 */
export function isInHistory(status) {
  return status === 'identical' || status === 'behind';
}

/**
 * @param {object} options
 * @param {string} options.repository owner/name
 * @param {string} options.base branch
 * @param {string} options.head commit
 * @param {string} options.token
 * @param {typeof fetch} [options.fetchFn]
 * @returns {Promise<string>} status of the comparison
 */
export async function fetchCompareStatus({
  repository,
  base,
  head,
  token,
  fetchFn = fetch,
}) {
  const url = `https://api.github.com/repos/${repository}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=1`;
  const response = await fetchFn(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${url}: ${response.status}`);
  }
  return (await response.json()).status;
}

/**
 * @param {string} commit
 * @param {string} branch
 */
async function main(commit, branch) {
  const status = await fetchCompareStatus({
    repository: requireEnv('GITHUB_REPOSITORY'),
    base: branch,
    head: commit,
    token: requireEnv('GITHUB_TOKEN'),
  });
  if (!isInHistory(status)) {
    console.error(`Commit ${commit} is not on ${branch} (status: ${status})`);
    process.exit(1);
  }
  console.log(`Commit ${commit} is on ${branch}`);
}

/** @param {string} name */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2], process.argv[3]);
}
