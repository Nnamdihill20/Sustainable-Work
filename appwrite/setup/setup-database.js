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
