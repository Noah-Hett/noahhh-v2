# Conversational add-project skill, dry-run media pipeline

New Projects go through `.opencode/skills/add-project-content/` (conversational Q&A, local optimize into `.media-tmp/<slug>/`, manifest diff, printable R2 upload commands) instead of hand-editing `projects.ts` or committing originals. Skill never uploads to R2; user runs the printed `wrangler` commands. Keeps the git-local model (ADR-0002) and linked-not-bundled rule (ADR-0003) while making intake fast.
