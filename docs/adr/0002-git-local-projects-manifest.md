# Git-local content model, no CMS

All Projects live in one `projects.ts` manifest plus per-slug body files behind a shared `ProjectLayout`, instead of duplicated hardcoded lists or a CMS. V1 drifted because featured/all/detail copies diverged; a CMS is overkill for ~10 case studies updated by one author in git.
