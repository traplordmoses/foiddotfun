# Committing Only Groyper Changes

## Quick Method (Recommended)

Use the helper script:

```bash
./commit-groyper.sh
```

This script will:
1. Stash all your changes (including outside groyper)
2. Stage only the `groyper/` directory
3. Let you commit with a message
4. Restore your stashed changes after

## Manual Method

If you prefer to do it manually:

```bash
# 1. Stage only groyper directory
git add groyper/

# 2. Check what will be committed
git status

# 3. Commit
git commit -m "Your commit message"

# 4. Push
git push
```

## Alternative: Using Git Pathspec

You can also use git's pathspec to only work with groyper:

```bash
# Stage only groyper
git add 'groyper/**'

# Check status of only groyper
git status groyper/

# Commit
git commit -m "Update groyper"

# Push
git push
```

## Ignoring Other Changes Temporarily

If you want to ignore changes in other directories completely:

```bash
# Check what's modified (excluding groyper)
git status --short | grep -v "^groyper/"

# Or see only groyper changes
git status groyper/
```

## Using Sparse Checkout (Advanced)

If you want git to only track the groyper directory:

```bash
git sparse-checkout init --cone
git sparse-checkout set groyper/
```

Then all other directories will be ignored by git automatically.

## Troubleshooting

If you accidentally staged other files:

```bash
# Unstage everything
git reset HEAD

# Stage only groyper
git add groyper/
```

