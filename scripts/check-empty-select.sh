#!/bin/bash

# Script to check for empty SelectItem values in the codebase
# Usage: ./scripts/check-empty-select.sh

echo "🔍 Checking for empty SelectItem values..."

# Check for SelectItem with empty value prop
if grep -r "<SelectItem[^>]*value=\"\"" src/; then
    echo "❌ Found SelectItem with empty value prop. This will cause React errors."
    echo "Please use SafeSelect or ensure all SelectItem values are non-empty."
    exit 1
fi

# Check for SelectItem with value={}
if grep -r "<SelectItem[^>]*value={[^}]*\"\"[^}]*}" src/; then
    echo "❌ Found SelectItem with empty value in JSX expression."
    echo "Please use SafeSelect or ensure all SelectItem values are non-empty."
    exit 1
fi

echo "✅ No empty SelectItem values found!"
exit 0