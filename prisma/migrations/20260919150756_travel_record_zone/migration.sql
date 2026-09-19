/*
  Warnings:

  - Added the required column `zone` to the `TravelRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TravelRecord` ADD COLUMN `zone` VARCHAR(191) NOT NULL;
