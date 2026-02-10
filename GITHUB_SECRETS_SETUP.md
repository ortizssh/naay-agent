# GitHub Secrets Configuration for Azure Deployment

## ⚠️ IMPORTANTE: Configure estos secretos en GitHub para habilitar el deployment automático

### 🔐 GitHub Secrets Requeridos

Ve a tu repositorio en GitHub:
1. **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Agrega los siguientes secretos:sacd


### 📋 AZUREAPPSERVICE_PUBLISHPROFILE

**Nombre del secret:** `AZUREAPPSERVICE_PUBLISHPROFILE`

**Valor del secret:** (Copia y pega el XML completo)

```xml
<publishData><publishProfile profileName="naay-agent-app1763504937 - Web Deploy" publishMethod="MSDeploy" publishUrl="naay-agent-app1763504937.scm.azurewebsites.net:443" msdeploySite="naay-agent-app1763504937" userName="$naay-agent-app1763504937" userPWD="yd1uiuaTC9LqjCKymd0TskLs7QJEavcJZ8M2hcR5ExJqjgC3jYBtALiyuimv" destinationAppUrl="http://app.heykova.io" SQLServerDBConnectionString="" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="naay-agent-app1763504937 - FTP" publishMethod="FTP" publishUrl="ftps://waws-prod-mwh-113.ftp.azurewebsites.windows.net/site/wwwroot" ftpPassiveMode="True" userName="naay-agent-app1763504937\$naay-agent-app1763504937" userPWD="yd1uiuaTC9LqjCKymd0TskLs7QJEavcJZ8M2hcR5ExJqjgC3jYBtALiyuimv" destinationAppUrl="http://app.heykova.io" SQLServerDBConnectionString="" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="naay-agent-app1763504937 - Zip Deploy" publishMethod="ZipDeploy" publishUrl="naay-agent-app1763504937.scm.azurewebsites.net:443" userName="$naay-agent-app1763504937" userPWD="yd1uiuaTC9LqjCKymd0TskLs7QJEavcJZ8M2hcR5ExJqjgC3jYBtALiyuimv" destinationAppUrl="http://app.heykova.io" SQLServerDBConnectionString="" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile></publishData>
```

### 📋 AZUREAPPSERVICE_PUBLISHPROFILE_STAGING (Opcional - Para staging slot)

**Nombre del secret:** `AZUREAPPSERVICE_PUBLISHPROFILE_STAGING`

Si creaste el staging slot, obtén su publish profile con:
```bash
az webapp deployment list-publishing-profiles --name naay-agent-app1763504937 --resource-group naay-agent-rg --slot staging --xml
```

## ✅ Una vez configurados los secrets:

1. **Push tu código:**
   ```bash
   git add .
   git commit -m "Configure Azure deployment with publish profile"
   git push origin main
   ```

2. **Verifica el deployment:**
   - Ve a **Actions** tab en GitHub
   - Observa el workflow ejecutándose
   - El deployment debería completarse exitosamente

## 🌐 URLs del deployment:

- **Production:** https://app.heykova.io
- **Staging:** https://naay-agent-app1763504937-staging.azurewebsites.net (si configurado)

## 🔧 Si necesitas regenerar el publish profile:

```bash
# Para production
az webapp deployment list-publishing-profiles --name naay-agent-app1763504937 --resource-group naay-agent-rg --xml

# Para staging (si existe)
az webapp deployment list-publishing-profiles --name naay-agent-app1763504937 --resource-group naay-agent-rg --slot staging --xml
```

## 📋 Próximo paso:

**Configure también las variables de entorno en Azure Portal** según el archivo `azure-service-info.txt`:

- Ve a: https://portal.azure.com
- Busca: `naay-agent-app1763504937`
- Configuration → Application settings
- Agrega las variables requeridas (Supabase, OpenAI, etc.)

---

🚀 **Una vez completado esto, tu Naay Agent estará completamente funcional en Azure!**