CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_weight_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_kg" numeric(10, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kind" text DEFAULT 'missed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"meal_type" text NOT NULL,
	"food_id" uuid,
	"food_name" text NOT NULL,
	"kcal_per100" integer NOT NULL,
	"protein_per100" numeric(10, 1) NOT NULL,
	"carbs_per100" numeric(10, 1) NOT NULL,
	"fat_per100" numeric(10, 1) NOT NULL,
	"grams" numeric(10, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"muscle_group" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"kcal_per100" integer NOT NULL,
	"protein_per100" numeric(10, 1) NOT NULL,
	"carbs_per100" numeric(10, 1) NOT NULL,
	"fat_per100" numeric(10, 1) NOT NULL,
	"is_liquid" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nutrition_goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"calories_kcal" integer,
	"protein_g" integer,
	"carbs_g" integer,
	"fat_g" integer,
	"water_ml" integer,
	"manual_calories" boolean DEFAULT false NOT NULL,
	"manual_protein" boolean DEFAULT false NOT NULL,
	"manual_carbs" boolean DEFAULT false NOT NULL,
	"manual_fat" boolean DEFAULT false NOT NULL,
	"manual_water" boolean DEFAULT false NOT NULL,
	"weight_at_calc" numeric(10, 1),
	"recalculated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"training_item_id" uuid NOT NULL,
	"set_index" integer NOT NULL,
	"actual_weight" numeric(10, 1),
	"actual_reps" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supplement_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"supplement_id" uuid,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"dose" numeric(10, 1) NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"dose" numeric(10, 1) NOT NULL,
	"daily_target" numeric(10, 1),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT '未开始' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_rest" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sets" integer NOT NULL,
	"reps" integer NOT NULL,
	"target_weight" numeric(10, 1),
	"rest_seconds" integer DEFAULT 90 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"training_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT '进行中' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "trainings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_day_id" uuid NOT NULL,
	"name" text NOT NULL,
	"muscle_group" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"nickname" text,
	"gender" text,
	"age" integer,
	"height_cm" integer,
	"body_fat_pct" numeric(10, 1),
	"goal_type" text,
	"target_weight_kg" numeric(10, 1),
	"target_date" date,
	"weekly_training_days" integer,
	"onboarded_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_weight_records" ADD CONSTRAINT "body_weight_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_marks" ADD CONSTRAINT "day_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_items" ADD CONSTRAINT "diet_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_items" ADD CONSTRAINT "diet_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_goals" ADD CONSTRAINT "nutrition_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_training_item_id_training_items_id_fk" FOREIGN KEY ("training_item_id") REFERENCES "public"."training_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_logs" ADD CONSTRAINT "supplement_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_logs" ADD CONSTRAINT "supplement_logs_supplement_id_supplements_id_fk" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplements" ADD CONSTRAINT "supplements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_cycles" ADD CONSTRAINT "training_cycles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_days" ADD CONSTRAINT "training_days_cycle_id_training_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."training_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_items" ADD CONSTRAINT "training_items_training_id_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_items" ADD CONSTRAINT "training_items_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_training_id_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_training_day_id_training_days_id_fk" FOREIGN KEY ("training_day_id") REFERENCES "public"."training_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "body_weight_user_date_uidx" ON "body_weight_records" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "day_marks_user_date_uidx" ON "day_marks" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "diet_items_user_date_idx" ON "diet_items" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "events_name_created_idx" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "exercises_owner_name_idx" ON "exercises" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "foods_owner_name_idx" ON "foods" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "set_logs_session_idx" ON "set_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "set_logs_item_idx" ON "set_logs" USING btree ("training_item_id");--> statement-breakpoint
CREATE INDEX "supplement_logs_user_date_idx" ON "supplement_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "supplements_user_idx" ON "supplements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_cycles_user_idx" ON "training_cycles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_cycles_one_active_per_user" ON "training_cycles" USING btree ("user_id") WHERE status = '进行中';--> statement-breakpoint
CREATE UNIQUE INDEX "training_days_cycle_date_uidx" ON "training_days" USING btree ("cycle_id","date");--> statement-breakpoint
CREATE INDEX "training_items_training_idx" ON "training_items" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "training_items_exercise_idx" ON "training_items" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "training_sessions_user_idx" ON "training_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_sessions_training_idx" ON "training_sessions" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "training_sessions_user_date_idx" ON "training_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "training_sessions_one_in_progress" ON "training_sessions" USING btree ("user_id") WHERE status = '进行中';--> statement-breakpoint
CREATE INDEX "trainings_day_idx" ON "trainings" USING btree ("training_day_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_codes_email_created_idx" ON "verification_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "water_logs_user_date_idx" ON "water_logs" USING btree ("user_id","date");