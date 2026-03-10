import { ReplitConnectors } from "@replit/connectors-sdk";
import { storage } from "./storage";

const connectors = new ReplitConnectors();
const BACKUP_FOLDER_NAME = "VisionClaw Backups";

async function findOrCreateFolder(): Promise<string> {
  const searchResp = await connectors.proxy(
    "google-drive",
    `/drive/v3/files?q=name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { method: "GET" }
  );

  if (!searchResp.ok) {
    throw new Error(`Failed to search Google Drive: ${searchResp.status}`);
  }

  const searchData = (await searchResp.json()) as any;
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createResp = await connectors.proxy(
    "google-drive",
    "/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: BACKUP_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );

  if (!createResp.ok) {
    throw new Error(`Failed to create backup folder: ${createResp.status}`);
  }

  const folderData = (await createResp.json()) as any;
  return folderData.id;
}

async function cleanOldBackups(folderId: string, keepCount: number = 30) {
  const listResp = await connectors.proxy(
    "google-drive",
    `/drive/v3/files?q='${folderId}' in parents and trashed=false&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=100`,
    { method: "GET" }
  );

  if (!listResp.ok) return;

  const listData = (await listResp.json()) as any;
  const files = listData.files || [];

  if (files.length <= keepCount) return;

  const toDelete = files.slice(keepCount);
  for (const file of toDelete) {
    await connectors.proxy("google-drive", `/drive/v3/files/${file.id}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  console.log(`[backup] Cleaned ${toDelete.length} old backups, keeping ${keepCount}`);
}

export async function runBackupToGoogleDrive(): Promise<string> {
  const startTime = Date.now();
  console.log("[backup] Starting full system backup to Google Drive...");

  const exportData = await storage.getAllDataForExport();

  const backupData = {
    ...exportData,
    backupType: "automated_daily",
    backupTimestamp: new Date().toISOString(),
  };

  const jsonContent = JSON.stringify(backupData, null, 2);
  const jsonBuffer = Buffer.from(jsonContent, "utf-8");

  const folderId = await findOrCreateFolder();

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `visionclaw-backup-${dateStr}.json`;

  const boundary = "----BackupBoundary" + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
  });

  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n`));
  parts.push(jsonBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const uploadResp = await connectors.proxy(
    "google-drive",
    "/upload/drive/v3/files?uploadType=multipart&fields=id,name,size",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`Upload failed (${uploadResp.status}): ${errText}`);
  }

  const uploadData = (await uploadResp.json()) as any;
  const sizeMB = (jsonBuffer.length / (1024 * 1024)).toFixed(2);
  const durationMs = Date.now() - startTime;

  await cleanOldBackups(folderId);

  const summary = `Backup complete: ${fileName} (${sizeMB} MB) uploaded to Google Drive/${BACKUP_FOLDER_NAME} in ${durationMs}ms. File ID: ${uploadData.id}`;
  console.log(`[backup] ${summary}`);
  return summary;
}
