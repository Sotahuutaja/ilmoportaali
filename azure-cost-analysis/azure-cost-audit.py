#!/usr/bin/env python3

"""
Azure Cost Optimization Audit Tool
Gathers Azure resource information and generates a cost optimization report
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

class AzureAudit:
    def __init__(self):
        self.timestamp = datetime.now(datetime.UTC).isoformat() if hasattr(datetime, 'UTC') else datetime.utcnow().isoformat() + 'Z'
        self.data = {
            'timestamp': self.timestamp,
            'summary': {},
            'resources': {},
            'costs': {},
            'recommendations': []
        }

    def run_command(self, cmd, description=""):
        """Run Azure CLI command and return JSON result"""
        try:
            if description:
                print(f"  📊 {description}...", end=" ", flush=True)

            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                check=False
            )

            if result.returncode == 0 and result.stdout.strip():
                if description:
                    print("✓")
                try:
                    return json.loads(result.stdout)
                except json.JSONDecodeError:
                    return result.stdout
            else:
                if description:
                    print("(N/A)")
                return None
        except Exception as e:
            print(f"Error: {e}")
            return None

    def gather_subscription_info(self):
        """Get subscription details"""
        print("\n📋 Gathering Subscription Information")
        print("-" * 40)

        subscription = self.run_command(
            "az account show --query '{id:id, name:name, tenantId:tenantId}' -o json",
            "Subscription details"
        )
        self.data['subscription'] = subscription

        if subscription:
            print(f"\nSubscription: {subscription.get('name')}")
            print(f"ID: {subscription.get('id')}")

    def gather_resources(self):
        """Get all resources"""
        print("\n📦 Gathering Resource Inventory")
        print("-" * 40)

        resource_groups = self.run_command(
            "az group list --query '[].{name:name, location:location}' -o json",
            "Resource groups"
        )

        all_resources = self.run_command(
            "az resource list --query '[].{id:id, name:name, type:type, resourceGroup:resourceGroup, location:location, sku:sku.name}' -o json",
            "All resources"
        )

        self.data['resources']['groups'] = resource_groups or []
        self.data['resources']['all'] = all_resources or []

        if resource_groups:
            print(f"\nResource Groups: {len(resource_groups)}")
            for rg in resource_groups:
                print(f"  - {rg['name']} ({rg['location']})")

        if all_resources:
            print(f"\nTotal Resources: {len(all_resources)}")
            # Group by type
            types = {}
            for res in all_resources:
                t = res['type']
                types[t] = types.get(t, 0) + 1
            for t, count in sorted(types.items()):
                print(f"  - {t}: {count}")

    def gather_compute(self):
        """Get compute resources (Container Apps, App Services)"""
        print("\n⚙️  Gathering Compute Resources")
        print("-" * 40)

        container_apps = self.run_command(
            "az containerapp list --query '[].{name:name, resourceGroup:resourceGroup, provisioningState:properties.provisioningState, template:properties.template}' -o json",
            "Container Apps"
        )

        container_envs = self.run_command(
            "az containerapp env list --query '[].{name:name, resourceGroup:resourceGroup}' -o json",
            "Container App Environments"
        )

        app_services = self.run_command(
            "az appservice plan list --query '[].{name:name, resourceGroup:resourceGroup, kind:kind, tier:sku.tier, capacity:sku.capacity, os:reserved}' -o json",
            "App Service Plans"
        )

        self.data['resources']['containerApps'] = container_apps or []
        self.data['resources']['containerEnvs'] = container_envs or []
        self.data['resources']['appServices'] = app_services or []

        if container_apps:
            print(f"\nContainer Apps: {len(container_apps)}")
            for app in container_apps:
                print(f"  - {app['name']} ({app['resourceGroup']})")

        if app_services:
            print(f"\nApp Service Plans: {len(app_services)}")
            for plan in app_services:
                print(f"  - {plan['name']} ({plan['tier']}, capacity: {plan['capacity']})")

    def gather_databases(self):
        """Get database information"""
        print("\n🗄️  Gathering Database Information")
        print("-" * 40)

        postgres_flex = self.run_command(
            "az postgres flexible-server list --query '[].{name:name, resourceGroup:resourceGroup, skuName:sku.name, tier:sku.tier, storage:storage.storageMb, backupRetention:backup.backupRetentionDays, geoRedundant:backup.geoRedundantBackup}' -o json",
            "PostgreSQL Flexible Servers"
        )

        postgres_single = self.run_command(
            "az postgres server list --query '[].{name:name, resourceGroup:resourceGroup, skuName:sku.name, storage:storageProfile.storageMb, backupRetention:storageProfile.backupRetentionDays, geoRedundant:storageProfile.geoRedundantBackup}' -o json",
            "PostgreSQL Single Servers"
        )

        self.data['resources']['postgresFlexible'] = postgres_flex or []
        self.data['resources']['postgresSingle'] = postgres_single or []

        if postgres_flex:
            print(f"\nPostgreSQL Flexible Servers: {len(postgres_flex)}")
            for db in postgres_flex:
                storage_gb = db.get('storage', 0) / 1024
                print(f"  - {db['name']}: {db['skuName']} ({storage_gb:.0f}GB)")

        if postgres_single:
            print(f"\nPostgreSQL Single Servers: {len(postgres_single)}")
            for db in postgres_single:
                storage_gb = db.get('storage', 0) / 1024
                print(f"  - {db['name']}: {db['skuName']} ({storage_gb:.0f}GB)")

    def gather_storage(self):
        """Get storage information"""
        print("\n💾 Gathering Storage Information")
        print("-" * 40)

        storage_accounts = self.run_command(
            "az storage account list --query '[].{name:name, resourceGroup:resourceGroup, kind:kind, accessTier:accessTier, replication:sku.name, https:supportsHttpsTrafficOnly}' -o json",
            "Storage Accounts"
        )

        self.data['resources']['storage'] = storage_accounts or []

        if storage_accounts:
            print(f"\nStorage Accounts: {len(storage_accounts)}")
            for sa in storage_accounts:
                print(f"  - {sa['name']}: {sa['kind']} ({sa['replication']})")

    def gather_advisor(self):
        """Get Azure Advisor recommendations"""
        print("\n💡 Gathering Azure Advisor Recommendations")
        print("-" * 40)

        advisor = self.run_command(
            "az advisor recommendation list --category Cost --query '[].{category:category, impact:impact, impactedField:impactedField, problem:problem, recommendation:recommendation}' -o json",
            "Cost recommendations"
        )

        self.data['recommendations'] = advisor or []

        if advisor:
            print(f"\nCost Recommendations: {len(advisor)}")
            for i, rec in enumerate(advisor[:5], 1):  # Show first 5
                print(f"\n  {i}. {rec['impactedField']}")
                print(f"     Impact: {rec['impact']}")
                print(f"     Recommendation: {rec['recommendation'][:100]}...")
            if len(advisor) > 5:
                print(f"\n  ... and {len(advisor) - 5} more recommendations")

    def gather_networking(self):
        """Get networking information"""
        print("\n🌐 Gathering Networking Information")
        print("-" * 40)

        vnets = self.run_command(
            "az network vnet list --query '[].{name:name, resourceGroup:resourceGroup}' -o json",
            "Virtual Networks"
        )

        public_ips = self.run_command(
            "az network public-ip list --query '[].{name:name, resourceGroup:resourceGroup, ipAddress:ipAddress, idleTimeoutInMinutes:idleTimeoutInMinutes}' -o json",
            "Public IPs"
        )

        self.data['resources']['networking'] = {
            'virtualNetworks': vnets or [],
            'publicIps': public_ips or []
        }

        if public_ips:
            print(f"\nPublic IPs: {len(public_ips)}")
            for ip in public_ips:
                if ip.get('ipAddress'):
                    print(f"  - {ip['name']}: {ip['ipAddress']}")
                else:
                    print(f"  - {ip['name']}: (not assigned)")

    def save_output(self):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"azure-audit-{timestamp}.json"

        with open(output_file, 'w') as f:
            json.dump(self.data, f, indent=2)

        return output_file

    def print_summary(self):
        """Print summary of findings"""
        print("\n" + "=" * 50)
        print("📊 AUDIT SUMMARY")
        print("=" * 50)

        resources = self.data['resources']['all']
        if resources:
            print(f"\n✓ Total Resources: {len(resources)}")
            print(f"✓ Resource Groups: {len(self.data['resources']['groups'])}")

            container_apps = self.data['resources'].get('containerApps', [])
            if container_apps:
                print(f"✓ Container Apps: {len(container_apps)}")

            postgres_flex = self.data['resources'].get('postgresFlexible', [])
            if postgres_flex:
                print(f"✓ PostgreSQL Servers: {len(postgres_flex)}")

            storage = self.data['resources'].get('storage', [])
            if storage:
                print(f"✓ Storage Accounts: {len(storage)}")

        recommendations = self.data['recommendations']
        if recommendations:
            print(f"\n⚠️  Cost Recommendations: {len(recommendations)}")
            print("   Review the full report for details")

        print("\n" + "=" * 50)

    def run(self):
        """Run complete audit"""
        print("\n" + "=" * 50)
        print("🔍 AZURE COST OPTIMIZATION AUDIT")
        print("=" * 50)

        try:
            # Verify Azure CLI is available
            result = subprocess.run(
                "az account show",
                shell=True,
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                raise Exception("Azure CLI not responding")
        except Exception as e:
            print("\n❌ Error: Azure CLI not found or not logged in")
            print(f"Details: {e}")
            print("\nPlease:")
            print("1. Install Azure CLI: https://aka.ms/installazurecliwindows")
            print("2. Run: az login")
            print("3. Try this script again")
            return False

        self.gather_subscription_info()
        self.gather_resources()
        self.gather_compute()
        self.gather_databases()
        self.gather_storage()
        self.gather_networking()
        self.gather_advisor()

        output_file = self.save_output()
        self.print_summary()

        print(f"\n✅ Audit complete!")
        print(f"📄 Full report saved to: {output_file}")
        print(f"\nNext steps:")
        print(f"1. Review the JSON file for complete details")
        print(f"2. Share the file along with expected usage patterns")
        print(f"3. Expected usage info should include:")
        print(f"   - Monthly active users")
        print(f"   - Peak concurrent users")
        print(f"   - Monthly events/registrations")
        print(f"   - Expected growth rate")
        print(f"   - Acceptable downtime windows")
        print(f"   - Budget targets")

        return True

if __name__ == '__main__':
    audit = AzureAudit()
    success = audit.run()
    sys.exit(0 if success else 1)
