import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("email").unique().notNullable();
    table.string("password_hash").notNullable();
    table.timestamps(true, true);
  });

  // Files table
  await knex.schema.createTable("files", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("original_name").notNullable();
    table.string("stored_name").notNullable();
    table.string("storage_path").notNullable();
    table.string("mime_type").notNullable();
    table.bigInteger("size").notNullable();
    table.string("checksum", 64);
    table.uuid("owner_id").references("id").inTable("users").onDelete("SET NULL");
    table.timestamps(true, true);
    table.timestamp("deleted_at").nullable();
  });

  // Shares table
  await knex.schema.createTable("shares", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("token", 8).unique().notNullable();
    table.uuid("owner_id").references("id").inTable("users").onDelete("SET NULL");
    table.string("password_hash").nullable();
    table.timestamp("expires_at").nullable();
    table.integer("max_downloads").nullable();
    table.integer("download_count").defaultTo(0);
    table.boolean("delete_after_download").defaultTo(false);
    table.timestamps(true, true);
  });

  // Share Files junction table
  await knex.schema.createTable("share_files", (table) => {
    table.uuid("share_id").references("id").inTable("shares").onDelete("CASCADE");
    table.uuid("file_id").references("id").inTable("files").onDelete("CASCADE");
    table.primary(["share_id", "file_id"]);
  });

  // Downloads table
  await knex.schema.createTable("downloads", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.uuid("share_id").references("id").inTable("shares").onDelete("SET NULL");
    table.uuid("file_id").references("id").inTable("files").onDelete("SET NULL");
    table.timestamps(true, true);
    table.timestamp("completed_at").nullable();
    table.string("status").defaultTo("pending");
  });

  // Indexes
  await knex.schema.raw("CREATE INDEX idx_files_owner ON files(owner_id)");
  await knex.schema.raw("CREATE INDEX idx_files_checksum ON files(checksum)");
  await knex.schema.raw("CREATE INDEX idx_shares_token ON shares(token)");
  await knex.schema.raw("CREATE INDEX idx_shares_owner ON shares(owner_id)");
  await knex.schema.raw("CREATE INDEX idx_shares_expires ON shares(expires_at)");
  await knex.schema.raw("CREATE INDEX idx_share_files_share ON share_files(share_id)");
  await knex.schema.raw("CREATE INDEX idx_share_files_file ON share_files(file_id)");
  await knex.schema.raw("CREATE INDEX idx_downloads_share ON downloads(share_id)");
  await knex.schema.raw("CREATE INDEX idx_downloads_file ON downloads(file_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("downloads");
  await knex.schema.dropTableIfExists("share_files");
  await knex.schema.dropTableIfExists("shares");
  await knex.schema.dropTableIfExists("files");
  await knex.schema.dropTableIfExists("users");
}
