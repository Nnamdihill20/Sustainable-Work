
const sdk = require('node-appwrite');
const { Permission, Role } = sdk;

const client = new sdk.Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new sdk.TablesDB(client);
const storage = new sdk.Storage(client);
const teams = new sdk.Teams(client);

const DB_ID = 'swl';

// anyone can view, only the admins team can make changes
const permissions = [
  Permission.read(Role.any()),
  Permission.create(Role.team('admins')),
  Permission.update(Role.team('admins')),
  Permission.delete(Role.team('admins')),
];

async function tryCreate(name, createFn) {
  try {
    await createFn();
    console.log('created', name);
  } catch (err) {
    if (err.code === 409) {
      console.log('already exists:', name);
    } else {
      throw err;
    }
  }
}

async function waitForColumns(tableId) {
  for (let i = 0; i < 30; i++) {
    const table = await db.getTable({ databaseId: DB_ID, tableId });
    const done = table.columns.every((col) => col.status === 'available');
    if (done) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('columns took too long in ' + tableId);
}

async function makeTable(tableId, name) {
  await tryCreate('table ' + tableId, () =>
    db.createTable({ databaseId: DB_ID, tableId, name, permissions })
  );
}

async function main() {
  await tryCreate('admins team', () => teams.create({ teamId: 'admins', name: 'Admins' }));
  await tryCreate('database', () => db.create({ databaseId: DB_ID, name: 'Sustainable Work Lab' }));

  const base = { databaseId: DB_ID };

  // Publications
  let t = { ...base, tableId: 'publications' };
  await makeTable('publications', 'Publications');
  await tryCreate('title', () => db.createVarcharColumn({ ...t, key: 'title', size: 300, required: true }));
  await tryCreate('summary', () => db.createTextColumn({ ...t, key: 'summary', required: false }));
  await tryCreate('paper_url', () => db.createUrlColumn({ ...t, key: 'paper_url', required: false }));
  await tryCreate('publication_year', () => db.createIntegerColumn({ ...t, key: 'publication_year', required: false }));
  await tryCreate('created_by', () => db.createVarcharColumn({ ...t, key: 'created_by', size: 36, required: false }));
  await waitForColumns('publications');
  await tryCreate('title search index', () => db.createIndex({ ...t, key: 'title_search', type: 'fulltext', columns: ['title'] }));
  await tryCreate('year index', () => db.createIndex({ ...t, key: 'year_sort', type: 'key', columns: ['publication_year'] }));

  // Tags
  t = { ...base, tableId: 'tags' };
  await makeTable('tags', 'Tags');
  await tryCreate('tag_name', () => db.createVarcharColumn({ ...t, key: 'tag_name', size: 100, required: true }));
  await waitForColumns('tags');
  await tryCreate('unique tag index', () => db.createIndex({ ...t, key: 'tag_name_unique', type: 'unique', columns: ['tag_name'] }));

  // People
  t = { ...base, tableId: 'people' };
  await makeTable('people', 'People');
  await tryCreate('name', () => db.createVarcharColumn({ ...t, key: 'name', size: 150, required: true }));
  await tryCreate('role', () => db.createVarcharColumn({ ...t, key: 'role', size: 150, required: false }));
  await tryCreate('email', () => db.createEmailColumn({ ...t, key: 'email', required: false })); // optional
  await tryCreate('profile', () => db.createTextColumn({ ...t, key: 'profile', required: false }));

  // Publication_Tag (links papers and tags)
  t = { ...base, tableId: 'publication_tags' };
  await makeTable('publication_tags', 'Publication Tags');
  await tryCreate('publication_id', () => db.createVarcharColumn({ ...t, key: 'publication_id', size: 36, required: true }));
  await tryCreate('tag_id', () => db.createVarcharColumn({ ...t, key: 'tag_id', size: 36, required: true }));
  await waitForColumns('publication_tags');
  await tryCreate('unique pair index', () => db.createIndex({ ...t, key: 'pair_unique', type: 'unique', columns: ['publication_id', 'tag_id'] }));

  // Publication_Person (links papers and authors)
  t = { ...base, tableId: 'publication_people' };
  await makeTable('publication_people', 'Publication People');
  await tryCreate('publication_id', () => db.createVarcharColumn({ ...t, key: 'publication_id', size: 36, required: true }));
  await tryCreate('person_id', () => db.createVarcharColumn({ ...t, key: 'person_id', size: 36, required: true }));
  await tryCreate('author_order', () => db.createIntegerColumn({ ...t, key: 'author_order', required: false }));
  await waitForColumns('publication_people');
  await tryCreate('unique pair index', () => db.createIndex({ ...t, key: 'pair_unique', type: 'unique', columns: ['publication_id', 'person_id'] }));

  // External links (homepage + media page)
  t = { ...base, tableId: 'external_links' };
  await makeTable('external_links', 'External Links');
  await tryCreate('title', () => db.createVarcharColumn({ ...t, key: 'title', size: 300, required: true }));
  await tryCreate('url', () => db.createUrlColumn({ ...t, key: 'url', required: true }));
  await tryCreate('description', () => db.createTextColumn({ ...t, key: 'description', required: false }));
  await tryCreate('link_type', () => db.createEnumColumn({ ...t, key: 'link_type', elements: ['homepage', 'media'], required: true }));
  await tryCreate('added_by', () => db.createVarcharColumn({ ...t, key: 'added_by', size: 36, required: false }));

  // storage for the paper PDFs
  await tryCreate('papers bucket', () =>
    storage.createBucket({ bucketId: 'papers', name: 'Research Papers', permissions, allowedFileExtensions: ['pdf'] })
  );

  console.log('\nDatabase setup done!');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
