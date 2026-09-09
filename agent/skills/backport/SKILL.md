---
name: backport
description: "Use when creating a backport PR from one or more merged GitHub PRs onto a release branch; triggers on backport, cherry-pick to release, or release-branch PR requests."
---

# Backport merged PRs

Create one branch and one PR per source PR. Preserve the source PR body, then append the backport metadata.

## Procedure

1. Confirm the target release branch, source PR numbers, and a clean worktree. Fetch the target branch and verify each source PR is merged.
2. For each source PR:
   - Read its `title`, `body`, `mergeCommit.oid`, and `url` with `gh pr view <number> --json ...`.
   - Create a branch from `origin/<release-branch>` named `backport/<pr>-<release-branch>`.
   - Inspect the merge commit parents. Cherry-pick the commit directly when it has one parent; use `git cherry-pick -m 1 <sha>` only for a true merge commit.
   - Resolve conflicts by preserving the release branch's compatible changes and the source PR's requested behavior. Regenerate compiled localization files from their resolved source files when needed.
   - Run the smallest relevant automated checks, then push the branch.
3. Create the PR targeting the release branch:
   - Title: `[Backport <release-branch>] <original title>`.
   - Body: copy the original PR body verbatim, then append:
     ```markdown
     ## Backport

     This is a backport of #<source-pr> to `<release-branch>`.

     Original PR: <original-url>
     ```
   - Apply the `backport` label; create that label only if it is absent.
4. Verify each PR's base, head, title, body, label, and changed-file summary. Report the PR URLs and any conflict resolutions or checks that were skipped.

Never discard unrelated worktree changes. Do not squash or rewrite the backport branch after pushing unless explicitly requested.
