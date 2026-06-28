#!/usr/bin/env python3

"""
Simple Azure Cost Audit - Windows-friendly version
Gathers Azure resource information for cost optimization analysis
"""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

def run_az_command(cmd):
    """Run Azure CLI command safely"""
    try:
        full_cmd = f"az {cmd} -o json"
        result = subprocess.run(
            full_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
        return None
    except Exception as e:
        print(f"    ⚠️  Error: {e}")
        return None

def main():
    print("\n" + "=" * 60)
    print("🔍 AZURE COST OPTIMIZATION AUDIT")
    print("=" * 60)

    data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "resources": {}
    }

    # Get subscription
    print("\n📋 Subscription Information")
    print("-" * 60)
    subscription = run_az_command("account show")
    if subscription:
        data["subscription"] = {
            "id": subscription.get("id"),
            "name": subscription.get("name"),
            "tenantId": subscription.get("tenantId")
        }
        print(f"✓ Subscription: {subscription.get('name')}")
        print(f"  ID: {subscription.get('id')}")
    else:
        print("✗ Could not retrieve subscription info")
        print("  Make sure you've run 'az login'")
        return False

    # Resource Groups
    print("\n📦 Resource Groups")
    print("-" * 60)
    groups = run_az_command("group list")
    if groups:
        data["resources"]["groups"] = groups
        print(f"✓ Found {len(groups)} resource group(s)")
        for g in groups:
            print(f"  - {g['name']} ({g['location']})")
    else:
        print("✗ No resource groups found")

    # All Resources
    print("\n🔧 All Resources")
    print("-" * 60)
    resources = run_az_command("resource list")
    if resources:
        data["resources"]["all"] = resources
        print(f"✓ Found {len(resources)} total resource(s)")

        # Group by type
        types = {}
        for res in resources:
            t = res.get('type', 'Unknown')
            types[t] = types.get(t, 0) + 1

        print("\n  Resources by type:")
        for res_type, count in sorted(types.items()):
            print(f"    - {res_type}: {count}")
    else:
        print("✗ No resources found")

    # Container Apps
    print("\n⚙️  Container Apps")
    print("-" * 60)
    apps = run_az_command("containerapp list")
    if apps:
        data["resources"]["containerApps"] = apps
        print(f"✓ Found {len(apps)} container app(s)")
        for app in apps:
            print(f"  - {app['name']} ({app['resourceGroup']})")
    else:
        print("ℹ️  No container apps found")

    # Container Environments
    print("\n🌍 Container App Environments")
    print("-" * 60)
    envs = run_az_command("containerapp env list")
    if envs:
        data["resources"]["containerEnvs"] = envs
        print(f"✓ Found {len(envs)} environment(s)")
        for env in envs:
            print(f"  - {env['name']} ({env['resourceGroup']})")
    else:
        print("ℹ️  No container environments found")

    # PostgreSQL Flexible
    print("\n🗄️  PostgreSQL Flexible Servers")
    print("-" * 60)
    pg_flex = run_az_command("postgres flexible-server list")
    if pg_flex:
        data["resources"]["postgresFlexible"] = pg_flex
        print(f"✓ Found {len(pg_flex)} PostgreSQL server(s)")
        for db in pg_flex:
            try:
                # Handle storage - it can be a dict or a number
                storage_val = db.get('storage', {})
                if isinstance(storage_val, dict):
                    storage_gb = storage_val.get('storageMb', 0) / 1024
                else:
                    storage_gb = (storage_val or 0) / 1024

                # Get SKU info
                sku_info = db.get('sku', {})
                sku_name = sku_info.get('name') if isinstance(sku_info, dict) else sku_info
                sku_tier = sku_info.get('tier') if isinstance(sku_info, dict) else 'Unknown'

                # Get backup info
                backup_info = db.get('backup', {})
                backup_retention = backup_info.get('backupRetentionDays') if isinstance(backup_info, dict) else db.get('backupRetention', 0)
                geo_redundant = backup_info.get('geoRedundantBackup') if isinstance(backup_info, dict) else db.get('geoRedundant', False)

                print(f"  - {db['name']}")
                print(f"    SKU: {sku_name}, Tier: {sku_tier}")
                print(f"    Storage: {storage_gb:.0f}GB, Backups: {backup_retention} days")
                print(f"    Geo-Redundant: {geo_redundant}")
            except Exception as e:
                print(f"  - {db.get('name', 'Unknown')} (error parsing details)")
    else:
        print("ℹ️  No PostgreSQL servers found")

    # Storage Accounts
    print("\n💾 Storage Accounts")
    print("-" * 60)
    storage = run_az_command("storage account list")
    if storage:
        data["resources"]["storage"] = storage
        print(f"✓ Found {len(storage)} storage account(s)")
        for sa in storage:
            print(f"  - {sa['name']}")
            print(f"    Type: {sa.get('kind')}, Tier: {sa.get('accessTier')}, Replication: {sa.get('sku')}")
    else:
        print("ℹ️  No storage accounts found")

    # Virtual Networks
    print("\n🌐 Virtual Networks")
    print("-" * 60)
    vnets = run_az_command("network vnet list")
    if vnets:
        data["resources"]["vnets"] = vnets
        print(f"✓ Found {len(vnets)} virtual network(s)")
        for vnet in vnets:
            print(f"  - {vnet['name']} ({vnet['resourceGroup']})")
    else:
        print("ℹ️  No virtual networks found")

    # Public IPs
    print("\n📍 Public IP Addresses")
    print("-" * 60)
    ips = run_az_command("network public-ip list")
    if ips:
        data["resources"]["publicIps"] = ips
        allocated = sum(1 for ip in ips if ip.get('ipAddress'))
        unallocated = len(ips) - allocated
        print(f"✓ Found {len(ips)} public IP(s)")
        print(f"  - Allocated: {allocated}, Unallocated: {unallocated}")
        if unallocated > 0:
            print(f"  ⚠️  Unallocated IPs cost money! Consider deleting them.")
        for ip in ips:
            status = f"({ip['ipAddress']})" if ip.get('ipAddress') else "(unallocated)"
            print(f"  - {ip['name']} {status}")
    else:
        print("ℹ️  No public IPs found")

    # Advisor Recommendations
    print("\n💡 Azure Advisor Recommendations")
    print("-" * 60)
    advisor = run_az_command("advisor recommendation list --category Cost")
    if advisor:
        data["recommendations"] = advisor
        print(f"✓ Found {len(advisor)} cost recommendation(s)")
        for i, rec in enumerate(advisor[:5], 1):
            print(f"\n  {i}. Impact: {rec.get('impact')}")
            print(f"     Problem: {rec.get('problem')[:80]}...")
            print(f"     Recommendation: {rec.get('recommendation')[:80]}...")
        if len(advisor) > 5:
            print(f"\n  ... and {len(advisor) - 5} more recommendations")
    else:
        print("ℹ️  No advisor recommendations available")

    # Save to file
    print("\n" + "=" * 60)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"azure-audit-{timestamp}.json"

    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\n✅ Audit complete!")
    print(f"📄 Output saved to: {output_file}")
    print(f"   File size: {Path(output_file).stat().st_size} bytes")

    print("\n📋 Summary:")
    total_resources = len(resources) if resources else 0
    print(f"  - Total resources: {total_resources}")
    print(f"  - Resource groups: {len(groups) if groups else 0}")
    print(f"  - Container Apps: {len(apps) if apps else 0}")
    print(f"  - Databases: {len(pg_flex) if pg_flex else 0}")
    print(f"  - Storage accounts: {len(storage) if storage else 0}")
    print(f"  - Cost recommendations: {len(advisor) if advisor else 0}")

    print("\n📝 Next steps:")
    print("  1. Review the JSON file for complete details")
    print("  2. Check for unallocated resources (costing money)")
    print("  3. Provide expected usage patterns:")
    print("     - Monthly active users")
    print("     - Peak concurrent users")
    print("     - Expected growth rate")
    print("     - Budget targets")
    print("=" * 60 + "\n")

    return True

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Audit cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        sys.exit(1)
