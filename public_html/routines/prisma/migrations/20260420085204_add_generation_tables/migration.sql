-- AlterTable
ALTER TABLE `contents` ADD COLUMN `reused_from_content_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `upcoming_topics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `genre` VARCHAR(50) NOT NULL,
    `key_phrase` VARCHAR(255) NOT NULL,
    `key_ko` VARCHAR(255) NOT NULL,
    `hint` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `upcoming_topics_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `target_date` DATE NOT NULL,
    `run_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('running', 'success', 'failed', 'fallback') NOT NULL,
    `provider` VARCHAR(20) NULL,
    `model` VARCHAR(100) NULL,
    `duration_ms` INTEGER NULL,
    `content_id` INTEGER NULL,
    `error_message` TEXT NULL,
    `attempt` INTEGER NOT NULL DEFAULT 1,

    INDEX `generation_logs_run_at_idx`(`run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contents` ADD CONSTRAINT `contents_reused_from_content_id_fkey` FOREIGN KEY (`reused_from_content_id`) REFERENCES `contents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

