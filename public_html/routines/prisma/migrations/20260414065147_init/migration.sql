-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NULL,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `subscription_status` ENUM('free', 'active', 'expired') NOT NULL DEFAULT 'free',
    `subscription_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_login_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_resets_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `genre` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` VARCHAR(255) NULL,
    `key_phrase` VARCHAR(255) NOT NULL,
    `key_ko` VARCHAR(255) NOT NULL,
    `paragraphs` JSON NOT NULL,
    `sentences` JSON NOT NULL,
    `expressions` JSON NOT NULL,
    `quiz` JSON NOT NULL,
    `interview` JSON NOT NULL,
    `speak_sentences` JSON NOT NULL,
    `published_at` DATE NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `contents_published_at_is_active_priority_idx`(`published_at`, `is_active`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_progress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NOT NULL,
    `content_id` INTEGER NOT NULL,
    `step` ENUM('reading', 'listening', 'expressions', 'quiz', 'interview', 'speaking') NOT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `skipped` BOOLEAN NOT NULL DEFAULT false,
    `score` INTEGER NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_progress_user_id_content_id_step_key`(`user_id`, `content_id`, `step`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streaks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NOT NULL,
    `current_streak` INTEGER NOT NULL DEFAULT 0,
    `longest_streak` INTEGER NOT NULL DEFAULT 0,
    `last_completed` DATE NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `streaks_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NULL,
    `type` ENUM('view', 'share', 'complete', 'signup') NOT NULL,
    `content_id` INTEGER NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analytics_events_created_at_idx`(`created_at`),
    INDEX `analytics_events_type_created_at_idx`(`type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shares` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NULL,
    `content_id` INTEGER NOT NULL,
    `channel` ENUM('copy', 'kakao', 'twitter', 'other') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` ENUM('claude', 'openai') NOT NULL,
    `api_key` VARCHAR(500) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_progress` ADD CONSTRAINT `user_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_progress` ADD CONSTRAINT `user_progress_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streaks` ADD CONSTRAINT `streaks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shares` ADD CONSTRAINT `shares_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shares` ADD CONSTRAINT `shares_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
