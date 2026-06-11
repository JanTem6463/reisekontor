CREATE TABLE `day_entries` (
	`date` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`type` text NOT NULL,
	`homeoffice` integer DEFAULT false NOT NULL,
	`trip_id` integer,
	`fruehstueck` integer DEFAULT false NOT NULL,
	`mittag` integer DEFAULT false NOT NULL,
	`abend` integer DEFAULT false NOT NULL,
	`zuzahlung_cent` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`uebernachtung` integer NOT NULL
);
