-- CreateTable
CREATE TABLE `api_usage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` ENUM('claude', 'openai') NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `endpoint` ENUM('generation_stage1', 'generation_stage2', 'interview') NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `cache_read_tokens` INTEGER NOT NULL DEFAULT 0,
    `cache_creation_tokens` INTEGER NOT NULL DEFAULT 0,
    `estimated_cost_usd` DECIMAL(12, 8) NOT NULL DEFAULT 0,
    `duration_ms` INTEGER NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `error_message` TEXT NULL,
    `content_id` INTEGER NULL,
    `user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `api_usage_created_at_idx`(`created_at`),
    INDEX `api_usage_provider_model_created_at_idx`(`provider`, `model`, `created_at`),
    INDEX `api_usage_endpoint_created_at_idx`(`endpoint`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
