-- CreateTable
CREATE TABLE `topic_pool` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(20) NOT NULL,
    `subtopic_ko` VARCHAR(255) NOT NULL,
    `key_phrase_en` VARCHAR(255) NOT NULL,
    `key_ko` VARCHAR(255) NOT NULL,
    `last_used_at` DATE NULL,
    `use_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `topic_pool_category_last_used_at_idx`(`category`, `last_used_at`),
    UNIQUE INDEX `topic_pool_category_subtopic_ko_key`(`category`, `subtopic_ko`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category_rotation_state` (
    `id` INTEGER NOT NULL,
    `last_category` VARCHAR(20) NULL,
    `last_used_at` DATE NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the singleton rotation-state row.
INSERT INTO `category_rotation_state` (`id`, `last_category`, `last_used_at`, `updated_at`) VALUES (1, NULL, NULL, NOW());
