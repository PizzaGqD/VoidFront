$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
$pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$imageFormat = [System.Drawing.Imaging.ImageFormat]::Png

function Clamp-Byte([double]$value) {
  if ($value -lt 0) { return 0 }
  if ($value -gt 255) { return 255 }
  return [int][Math]::Round($value)
}

function Get-Luminance($color) {
  return 0.2126 * $color.R + 0.7152 * $color.G + 0.0722 * $color.B
}

function New-TransparentBitmap([int]$width, [int]$height) {
  return New-Object System.Drawing.Bitmap($width, $height, $pixelFormat)
}

function Find-AlphaBounds($bitmap, [int]$minAlpha = 10) {
  $minX = $bitmap.Width
  $minY = $bitmap.Height
  $maxX = -1
  $maxY = -1
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      $alpha = $bitmap.GetPixel($x, $y).A
      if ($alpha -le $minAlpha) { continue }
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  if ($maxX -lt $minX -or $maxY -lt $minY) {
    throw "Image contains no visible pixels."
  }
  return @{
    minX = $minX
    minY = $minY
    width = $maxX - $minX + 1
    height = $maxY - $minY + 1
  }
}

function Normalize-SourceBitmap($sourceBitmap, $config) {
  $bounds = Find-AlphaBounds $sourceBitmap 10
  $destSize = [int]$config.destSize
  $margin = [int]$config.margin
  $workArea = $destSize - $margin * 2
  $scale = [Math]::Min($workArea / $bounds.width, $workArea / $bounds.height)
  $destWidth = [Math]::Max(1, [int][Math]::Round($bounds.width * $scale))
  $destHeight = [Math]::Max(1, [int][Math]::Round($bounds.height * $scale))
  $destX = [int][Math]::Floor(($destSize - $destWidth) / 2)
  $destY = [int][Math]::Floor(($destSize - $destHeight) / 2)
  $normalized = New-TransparentBitmap $destSize $destSize
  $graphics = [System.Drawing.Graphics]::FromImage($normalized)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $srcRect = New-Object System.Drawing.Rectangle($bounds.minX, $bounds.minY, $bounds.width, $bounds.height)
    $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $destWidth, $destHeight)
    $graphics.DrawImage($sourceBitmap, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  } finally {
    $graphics.Dispose()
  }
  return $normalized
}

function Test-RectRegion([int]$x, [int]$y, $region) {
  return ($x -ge $region.x -and $x -lt ($region.x + $region.width) -and $y -ge $region.y -and $y -lt ($region.y + $region.height))
}

function Test-EllipseRegion([int]$x, [int]$y, $region) {
  $dx = ($x - $region.cx) / [Math]::Max(1, $region.rx)
  $dy = ($y - $region.cy) / [Math]::Max(1, $region.ry)
  return ($dx * $dx + $dy * $dy) -le 1.0
}

function Test-RegionHit([int]$x, [int]$y, $regions) {
  foreach ($region in $regions) {
    if ($region.type -eq "ellipse") {
      if (Test-EllipseRegion $x $y $region) { return $true }
    } else {
      if (Test-RectRegion $x $y $region) { return $true }
    }
  }
  return $false
}

function Write-LayeredBitmaps($normalizedBitmap, $config, [string]$outputDir) {
  $baseLayer = New-TransparentBitmap $normalizedBitmap.Width $normalizedBitmap.Height
  $emissiveLayer = New-TransparentBitmap $normalizedBitmap.Width $normalizedBitmap.Height
  $accentLayer = New-TransparentBitmap $normalizedBitmap.Width $normalizedBitmap.Height
  try {
    for ($y = 0; $y -lt $normalizedBitmap.Height; $y++) {
      for ($x = 0; $x -lt $normalizedBitmap.Width; $x++) {
        $pixel = $normalizedBitmap.GetPixel($x, $y)
        if ($pixel.A -le 2) { continue }
        $lum = Get-Luminance $pixel

        $baseAlpha = $pixel.A
        if ($lum -gt 208) {
          $baseAlpha = [Math]::Min($baseAlpha, 176)
        } elseif ($lum -gt 176) {
          $baseAlpha = [Math]::Min($baseAlpha, 212)
        }

        $targetLum = $lum
        if ($lum -gt 220) {
          $targetLum = 96 + ($lum - 220) * 0.10
        } elseif ($lum -gt 180) {
          $targetLum = 84 + ($lum - 180) * 0.25
        } else {
          $targetLum = $lum * 0.96
        }
        $factor = if ($lum -gt 1) { $targetLum / $lum } else { 1.0 }
        $baseColor = [System.Drawing.Color]::FromArgb(
          [int]$baseAlpha,
          (Clamp-Byte ($pixel.R * $factor)),
          (Clamp-Byte ($pixel.G * $factor)),
          (Clamp-Byte ($pixel.B * $factor))
        )
        $baseLayer.SetPixel($x, $y, $baseColor)

        if ((Test-RegionHit $x $y $config.emissiveRegions) -and $lum -gt 132) {
          $emissiveAlpha = Clamp-Byte (($pixel.A / 255.0) * (($lum - 132) / 123.0) * 255.0)
          if ($emissiveAlpha -gt 0) {
            $emissiveLayer.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($emissiveAlpha, 255, 255, 255))
          }
        }

        if ((Test-RegionHit $x $y $config.accentRegions) -and $lum -gt 46) {
          $accentAlpha = Clamp-Byte (($pixel.A / 255.0) * (([Math]::Min(1.0, ($lum - 46) / 120.0)) * $config.accentStrength) * 255.0)
          if ($accentAlpha -gt 0) {
            $accentLayer.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($accentAlpha, 255, 255, 255))
          }
        }
      }
    }

    $basePath = Join-Path $outputDir ($config.key + ".base.png")
    $emissivePath = Join-Path $outputDir ($config.key + ".emissive.png")
    $accentPath = Join-Path $outputDir ($config.key + ".accent.png")
    $baseLayer.Save($basePath, $imageFormat)
    $emissiveLayer.Save($emissivePath, $imageFormat)
    $accentLayer.Save($accentPath, $imageFormat)
    Write-Output ("Prepared ship sprite layers: " + $config.key)
  } finally {
    $baseLayer.Dispose()
    $emissiveLayer.Dispose()
    $accentLayer.Dispose()
  }
}

