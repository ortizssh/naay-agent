# GitHub Actions Troubleshooting

## Current Status
- Repository: https://github.com/ortizssh/naay-agent
- Last commits pushed successfully
- Workflows created but not executing

## Potential Issues

### 1. Actions Disabled
- Go to https://github.com/ortizssh/naay-agent/settings/actions
- Enable Actions if disabled

### 2. Workflow Permissions
- Go to Settings → Actions → General
- Set to "Read and write permissions"
- Enable "Allow GitHub Actions to create and approve pull requests"

### 3. Repository Visibility
- Private repos have limited Actions minutes
- Check usage at Settings → Billing and plans

### 4. Branch Protection
- Check if main branch has protection rules blocking Actions
- Go to Settings → Branches

## Quick Test
Run this command to trigger workflow manually:
```bash
# Create a simple change and push
echo "# Test Actions $(date)" > test-actions.txt
git add test-actions.txt
git commit -m "Test: Force Actions trigger $(date)"
git push origin main
```

## Manual Trigger
If automatic triggers don't work, try manual trigger:
1. Go to Actions tab
2. Select workflow
3. Click "Run workflow"

## Verification Steps
1. Check Actions tab shows workflows
2. Verify workflow files are in .github/workflows/
3. Confirm YAML syntax is valid
4. Check for any error messages in Actions tab