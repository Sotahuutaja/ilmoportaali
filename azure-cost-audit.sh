#!/bin/bash
# Azure Cost Audit Script
# Gathers resource details for cost estimation

RESOURCE_GROUP="RG_Ilmoportaali"
REGION="swedencentral"

echo "========================================"
echo "Azure Cost Audit for $RESOURCE_GROUP"
echo "========================================"
echo ""

# Check if user is logged in
echo "Checking Azure login..."
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Not logged into Azure. Please run: az login"
    exit 1
fi

echo "✓ Logged in to Azure"
echo ""

# ====== CONTAINER APPS ======
echo "========================================"
echo "CONTAINER APPS"
echo "========================================"
echo ""

# Backend Container App
echo "Backend App (ilmoportaali-app):"
az containerapp show \
  --name ilmoportaali-app \
  --resource-group $RESOURCE_GROUP \
  --query '{name: name, location: location, provisioningState: properties.provisioningState}' \
  -o json 2>/dev/null | jq '.' || echo "Not found"

echo ""
echo "Backend App - CPU & Memory:"
az containerapp show \
  --name ilmoportaali-app \
  --resource-group $RESOURCE_GROUP \
  --query 'properties.template.containers[0].[resources.cpu, resources.memory]' \
  -o json 2>/dev/null | jq '.' || echo "Not found"

echo ""
echo "Backend App - Replicas:"
az containerapp show \
  --name ilmoportaali-app \
  --resource-group $RESOURCE_GROUP \
  --query 'properties.template.scale.[minReplicas, maxReplicas]' \
  -o json 2>/dev/null | jq '.' || echo "Not found"

echo ""
echo "---"
echo ""

# Frontend Container App
echo "Frontend App (ilmoportaali-frontend):"
az containerapp show \
  --name ilmoportaali-frontend \
  --resource-group $RESOURCE_GROUP \
  --query '{name: name, location: location, provisioningState: properties.provisioningState}' \
  -o json 2>/dev/null | jq '.' || echo "Not found"

echo ""
echo "Frontend App - CPU & Memory:"
az containerapp show \
  --name ilmoportaali-frontend \
  --resource-group $RESOURCE_GROUP \
  --query 'properties.template.containers[0].[resources.cpu, resources.memory]' \
  -o json 2>/dev/null | jq '.' || echo "Not found"

echo ""
echo "Frontend App - Replicas:"
az containerapp show \
  --name ilmoportaali-frontend \
  --resource-group $RESOURCE_GROUP \
  --query 'properties.template.scale.[minReplicas, maxReplicas]' \
  -o json 2>/dev/null | jq '.' || echo "Not found"

echo ""

# ====== POSTGRESQL DATABASE ======
echo "========================================"
echo "POSTGRESQL DATABASE"
echo "========================================"
echo ""

echo "Finding PostgreSQL servers..."
az postgres server list \
  --resource-group $RESOURCE_GROUP \
  --query '[].{name: name, location: location}' \
  -o json 2>/dev/null | jq '.' || echo "No PostgreSQL servers found"

echo ""
echo "Database Details (if found):"
POSTGRES_SERVER=$(az postgres server list --resource-group $RESOURCE_GROUP --query '[0].name' -o tsv 2>/dev/null)

if [ -n "$POSTGRES_SERVER" ]; then
  echo "Server: $POSTGRES_SERVER"

  echo ""
  echo "Pricing Tier & Compute:"
  az postgres server show \
    --name $POSTGRES_SERVER \
    --resource-group $RESOURCE_GROUP \
    --query '{skuName: sku.name, skuTier: sku.tier, skuCapacity: sku.capacity}' \
    -o json 2>/dev/null | jq '.'

  echo ""
  echo "Storage & Backups:"
  az postgres server show \
    --name $POSTGRES_SERVER \
    --resource-group $RESOURCE_GROUP \
    --query '{storageMB: storageProfile.storageMB, backupRetentionDays: storageProfile.backupRetentionDays, geoRedundantBackup: storageProfile.geoRedundantBackup}' \
    -o json 2>/dev/null | jq '.'
else
  echo "No PostgreSQL server found"
fi

echo ""

# ====== CONTAINER REGISTRY ======
echo "========================================"
echo "CONTAINER REGISTRY"
echo "========================================"
echo ""

echo "Finding Container Registries..."
az acr list \
  --resource-group $RESOURCE_GROUP \
  --query '[].{name: name, loginServer: loginServer, sku: sku.name}' \
  -o json 2>/dev/null | jq '.' || echo "No registries found"

echo ""

# ====== STORAGE ACCOUNTS ======
echo "========================================"
echo "STORAGE ACCOUNTS"
echo "========================================"
echo ""

echo "Finding Storage Accounts..."
az storage account list \
  --resource-group $RESOURCE_GROUP \
  --query '[].{name: name, kind: kind, skuName: sku.name}' \
  -o json 2>/dev/null | jq '.' || echo "No storage accounts found"

echo ""

# ====== RESOURCE SUMMARY ======
echo "========================================"
echo "RESOURCE SUMMARY"
echo "========================================"
echo ""

az resource list \
  --resource-group $RESOURCE_GROUP \
  --query '[].{type: type, name: name, location: location}' \
  -o table 2>/dev/null

echo ""
echo "========================================"
echo "Script Complete"
echo "========================================"
echo ""
echo "Copy the output above to share with cost analysis."
