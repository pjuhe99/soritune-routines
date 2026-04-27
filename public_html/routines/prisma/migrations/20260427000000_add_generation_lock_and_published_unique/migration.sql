-- CreateTable
CREATE TABLE `generation_locks` (
    `date` DATE NOT NULL,
    `acquired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateUniqueIndex (contents.published_at)
CREATE UNIQUE INDEX `uk_contents_published_at` ON `contents`(`published_at`);
