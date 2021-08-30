/* Database export results for db gamenotifierbot_v1 */

/* Preserve session variables */
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS=0;

/* Export data */

drop table if exists `Games`;

/* Table structure for Games */
CREATE TABLE `Games` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `game` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_reported_turn` int(11) DEFAULT NULL,
  `turn_reporter` int(11) DEFAULT NULL,
  `game_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discord_channel_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discord_channel_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* data for Table Games */

drop table if exists `Players`;

/* Table structure for Players */
CREATE TABLE `Players` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discord_player_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discord_player_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `game_player_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_key` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* data for Table Players */
INSERT INTO `Players` VALUES (NULL,"The Unknown Player","","The Unknown Player",NULL);

/* Restore session variables to original values */
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;

/* If a foreign constraint is wanted in the actual database, uncomment this */
/* I actually have the constraints logic in the code of the bot. */
/*ALTER TABLE
    `Games` ADD CONSTRAINT `game_turn_reporter_foreign` FOREIGN KEY(`turn_reporter`) REFERENCES `Players`(`id`);
    */
