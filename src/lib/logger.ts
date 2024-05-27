import fs from "fs/promises";
import path from "path";

const logFilePath = path.join(process.cwd(), "logs", "app.log");

async function logMessage(message: string) {
  try {
    const logDir = path.dirname(logFilePath);
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(
      logFilePath,
      `${new Date().toISOString()} - ${message}\n`
    );
  } catch (error) {
    console.error("Failed to write log", error);
  }
}

export async function logInfo(message: string) {
  await logMessage(`INFO: ${message}`);
}

export async function logError(message: string, error: unknown) {
  const errorMessage =
    error instanceof Error ? error.stack : JSON.stringify(error);
  await logMessage(`ERROR: ${message} - ${errorMessage}`);
}
