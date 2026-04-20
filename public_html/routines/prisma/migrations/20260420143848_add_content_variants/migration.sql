-- AlterTable
ALTER TABLE `contents` DROP COLUMN `expressions`,
    DROP COLUMN `interview`,
    DROP COLUMN `paragraphs`,
    DROP COLUMN `quiz`,
    DROP COLUMN `sentences`,
    DROP COLUMN `speak_sentences`;

-- CreateTable
CREATE TABLE `content_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content_id` INTEGER NOT NULL,
    `level` ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
    `paragraphs` JSON NOT NULL,
    `sentences` JSON NOT NULL,
    `expressions` JSON NOT NULL,
    `quiz` JSON NOT NULL,
    `interview` JSON NOT NULL,
    `speak_sentences` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `content_variants_content_id_level_key`(`content_id`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `content_variants` ADD CONSTRAINT `content_variants_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

