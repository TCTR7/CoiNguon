$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot '.tools'
$javaDir = Join-Path $toolsDir 'java'
New-Item -ItemType Directory -Force -Path $javaDir | Out-Null
$assets = Invoke-RestMethod -Uri 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse'
$package = $assets[0].binary.package
$archive = Join-Path $toolsDir 'java21.zip'
Invoke-WebRequest -Uri $package.link -OutFile $archive -UseBasicParsing
$actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $package.checksum.ToLowerInvariant()) { throw 'Java archive checksum mismatch.' }
Expand-Archive -LiteralPath $archive -DestinationPath $javaDir -Force
Write-Output 'Verified Java 21 runtime is available in .tools/java; system Java is unchanged.'
