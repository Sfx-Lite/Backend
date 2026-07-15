import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1784101774479 implements MigrationInterface {
    name = 'Migration1784101774479'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "deposit_address" character varying NOT NULL, "derivation_index" integer NOT NULL, "asset" character varying(10) NOT NULL DEFAULT 'USDC', "swept_balance" numeric(18,6) NOT NULL DEFAULT '0', CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_92558c08091598f7a4439586cd" ON "wallets" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_70e8e2d0ad685a0c55eb3d5bd9" ON "wallets" ("deposit_address") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TYPE "public"."users_kyc_status_enum" AS ENUM('unverified', 'pending', 'verified', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "username" character varying(50) NOT NULL, "email" character varying NOT NULL, "password_hash" character varying, "google_id" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "pin_hash" character varying, "first_name" character varying, "last_name" character varying, "country" character varying, "kyc_status" "public"."users_kyc_status_enum" NOT NULL DEFAULT 'unverified', "suspended_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0bd5012aeb82628e07f6a1be53" ON "users" ("google_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('deposit', 'internal_transfer', 'withdrawal', 'sweep')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'processing', 'successful', 'failed')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."transactions_type_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending', "from_user_id" uuid, "to_user_id" uuid, "external_address" character varying, "tx_hash" character varying, "note" text, "asset" character varying(10) NOT NULL DEFAULT 'USDC', "fee" numeric(18,6) NOT NULL DEFAULT '0', "amount" numeric(18,6) NOT NULL, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_da87c55b3bbbe96c6ed88ea7ee" ON "transactions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_2f91a8175c49ac211314033e20" ON "transactions" ("from_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cab8dd57a6d6d100a21ddc7467" ON "transactions" ("to_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0deaa0ee5092d45fac99139de7" ON "transactions" ("tx_hash") `);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "type" character varying NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."ledger_entries_direction_enum" AS ENUM('debit', 'credit')`);
        await queryRunner.query(`CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "transaction_id" uuid NOT NULL, "user_id" uuid NOT NULL, "direction" "public"."ledger_entries_direction_enum" NOT NULL, "asset" character varying(10) NOT NULL DEFAULT 'USDC', "amount" numeric(18,6) NOT NULL, "balance_after" numeric(18,6) NOT NULL, CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b26c5ef5853fd6e0a8680427f6" ON "ledger_entries" ("transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8417854ce8bdd0d651c35e1c7c" ON "ledger_entries" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."kyc_submissions_doc_type_enum" AS ENUM('passport', 'national_id')`);
        await queryRunner.query(`CREATE TYPE "public"."kyc_submissions_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "kyc_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "doc_type" "public"."kyc_submissions_doc_type_enum" NOT NULL, "doc_url" character varying NOT NULL, "selfie_url" character varying NOT NULL, "status" "public"."kyc_submissions_status_enum" NOT NULL DEFAULT 'pending', "reason" character varying, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b6ce86b4b10d774272de1730a71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ec874b223ad5b6aad19a064481" ON "kyc_submissions" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "fx_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "base_currency" character varying(10) NOT NULL, "quote_currency" character varying(10) NOT NULL, "rate" numeric(18,8) NOT NULL, "source" character varying, CONSTRAINT "PK_94eb17e7eddb6df0cec5985ea5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3b81c8c96263c79a1067693df0" ON "fx_rates" ("base_currency", "quote_currency", "created_at") `);
        await queryRunner.query(`CREATE TABLE "doc_chunks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "source" character varying, "content" text NOT NULL, "embedding" text, "metadata" jsonb, CONSTRAINT "PK_d6a8e23116a90eccfbdc1e5fc36" PRIMARY KEY ("id")); COMMENT ON COLUMN "doc_chunks"."embedding" IS 'pgvector: convert to vector(1536) in the migration'`);
        await queryRunner.query(`CREATE TYPE "public"."chat_messages_role_enum" AS ENUM('user', 'assistant', 'system')`);
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "role" "public"."chat_messages_role_enum" NOT NULL, "content" text NOT NULL, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3d623662d4ee1219b23cf61e64" ON "chat_messages" ("conversation_id") `);
        await queryRunner.query(`CREATE TABLE "chat_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "title" character varying, CONSTRAINT "PK_ff117d9f57807c4f2e3034a39f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f9e5689ad3d7f45172fc156fb" ON "chat_conversations" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_type_enum" AS ENUM('internal', 'external')`);
        await queryRunner.query(`CREATE TABLE "beneficiaries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "type" "public"."beneficiaries_type_enum" NOT NULL, "identifier" character varying NOT NULL, CONSTRAINT "PK_c9356d282dec80f7f12a9eef10a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_38906de3393c7787c3c89e29d3" ON "beneficiaries" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_08b2603b00992fafcf795624cc" ON "beneficiaries" ("user_id", "identifier") `);
        await queryRunner.query(`CREATE TABLE "analytics_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "event_name" character varying NOT NULL, "actor_type" text NOT NULL, "session_id" uuid NOT NULL, "properties" jsonb, CONSTRAINT "PK_5d643d67a09b55653e98616f421" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c49704abb1730ae4121d5ac9f5" ON "analytics_events" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1bfdafcd2d2cf756138def6f38" ON "analytics_events" ("event_name") `);
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "admin_id" uuid NOT NULL, "action" character varying NOT NULL, "entity" character varying NOT NULL, "entity_id" uuid, "metadata" jsonb, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0de5650de773ff3e481357151b" ON "audit_log" ("admin_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7fb5009bdbeb7bf0393975335" ON "audit_log" ("entity") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_b7fb5009bdbeb7bf0393975335"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0de5650de773ff3e481357151b"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1bfdafcd2d2cf756138def6f38"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c49704abb1730ae4121d5ac9f5"`);
        await queryRunner.query(`DROP TABLE "analytics_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08b2603b00992fafcf795624cc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38906de3393c7787c3c89e29d3"`);
        await queryRunner.query(`DROP TABLE "beneficiaries"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f9e5689ad3d7f45172fc156fb"`);
        await queryRunner.query(`DROP TABLE "chat_conversations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3d623662d4ee1219b23cf61e64"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
        await queryRunner.query(`DROP TYPE "public"."chat_messages_role_enum"`);
        await queryRunner.query(`DROP TABLE "doc_chunks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b81c8c96263c79a1067693df0"`);
        await queryRunner.query(`DROP TABLE "fx_rates"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec874b223ad5b6aad19a064481"`);
        await queryRunner.query(`DROP TABLE "kyc_submissions"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_submissions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_submissions_doc_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8417854ce8bdd0d651c35e1c7c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b26c5ef5853fd6e0a8680427f6"`);
        await queryRunner.query(`DROP TABLE "ledger_entries"`);
        await queryRunner.query(`DROP TYPE "public"."ledger_entries_direction_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0deaa0ee5092d45fac99139de7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cab8dd57a6d6d100a21ddc7467"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2f91a8175c49ac211314033e20"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da87c55b3bbbe96c6ed88ea7ee"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bd5012aeb82628e07f6a1be53"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_kyc_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70e8e2d0ad685a0c55eb3d5bd9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92558c08091598f7a4439586cd"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
    }

}
