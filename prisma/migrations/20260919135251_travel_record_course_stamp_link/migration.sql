-- AlterTable
ALTER TABLE `TravelRecord` ADD COLUMN `nights` INTEGER NULL,
    ADD COLUMN `savedCourseId` VARCHAR(191) NULL,
    ADD COLUMN `spotCount` INTEGER NULL,
    ADD COLUMN `totalDistance` INTEGER NULL;

-- CreateTable
CREATE TABLE `_StampToTravelRecord` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_StampToTravelRecord_AB_unique`(`A`, `B`),
    INDEX `_StampToTravelRecord_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `TravelRecord_savedCourseId_idx` ON `TravelRecord`(`savedCourseId`);

-- AddForeignKey
ALTER TABLE `TravelRecord` ADD CONSTRAINT `TravelRecord_savedCourseId_fkey` FOREIGN KEY (`savedCourseId`) REFERENCES `SavedCourse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StampToTravelRecord` ADD CONSTRAINT `_StampToTravelRecord_A_fkey` FOREIGN KEY (`A`) REFERENCES `Stamp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StampToTravelRecord` ADD CONSTRAINT `_StampToTravelRecord_B_fkey` FOREIGN KEY (`B`) REFERENCES `TravelRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

