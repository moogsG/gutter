#!/bin/bash

# Gutter Database Backup Script
# Backs up SQLite databases to timestamped files and keeps last 7 backups

set -e # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
KEEP_LAST=7

# Database paths (use env vars or defaults)
JOURNAL_DB_PATH="${JOURNAL_DB_PATH:-${PROJECT_ROOT}/gutter-journal.db}"
TASKS_DB_PATH="${TASKS_DB_PATH:-${PROJECT_ROOT}/gutter.db}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=== Gutter Database Backup ==="
echo "Started at: $(date)"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Backup journal database
if [ -f "$JOURNAL_DB_PATH" ]; then
	JOURNAL_BACKUP="${BACKUP_DIR}/gutter-journal-${TIMESTAMP}.db"
	echo "Backing up journal database..."
	echo "  Source: $JOURNAL_DB_PATH"
	echo "  Destination: $JOURNAL_BACKUP"

	cp "$JOURNAL_DB_PATH" "$JOURNAL_BACKUP"

	if [ -f "$JOURNAL_BACKUP" ]; then
		SIZE=$(du -h "$JOURNAL_BACKUP" | cut -f1)
		echo "  Success! Size: $SIZE"
	else
		echo "  ERROR: Backup failed!"
		exit 1
	fi
else
	echo "WARNING: Journal database not found at $JOURNAL_DB_PATH"
fi

echo ""

# Backup main database
if [ -f "$TASKS_DB_PATH" ]; then
	TASKS_BACKUP="${BACKUP_DIR}/gutter-${TIMESTAMP}.db"
	echo "Backing up main database..."
	echo "  Source: $TASKS_DB_PATH"
	echo "  Destination: $TASKS_BACKUP"

	cp "$TASKS_DB_PATH" "$TASKS_BACKUP"

	if [ -f "$TASKS_BACKUP" ]; then
		SIZE=$(du -h "$TASKS_BACKUP" | cut -f1)
		echo "  Success! Size: $SIZE"
	else
		echo "  ERROR: Backup failed!"
		exit 1
	fi
else
	echo "WARNING: Main database not found at $TASKS_DB_PATH"
fi

echo ""

# Clean up old backups (keep last 7)
echo "Cleaning up old backups (keeping last $KEEP_LAST)..."

# Journal DB backups
JOURNAL_BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/gutter-journal-*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$JOURNAL_BACKUP_COUNT" -gt "$KEEP_LAST" ]; then
	ls -1t "$BACKUP_DIR"/gutter-journal-*.db | tail -n +$((KEEP_LAST + 1)) | while read -r old_backup; do
		echo "  Deleting old journal backup: $(basename "$old_backup")"
		rm -f "$old_backup"
	done
else
	echo "  Journal backups: $JOURNAL_BACKUP_COUNT (under limit)"
fi

# Main DB backups
TASKS_BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/gutter-[0-9]*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$TASKS_BACKUP_COUNT" -gt "$KEEP_LAST" ]; then
	ls -1t "$BACKUP_DIR"/gutter-[0-9]*.db | tail -n +$((KEEP_LAST + 1)) | while read -r old_backup; do
		echo "  Deleting old main backup: $(basename "$old_backup")"
		rm -f "$old_backup"
	done
else
	echo "  Main backups: $TASKS_BACKUP_COUNT (under limit)"
fi

echo ""
echo "=== Backup Complete ==="
echo "Finished at: $(date)"

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Total backup directory size: $TOTAL_SIZE"

exit 0
