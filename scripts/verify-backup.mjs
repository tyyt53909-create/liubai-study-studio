import pg from 'pg';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const source = new pg.Client({connectionString:process.env.DATABASE_URL||'postgres://study:study_local@localhost:55439/study'});
const restored = new pg.Client({connectionString:process.env.RESTORE_DATABASE_URL||'postgres://study:study_local@localhost:55439/study_restore_verify'});
assert.equal(restored.connectionParameters.database, 'study_restore_verify');
await source.connect();await restored.connect();
try {
 const tables=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const counts={};
 for(const {tablename} of tables){
  if(!/^[a-z_]+$/.test(tablename))throw new Error('Unexpected table');
  const query=`SELECT row_to_json(t) AS row FROM ${tablename} t ORDER BY row_to_json(t)::text`;
  const a=(await source.query(query)).rows,b=(await restored.query(query)).rows;
  assert.deepEqual(b,a,tablename);counts[tablename]=a.length;
 }
 const result={status:'PASS',checkedAt:new Date().toISOString(),tables:counts,assertion:'Every row in every public table equals the separate database restored from pg_dump'};
 await writeFile(process.env.RESULT_FILE||'artifacts/backup-restore.json',JSON.stringify(result,null,2));console.log(result);
}finally{await source.end();await restored.end()}
