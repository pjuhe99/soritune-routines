-- AlterTable: drop old unique, add level column, add new unique, add new index
-- Done in a single ALTER TABLE to avoid FK index dependency issues on MariaDB
ALTER TABLE `user_progress`
  DROP INDEX `user_progress_user_id_content_id_step_key`,
  ADD COLUMN `level` ENUM('beginner', 'intermediate', 'advanced') NOT NULL AFTER `content_id`,
  ADD UNIQUE INDEX `user_progress_user_id_content_id_level_step_key` (`user_id`, `content_id`, `level`, `step`),
  ADD INDEX `user_progress_user_id_content_id_level_idx` (`user_id`, `content_id`, `level`);
