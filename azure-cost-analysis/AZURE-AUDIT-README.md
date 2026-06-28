# Azure Cost Optimization Audit

This toolkit automatically gathers all necessary information from your Azure subscription to analyze costs and provide optimization recommendations.

## Prerequisites

### Install Azure CLI
- **macOS/Linux**: `brew install azure-cli` or see https://docs.microsoft.com/cli/azure/install-azure-cli
- **Windows**: Download from https://aka.ms/installazurecliwindows
- **Or**: `pip install azure-cli`

### Login to Azure
```bash
az login
```

This will open a browser to authenticate. Make sure you're logged into the correct Azure account.

## Usage

### Option 1: Python Script (Recommended)
Easy to read output with nice formatting.

```bash
python3 azure-cost-audit.py
```

**Output:**
- Console summary with key metrics
- JSON file with complete data: `azure-audit-YYYYMMDD_HHMMSS.json`

### Option 2: Bash Script
For Linux/macOS or if Python not available.

```bash
bash azure-cost-audit.sh
```

**Output:**
- JSON file with complete data: `azure-audit-YYYYMMDD_HHMMSS.json`

## What Gets Collected

### Subscription Info
- Subscription ID and name
- Tenant ID

### Resources
- All resource groups and locations
- Complete inventory of all Azure resources
- Resource types and SKUs

### Compute
- **Container Apps**: All apps and their environments
- **App Service Plans**: Tiers, capacity, OS type

### Databases
- **PostgreSQL Flexible Servers**: SKU, storage, backup settings
- **PostgreSQL Single Servers**: (if any) SKU, storage, backup settings

### Storage
- **Storage Accounts**: Type, replication settings, access tier, redundancy

### Networking
- Virtual Networks
- Public IP addresses and idle timeout settings

### Advisor Recommendations
- Azure Advisor cost optimization recommendations (if available)

## Next Steps

Once you have the audit file:

1. **Share the JSON file** with the cost analysis request
2. **Provide usage patterns** (examples below):

### Expected Usage Information

```json
{
  "current_state": {
    "monthly_active_users": 500,
    "peak_concurrent_users": 50,
    "monthly_registrations": 150,
    "database_size_gb": 10,
    "storage_size_gb": 50
  },
  "growth": {
    "expected_monthly_growth": 10,
    "seasonal_patterns": "Higher in summer (conference season)"
  },
  "requirements": {
    "required_uptime_sla": "99.5%",
    "acceptable_downtime_minutes_per_month": 22,
    "required_response_time_ms": 500,
    "needs_geographic_redundancy": false
  },
  "business": {
    "budget_target_per_month": "$500",
    "acceptable_cost_increase_percent": 20
  }
}
```

## Interpreting the Output

### Key Metrics to Look For

**Container Apps**
- SKU: Check if resources can be right-sized (CPU, memory)
- Count: Are you over-provisioned?

**Database**
- SKU: Are you using higher tier than needed?
- Storage: Is backup retention longer than necessary?
- Geo-Redundancy: Do you need this?

**Storage**
- Replication: GRS is more expensive than LRS
- Access Tier: Hot tier costs more than Cool/Archive
- Account count: Consolidation opportunities?

**Public IPs**
- Unused IPs cost money
- High idle timeouts might indicate unused resources

**Advisor Recommendations**
- These are often quick wins for cost reduction

## Cost Estimation

With the audit data + usage patterns, typical optimization can include:

- **Right-sizing compute**: 20-40% savings
- **Database optimization**: 15-30% savings
- **Storage adjustments**: 10-25% savings
- **Removing unused resources**: 5-15% savings
- **Reserved instances**: 10-20% savings

**Total potential**: 40-70% cost reduction depending on current configuration

## Common Issues

### "Command not found: az"
- Azure CLI not installed. See Prerequisites section.
- Or not in PATH. Add it to your PATH or use full path to `az` command.

### "Must call az login"
- Run `az login` first and authenticate in the browser.

### Advisor recommendations not showing
- Some subscriptions don't have access to Advisor
- Can still optimize based on resource inventory

### JSON file is empty or incomplete
- Check that all Azure CLI commands succeeded
- Verify you have permissions for all resource groups
- Try: `az resource list` to test basic connectivity

## Support

If you encounter issues:

1. **Test Azure CLI**: `az account show`
2. **Check permissions**: Do you have Reader role on the subscription?
3. **Review script errors**: Look at any error messages in the output
4. **Manual collection**: You can also gather some info through Azure Portal

## Security Note

The JSON file contains resource metadata (names, IDs, configurations). Keep it safe:
- Don't share publicly
- Doesn't contain secrets or sensitive data
- Only accessible to audit folder location

---

**Ready?** Run the script and share the output file when asking for cost optimization recommendations!
