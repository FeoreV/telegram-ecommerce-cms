# GitHub Configuration

This directory contains GitHub-specific configuration files for the Telegram E-commerce Bot Platform project.

## Contents

### Workflows (`.github/workflows/`)
- **`ci.yml`** - Continuous Integration pipeline
  - Linting
  - Testing (Backend)
  - Building (Backend, Frontend, Bot)
  - Docker image builds
  - Security scanning with Trivy
  
- **`security.yml`** - Security audits and scanning
  - Weekly NPM security audits
  - CodeQL analysis
  - Dependency review for PRs

### Issue Templates (`.github/ISSUE_TEMPLATE/`)
- **`bug_report.md`** - Template for bug reports
- **`feature_request.md`** - Template for feature requests

### Pull Request Template
- **`pull_request_template.md`** - Standard PR template

### Other Files
- **`FUNDING.yml`** - Sponsorship/funding options (configure with your accounts)
- **`SECURITY.md`** - Security policy and vulnerability reporting guidelines

## Customization

### Before Going Public

1. **Update repository URLs** in all files (replace `YOUR_ORG/botrt`)
2. **Configure FUNDING.yml** with your sponsorship accounts
3. **Set security email** in `SECURITY.md`
4. **Review and adjust** CI/CD workflows based on your needs
5. **Enable GitHub Actions** in repository settings
6. **Set up branch protection** rules for main branch
7. **Configure GitHub Secrets** for CI/CD (if deploying)

### Recommended GitHub Settings

- **Branch Protection** for `main`:
  - Require pull request reviews
  - Require status checks to pass
  - Require branches to be up to date
  - Include administrators in restrictions
  
- **Security Settings**:
  - Enable Dependabot alerts
  - Enable Dependabot security updates
  - Enable secret scanning
  - Enable CodeQL scanning

## Workflows Details

### CI Workflow Triggers
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Security Workflow Triggers
- Weekly schedule (Monday 00:00 UTC)
- Manual workflow dispatch
- Pull requests (dependency review)

## GitHub Actions Badges

Add these to your main README.md:

```markdown
![CI](https://github.com/YOUR_ORG/botrt/workflows/CI/badge.svg)
![Security Audit](https://github.com/YOUR_ORG/botrt/workflows/Security%20Audit/badge.svg)
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [Managing Issues and PRs](https://docs.github.com/en/issues)
