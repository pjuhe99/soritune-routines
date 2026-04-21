-- CreateTable
CREATE TABLE `interview_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NOT NULL,
    `content_id` INTEGER NOT NULL,
    `question_index` INTEGER NOT NULL,
    `level` ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
    `question` TEXT NOT NULL,
    `user_answer` TEXT NOT NULL,
    `recommended_sentence` TEXT NOT NULL,
    `feedback` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `interview_answers_user_id_content_id_level_idx`(`user_id`, `content_id`, `level`),
    UNIQUE INDEX `interview_answers_user_id_content_id_level_question_index_key`(`user_id`, `content_id`, `level`, `question_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recordings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(36) NOT NULL,
    `interview_answer_id` INTEGER NOT NULL,
    `target_sentence` TEXT NOT NULL,
    `file_path` VARCHAR(512) NOT NULL,
    `file_ext` VARCHAR(8) NOT NULL,
    `mime_type` VARCHAR(64) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `duration_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `recordings_user_id_interview_answer_id_idx`(`user_id`, `interview_answer_id`),
    INDEX `recordings_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `interview_answers` ADD CONSTRAINT `interview_answers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_answers` ADD CONSTRAINT `interview_answers_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_interview_answer_id_fkey` FOREIGN KEY (`interview_answer_id`) REFERENCES `interview_answers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
