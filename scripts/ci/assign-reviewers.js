// Requests reviewers for a PR based on which paths it touches.
// Config: .github/reviewers.json
//   areas:    [{ name, paths: [prefix...], reviewers: [login...] }]
//   fallback: [login...]   used when no area matches
//   max:      cap on how many people get asked
// Placeholder logins (starting with "TO_CONFIRM") are ignored, so the
// workflow stays green until real usernames are filled in.
const fs = require('fs');

function pickReviewers(config, files, author) {
  const real = (l) => !l.startsWith('TO_CONFIRM') && l.toLowerCase() !== author.toLowerCase();
  const picked = new Set();
  for (const area of config.areas) {
    if (files.some((f) => area.paths.some((p) => f.startsWith(p)))) {
      area.reviewers.filter(real).forEach((l) => picked.add(l));
    }
  }
  if (picked.size === 0) config.fallback.filter(real).forEach((l) => picked.add(l));
  return [...picked].slice(0, config.max ?? 2);
}

module.exports = async ({ github, context, core }) => {
  const config = JSON.parse(fs.readFileSync('.github/reviewers.json', 'utf8'));
  const pr = context.payload.pull_request;
  const files = await github.paginate(github.rest.pulls.listFiles, {
    ...context.repo, pull_number: pr.number, per_page: 100,
  });
  const reviewers = pickReviewers(config, files.map((f) => f.filename), pr.user.login);
  if (reviewers.length === 0) {
    core.warning('No reviewers resolved. Fill in .github/reviewers.json.');
    return;
  }
  try {
    await github.rest.pulls.requestReviewers({ ...context.repo, pull_number: pr.number, reviewers });
    core.info(`Requested: ${reviewers.join(', ')}`);
  } catch (e) {
    // Usually: a login is not a collaborator on the repo.
    core.warning(`Could not request reviewers (${reviewers.join(', ')}): ${e.message}`);
  }
};
module.exports.pickReviewers = pickReviewers;
