/**
 * Останавливает процесс, слушающий порт 3040 (сервер VoidFront).
 * Запуск: node stop-server.js   или  npm run stop
 */
const { execSync } = require("child_process");
const PORT = 3040;

function killWin(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const line = out.split("\n")[0];
    if (!line) return false;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (!pid || !/^\d+$/.test(pid)) return false;
    execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
    console.log("Сервер (PID " + pid + ") остановлен.");
    return true;
  } catch (e) {
    if (e.status === 1) {
      console.log("Порт " + port + " свободен, сервер не запущен.");
      return false;
    }
    throw e;
  }
}

function killUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "inherit" });
    console.log("Сервер остановлен.");
    return true;
  } catch (e) {
    console.log("Порт " + port + " свободен, сервер не запущен.");
    return false;
  }
}

const isWin = process.platform === "win32";
if (isWin) killWin(PORT);
else killUnix(PORT);
