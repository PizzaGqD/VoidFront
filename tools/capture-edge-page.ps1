param(
  [string]$UrlPrefix = "http://127.0.0.1:3040/",
  [string]$OutputPath = "",
  [string]$EvalScript = "",
  [int]$DebugPort = 9222,
  [int]$Width = 1600,
  [int]$Height = 900,
  [int]$DelayMs = 2500
)

$ErrorActionPreference = "Stop"

function Receive-CdpMessage($client) {
  $buffer = New-Object byte[] 1048576
  $segment = [ArraySegment[byte]]::new($buffer)
  $stream = New-Object System.IO.MemoryStream
  try {
    do {
      $result = $client.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
        throw "DevTools socket closed unexpectedly."
      }
      $stream.Write($buffer, 0, $result.Count)
    } until ($result.EndOfMessage)
    $json = [Text.Encoding]::UTF8.GetString($stream.ToArray())
    return $json | ConvertFrom-Json
  } finally {
    $stream.Dispose()
  }
}

$script:messageId = 0
function Send-CdpMessage($client, [string]$method, $params) {
  $script:messageId += 1
  $payload = @{ id = $script:messageId; method = $method }
  if ($null -ne $params) { $payload.params = $params }
  $json = $payload | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $segment = [ArraySegment[byte]]::new($bytes)
  $client.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  while ($true) {
    $message = Receive-CdpMessage $client
    if ($null -ne $message.id -and [int]$message.id -eq $script:messageId) {
      if ($message.error) {
        $errMessage = if ($message.error.message) { $message.error.message } else { "unknown" }
        throw ("CDP error for " + $method + ": " + $errMessage)
      }
      return $message
    }
  }
}

$targets = Invoke-RestMethod -UseBasicParsing ("http://127.0.0.1:" + $DebugPort + "/json/list")
$pageTarget = $targets | Where-Object { $_.type -eq "page" -and $_.url.StartsWith($UrlPrefix) } | Select-Object -First 1
if (-not $pageTarget) {
  throw "Could not find a DevTools page target for $UrlPrefix"
}

$outputFile = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  Join-Path (Get-Location) "edge-capture.png"
} else {
  $OutputPath
}

$client = [System.Net.WebSockets.ClientWebSocket]::new()
try {
  $client.ConnectAsync([Uri]$pageTarget.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

  Send-CdpMessage $client "Page.enable" @{} | Out-Null
  Send-CdpMessage $client "Runtime.enable" @{} | Out-Null
  Send-CdpMessage $client "Emulation.setDeviceMetricsOverride" @{
    width = $Width
    height = $Height
    deviceScaleFactor = 1
    mobile = $false
  } | Out-Null

  if (-not [string]::IsNullOrWhiteSpace($EvalScript)) {
    $evalResult = Send-CdpMessage $client "Runtime.evaluate" @{
      expression = $EvalScript
      awaitPromise = $true
      returnByValue = $true
    }
    if ($evalResult.result -and $evalResult.result.result) {
      $value = $evalResult.result.result.value
      if ($null -ne $value) {
        Write-Output ("Eval result: " + ($value | ConvertTo-Json -Compress))
      }
    }
  }

  Start-Sleep -Milliseconds $DelayMs

  $stateProbe = Send-CdpMessage $client "Runtime.evaluate" @{
    expression = "window._gameTest ? ({ units: window._gameTest.state.units.size, time: window._gameTest.state.t, visibleScreen: document.querySelector('#gameWrap') ? getComputedStyle(document.querySelector('#gameWrap')).display : 'missing' }) : 'no-game-test'"
    awaitPromise = $false
    returnByValue = $true
  }
  if ($stateProbe.result -and $stateProbe.result.result -and $stateProbe.result.result.value) {
    Write-Output ("State probe: " + ($stateProbe.result.result.value | ConvertTo-Json -Compress))
  }

  $shot = Send-CdpMessage $client "Page.captureScreenshot" @{
    format = "png"
    fromSurface = $true
    captureBeyondViewport = $true
  }
  [IO.File]::WriteAllBytes($outputFile, [Convert]::FromBase64String($shot.result.data))
  Write-Output ("Screenshot saved to " + $outputFile)
} finally {
  if ($client.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    $client.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  } elseif ($client.State -eq [System.Net.WebSockets.WebSocketState]::CloseReceived) {
    $client.CloseOutputAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  }
  $client.Dispose()
}
