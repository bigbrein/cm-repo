CREATE TABLE "rate_limit_bucket" (
	"key" text NOT NULL,
	"windowStart" timestamp NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limit_bucket_key_windowStart_pk" PRIMARY KEY("key","windowStart")
);
