#!/bin/bash
# Script to commit only changes in the groyper directory

set -e

echo "📦 Committing only groyper directory changes..."

# Check if there are any changes in groyper
if git diff --quiet -- groyper/ && git diff --cached --quiet -- groyper/; then
    echo "⚠️  No changes in groyper directory"
    exit 1
fi

# Stage only groyper directory
echo "➕ Staging groyper directory..."
git add groyper/

# Show what will be committed
echo ""
echo "📋 Changes to be committed:"
git status --short groyper/

echo ""
read -p "Continue with commit? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    read -p "Enter commit message: " commit_msg
    git commit -m "$commit_msg"
    echo ""
    echo "✅ Committed groyper changes!"
    echo ""
    echo "📤 Ready to push. Run: git push"
else
    echo "❌ Commit cancelled. Unstaging changes..."
    git reset HEAD groyper/
fi

