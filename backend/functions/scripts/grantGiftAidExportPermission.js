const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const EXPORT_PERMISSION = "export_giftaid";
const DOWNLOAD_PERMISSION = "download_giftaid_exports";
const EXPORT_ELIGIBLE_ROLES = new Set(["super_admin", "admin"]);
const DOWNLOAD_ELIGIBLE_ROLES = new Set(["super_admin", "admin", "manager"]);

const shouldHaveExportPermission = (userData) => {
  const role = typeof userData?.role === "string" ? userData.role : "";
  return EXPORT_ELIGIBLE_ROLES.has(role);
};

const shouldHaveDownloadPermission = (userData) => {
  const role = typeof userData?.role === "string" ? userData.role : "";
  return DOWNLOAD_ELIGIBLE_ROLES.has(role);
};

const grantGiftAidExportPermission = async () => {
  const snapshot = await db.collection("users").get();
  let scanned = 0;
  let exportGranted = 0;
  let exportRemoved = 0;
  let downloadGranted = 0;
  let downloadRemoved = 0;

  let batch = db.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const userData = doc.data() || {};
    const permissions = Array.isArray(userData.permissions) ? userData.permissions : [];
    const nextPermissions = [...permissions];
    let changed = false;

    const shouldHaveExport = shouldHaveExportPermission(userData);
    const hasExportPermission = nextPermissions.includes(EXPORT_PERMISSION);
    if (shouldHaveExport && !hasExportPermission) {
      nextPermissions.push(EXPORT_PERMISSION);
      exportGranted += 1;
      changed = true;
    } else if (!shouldHaveExport && hasExportPermission) {
      const index = nextPermissions.indexOf(EXPORT_PERMISSION);
      nextPermissions.splice(index, 1);
      exportRemoved += 1;
      changed = true;
    }

    const shouldHaveDownload = shouldHaveDownloadPermission(userData);
    const hasDownloadPermission = nextPermissions.includes(DOWNLOAD_PERMISSION);
    if (shouldHaveDownload && !hasDownloadPermission) {
      nextPermissions.push(DOWNLOAD_PERMISSION);
      downloadGranted += 1;
      changed = true;
    } else if (!shouldHaveDownload && hasDownloadPermission) {
      const index = nextPermissions.indexOf(DOWNLOAD_PERMISSION);
      nextPermissions.splice(index, 1);
      downloadRemoved += 1;
      changed = true;
    }

    if (!changed) {
      continue;
    }
    batch.set(doc.ref, {
      permissions: nextPermissions,
      updatedAt: new Date().toISOString(),
    }, {merge: true});
    batchOps += 1;

    if (batchOps === 400) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  console.log("Gift Aid permission sync complete.");
  console.log({
    scanned,
    exportGranted,
    exportRemoved,
    downloadGranted,
    downloadRemoved,
  });
};

grantGiftAidExportPermission()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to sync Gift Aid permissions:", error);
    process.exit(1);
  });
