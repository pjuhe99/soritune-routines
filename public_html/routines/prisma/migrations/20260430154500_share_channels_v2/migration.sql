-- Defensive guard: coerce any 'twitter' rows to 'other' so the ALTER below
-- never silently truncates them to '' in non-strict mode (or fails in strict mode).
UPDATE `shares` SET `channel` = 'other' WHERE `channel` = 'twitter';

-- AlterTable: update ShareChannel enum on shares.channel
-- - Drop legacy `twitter` value (no rows present in DEV at migration time)
-- - Add `image_download`, `web_share`, `cafe`
ALTER TABLE `shares`
  MODIFY COLUMN `channel` ENUM('copy', 'kakao', 'image_download', 'web_share', 'cafe', 'other') NOT NULL;
