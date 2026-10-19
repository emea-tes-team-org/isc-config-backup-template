// Shared backup path resolution — flat backups/ on tenant branches.

export const BACKUP_DIR = "backups";

/** Git path prefix for backup objects at a ref (flat layout). */
export function backupRootPosix() {
  return BACKUP_DIR;
}

/** Posix path for a single backup object file. */
export function backupObjectPosix(objectType, objectId) {
  return `${BACKUP_DIR}/${objectType}/${objectId}.json`;
}
