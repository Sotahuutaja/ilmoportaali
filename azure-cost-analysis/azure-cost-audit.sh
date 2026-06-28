#!/bin/bash

###############################################################################
# Azure Cost Optimization Audit Script
# Gathers comprehensive information about Azure resources, usage, and costs
# Outputs to a JSON file for analysis
###############################################################################

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="azure-audit-${TIMESTAMP}.json"
TEMP_FILE=$(mktemp)

echo "🔍 Azure Cost Optimization Audit"
echo "=================================="
echo "Gathering resource information..."
echo ""

# Initialize JSON
echo "{" > "$TEMP_FILE"
echo '  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")',' >> "$TEMP_FILE"
echo '  "subscription": {},' >> "$TEMP_FILE"

# Get subscription info
echo "  Checking subscription..."
SUBSCRIPTION=$(az account show --query '{id:id, name:name}' -o json)
echo "  ✓ Subscription info gathered"

# Get all resource groups and resources
echo "  Gathering resource groups and resources..."
RESOURCE_GROUPS=$(az group list --query '[].{name:name, location:location}' -o json)
RESOURCES=$(az resource list --query '[].{id:id, name:name, type:type, resourceGroup:resourceGroup, location:location, sku:sku.name}' -o json)
echo "  ✓ Resource inventory gathered"

# Get Container Apps info
echo "  Gathering Container Apps details..."
CONTAINER_APPS=$(az containerapp list --query '[].{name:name, resourceGroup:resourceGroup, provisioningState:properties.provisioningState, latestRevisionFqdn:properties.latestRevisionFqdn}' -o json 2>/dev/null || echo "[]")
CONTAINER_APP_ENVS=$(az containerapp env list --query '[].{name:name, resourceGroup:resourceGroup, staticIp:properties.staticIp}' -o json 2>/dev/null || echo "[]")
echo "  ✓ Container Apps info gathered"

# Get Database info
echo "  Gathering database information..."
POSTGRES_SERVERS=$(az postgres server list --query '[].{name:name, resourceGroup:resourceGroup, skuName:sku.name, storageMb:storageProfile.storageMb, backupRetentionDays:storageProfile.backupRetentionDays, geoRedundantBackup:storageProfile.geoRedundantBackup, version:version}' -o json 2>/dev/null || echo "[]")
POSTGRES_FLEX=$(az postgres flexible-server list --query '[].{name:name, resourceGroup:resourceGroup, sku:sku.name, storage:storage.storageMb, tier:sku.tier, backupRetention:backup.backupRetentionDays}' -o json 2>/dev/null || echo "[]")
echo "  ✓ Database info gathered"

# Get Storage accounts info
echo "  Gathering storage information..."
STORAGE_ACCOUNTS=$(az storage account list --query '[].{name:name, resourceGroup:resourceGroup, kind:kind, accessTier:accessTier, https_only:supportsHttpsTrafficOnly, replication:sku.name}' -o json)
echo "  ✓ Storage info gathered"

# Get App Service info (if any)
echo "  Gathering App Service information..."
APP_SERVICES=$(az appservice plan list --query '[].{name:name, resourceGroup:resourceGroup, kind:kind, tier:sku.tier, capacity:sku.capacity}' -o json 2>/dev/null || echo "[]")
echo "  ✓ App Service info gathered"

# Get networking info
echo "  Gathering network information..."
VNET_INFO=$(az network vnet list --query '[].{name:name, resourceGroup:resourceGroup, addressSpace:addressSpace.addressPrefixes}' -o json 2>/dev/null || echo "[]")
PUBLIC_IPS=$(az network public-ip list --query '[].{name:name, resourceGroup:resourceGroup, ipAddress:ipAddress, version:publicIpAddressVersion}' -o json 2>/dev/null || echo "[]")
echo "  ✓ Network info gathered"

# Get usage and quota info
echo "  Gathering usage information..."
USAGE_JSON="[]"
for rg in $(echo "$RESOURCE_GROUPS" | jq -r '.[].name' 2>/dev/null); do
  RG_RESOURCES=$(az resource list --resource-group "$rg" --query "length([])")
  echo "    - Resource Group '$rg': $RG_RESOURCES resources"
done
echo "  ✓ Usage info gathered"

# Get advisor recommendations (cost optimization)
echo "  Gathering Azure Advisor recommendations..."
ADVISOR_RECS=$(az advisor recommendation list --category Cost --query '[].{category:category, impact:impact, impactedField:impactedField, problem:problem, recommendation:recommendation}' -o json 2>/dev/null || echo "[]")
echo "  ✓ Advisor recommendations gathered"

# Get cost management data (last 30 days if available)
echo "  Gathering cost data..."
START_DATE=$(date -u -d '30 days ago' +"%Y-%m-%dT00:00:00Z" 2>/dev/null || date -u -v-30d +"%Y-%m-%dT00:00:00Z")
END_DATE=$(date -u +"%Y-%m-%dT23:59:59Z")
COSTS=$(az costmanagement query --timeframe "MonthToDate" --type "Usage" --dataset "{granularity:Daily,aggregation:{totalCost:{name:PreTaxCost}}}" -o json 2>/dev/null || echo '{"properties":{"rows":[]}}')
echo "  ✓ Cost data gathered"

# Build the complete JSON output
{
  cat "$TEMP_FILE"
  echo '  "subscription": '"$SUBSCRIPTION"','
  echo '  "resourceGroups": '"$RESOURCE_GROUPS"','
  echo '  "allResources": '"$RESOURCES"','
  echo '  "containerApps": {'
  echo '    "apps": '"$CONTAINER_APPS"','
  echo '    "environments": '"$CONTAINER_APP_ENVS"''
  echo '  },'
  echo '  "databases": {'
  echo '    "postgresServer": '"$POSTGRES_SERVERS"','
  echo '    "postgresFlexible": '"$POSTGRES_FLEX"''
  echo '  },'
  echo '  "storage": '"$STORAGE_ACCOUNTS"','
  echo '  "appServices": '"$APP_SERVICES"','
  echo '  "networking": {'
  echo '    "virtualNetworks": '"$VNET_INFO"','
  echo '    "publicIps": '"$PUBLIC_IPS"''
  echo '  },'
  echo '  "advisorRecommendations": '"$ADVISOR_RECS"','
  echo '  "costData": '"$COSTS"''
  echo '}'
} > "$OUTPUT_FILE"

# Format JSON nicely if jq is available
if command -v jq &> /dev/null; then
  jq '.' "$OUTPUT_FILE" > "${OUTPUT_FILE}.tmp"
  mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
fi

# Clean up temp file
rm -f "$TEMP_FILE"

echo ""
echo "✅ Audit complete!"
echo "📄 Output saved to: $OUTPUT_FILE"
echo ""
echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Review the generated JSON file"
echo "2. Look at advisor recommendations for quick wins"
echo "3. Check Container App and Database SKUs for right-sizing"
echo "4. Analyze storage usage and redundancy settings"
echo "5. Provide expected usage patterns for detailed recommendations"
echo ""
