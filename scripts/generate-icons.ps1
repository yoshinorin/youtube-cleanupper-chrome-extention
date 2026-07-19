# Regenerates src/icons/icon{16,32,48,128}.png: a red rounded square with a
# white "YC" wordmark, rendered with GDI+ (System.Drawing) using the Segoe UI
# Bold font installed on Windows. No npm packages or network access needed.
#
# Run with: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing

$sizes = 16, 32, 48, 128
$outDir = Join-Path $PSScriptRoot "..\src\icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded-square background
    $radius = [double]$size * 0.22
    $d = $radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 230, 0, 0))
    $g.FillPath($bgBrush, $path)

    # "YC" wordmark, sized to fit with margin, centered
    $targetWidth = [double]$size * 0.72
    $fontSize = [double]$size * 0.6
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $measured = $g.MeasureString("YC", $font)
    if ($measured.Width -gt $targetWidth) {
        $fontSize = $fontSize * ($targetWidth / $measured.Width)
        $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $measured = $g.MeasureString("YC", $font)
    }

    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $rect = New-Object System.Drawing.RectangleF(0, ([float]$size * 0.02 * -1), $size, $size)
    $g.DrawString("YC", $font, $whiteBrush, $rect, $format)

    $outPath = Join-Path $outDir "icon$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "wrote $outPath"

    $g.Dispose()
    $bmp.Dispose()
}