$repoRoot = Split-Path $PSScriptRoot -Parent
$sourceDir = Join-Path $repoRoot "assets/Ships/Players"
$outputDir = Join-Path $sourceDir "Layers"

$configs = @(
  @{
    key = "destroyer"
    source = "Destroyer.png"
    destSize = 512
    margin = 34
    accentStrength = 0.34
    emissiveRegions = @(
      @{ type = "rect"; x = 243; y = 102; width = 24; height = 46 },
      @{ type = "rect"; x = 246; y = 140; width = 20; height = 154 },
      @{ type = "rect"; x = 146; y = 226; width = 22; height = 54 },
      @{ type = "rect"; x = 344; y = 226; width = 22; height = 54 },
      @{ type = "rect"; x = 214; y = 335; width = 18; height = 24 },
      @{ type = "rect"; x = 280; y = 335; width = 18; height = 24 },
      @{ type = "ellipse"; cx = 212; cy = 418; rx = 28; ry = 56 },
      @{ type = "ellipse"; cx = 256; cy = 403; rx = 18; ry = 42 },
      @{ type = "ellipse"; cx = 300; cy = 418; rx = 28; ry = 56 }
    )
    accentRegions = @(
      @{ type = "rect"; x = 233; y = 132; width = 48; height = 208 },
      @{ type = "rect"; x = 129; y = 214; width = 70; height = 128 },
      @{ type = "rect"; x = 313; y = 214; width = 70; height = 128 },
      @{ type = "rect"; x = 181; y = 304; width = 64; height = 132 },
      @{ type = "rect"; x = 266; y = 304; width = 64; height = 132 },
      @{ type = "rect"; x = 238; y = 296; width = 37; height = 148 }
    )
  },
  @{
    key = "battleship"
    source = "Battleship capital ship.png"
    destSize = 512
    margin = 34
    accentStrength = 0.30
    emissiveRegions = @(
      @{ type = "rect"; x = 246; y = 112; width = 24; height = 42 },
      @{ type = "rect"; x = 244; y = 144; width = 26; height = 158 },
      @{ type = "rect"; x = 156; y = 254; width = 22; height = 56 },
      @{ type = "rect"; x = 334; y = 254; width = 22; height = 56 },
      @{ type = "rect"; x = 193; y = 330; width = 16; height = 28 },
      @{ type = "rect"; x = 246; y = 338; width = 18; height = 28 },
      @{ type = "rect"; x = 304; y = 330; width = 16; height = 28 },
      @{ type = "ellipse"; cx = 206; cy = 420; rx = 28; ry = 54 },
      @{ type = "ellipse"; cx = 256; cy = 425; rx = 25; ry = 58 },
      @{ type = "ellipse"; cx = 306; cy = 420; rx = 28; ry = 54 }
    )
    accentRegions = @(
      @{ type = "rect"; x = 227; y = 132; width = 58; height = 224 },
      @{ type = "rect"; x = 117; y = 208; width = 86; height = 136 },
      @{ type = "rect"; x = 309; y = 208; width = 86; height = 136 },
      @{ type = "rect"; x = 174; y = 296; width = 54; height = 144 },
      @{ type = "rect"; x = 231; y = 310; width = 50; height = 150 },
      @{ type = "rect"; x = 286; y = 296; width = 54; height = 144 }
    )
  }
)

foreach ($config in $configs) {
  $sourcePath = Join-Path $sourceDir $config.source
  if (!(Test-Path $sourcePath)) {
    throw "Missing source image: $sourcePath"
  }
  $sourceBitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $normalizedBitmap = Normalize-SourceBitmap $sourceBitmap $config
    try {
      Write-LayeredBitmaps $normalizedBitmap $config $outputDir
    } finally {
      $normalizedBitmap.Dispose()
    }
  } finally {
    $sourceBitmap.Dispose()
  }
}
