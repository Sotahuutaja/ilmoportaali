# Azure Cost Audit Script (PowerShell)
# Gathers resource details for cost estimation

$RESOURCE_GROUP = "RG_Ilmoportaali"
$REGION = "swedencentral"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Azure Cost Audit for $RESOURCE_GROUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if user is logged in
Write-Host "Checking Azure login..." -ForegroundColor Yellow
az account show > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Logged in to Azure" -ForegroundColor Green
} else {
    Write-Host "ERROR - Not logged into Azure. Please run: az login" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ====== CONTAINER APPS ======
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONTAINER APPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Backend Container App
Write-Host "Backend App (ilmoportaali-app):" -ForegroundColor Yellow
az containerapp show `
  --name ilmoportaali-app `
  --resource-group $RESOURCE_GROUP `
  --query '{name: name, location: location, provisioningState: properties.provisioningState}' `
  -o json 2>&1

Write-Host ""
Write-Host "Backend App - CPU and Memory:" -ForegroundColor Yellow
az containerapp show `
  --name ilmoportaali-app `
  --resource-group $RESOURCE_GROUP `
  --query 'properties.template.containers[0].[resources.cpu, resources.memory]' `
  -o json 2>&1

Write-Host ""
Write-Host "Backend App - Replicas:" -ForegroundColor Yellow
az containerapp show `
  --name ilmoportaali-app `
  --resource-group $RESOURCE_GROUP `
  --query 'properties.template.scale.[minReplicas, maxReplicas]' `
  -o json 2>&1

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Frontend Container App
Write-Host "Frontend App (ilmoportaali-frontend):" -ForegroundColor Yellow
az containerapp show `
  --name ilmoportaali-frontend `
  --resource-group $RESOURCE_GROUP `
  --query '{name: name, location: location, provisioningState: properties.provisioningState}' `
  -o json 2>&1

Write-Host ""
Write-Host "Frontend App - CPU and Memory:" -ForegroundColor Yellow
az containerapp show `
  --name ilmoportaali-frontend `
  --resource-group $RESOURCE_GROUP `
  --query 'properties.template.containers[0].[resources.cpu, resources.memory]' `
  -o json 2>&1

Write-Host ""
Write-Host "Frontend App - Replicas:" -ForegroundColor Yellow
az containerapp show `
  --name ilmoportaali-frontend `
  --resource-group $RESOURCE_GROUP `
  --query 'properties.template.scale.[minReplicas, maxReplicas]' `
  -o json 2>&1

Write-Host ""

# ====== POSTGRESQL DATABASE ======
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "POSTGRESQL DATABASE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Finding PostgreSQL servers..." -ForegroundColor Yellow
az postgres server list `
  --resource-group $RESOURCE_GROUP `
  --query '[].{name: name, location: location}' `
  -o json 2>&1

Write-Host ""

$POSTGRES_SERVER = az postgres server list `
  --resource-group $RESOURCE_GROUP `
  --query '[0].name' `
  -o tsv 2>&1

if ($POSTGRES_SERVER -and $POSTGRES_SERVER -notmatch "error") {
  Write-Host "Server: $POSTGRES_SERVER" -ForegroundColor Green

  Write-Host ""
  Write-Host "Pricing Tier and Compute:" -ForegroundColor Yellow
  az postgres server show `
    --name $POSTGRES_SERVER `
    --resource-group $RESOURCE_GROUP `
    --query '{skuName: sku.name, skuTier: sku.tier, skuCapacity: sku.capacity}' `
    -o json 2>&1

  Write-Host ""
  Write-Host "Storage and Backups:" -ForegroundColor Yellow
  az postgres server show `
    --name $POSTGRES_SERVER `
    --resource-group $RESOURCE_GROUP `
    --query '{storageMB: storageProfile.storageMB, backupRetentionDays: storageProfile.backupRetentionDays, geoRedundantBackup: storageProfile.geoRedundantBackup}' `
    -o json 2>&1
}

Write-Host ""

# ====== CONTAINER REGISTRY ======
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONTAINER REGISTRY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Finding Container Registries..." -ForegroundColor Yellow
az acr list `
  --resource-group $RESOURCE_GROUP `
  --query '[].{name: name, loginServer: loginServer, sku: sku.name}' `
  -o json 2>&1

Write-Host ""

# ====== RESOURCE SUMMARY ======
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESOURCE SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

az resource list `
  --resource-group $RESOURCE_GROUP `
  --query '[].{type: type, name: name, location: location}' `
  -o table 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Script Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copy the output above to share for cost analysis." -ForegroundColor Green
