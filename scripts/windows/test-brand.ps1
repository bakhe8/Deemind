# @reuse-from: npm scripts
# @description: Quick Windows sanity runner for the Brand Wizard toolchain.
Write-Host "🧪 Running brand extraction..."
npm run brand:extract

Write-Host "🎨 Applying sample brand to demo..."
npm run brand:apply -- --brand=brand-TEST --theme=demo

Write-Host "🗂  Recent brand log entries:"
Get-Content .\logs\brands.log -Tail 20
