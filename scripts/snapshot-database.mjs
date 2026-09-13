// Read-only full persisted-state evidence. Output may contain private data; keep it local.
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL explicitly');
const path=process.argv[3];if(!path)throw new Error('Usage: snapshot-database.mjs capture|compare /path/to/snapshot.json');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const state={};for(const {tablename} of tables){if(!/^[a-z_]+$/.test(tablename))throw new Error('Unexpected table');state[tablename]=(await db.query(`SELECT row_to_json(t) AS row FROM ${tablename} t ORDER BY row_to_json(t)::text`)).rows.map(x=>x.row)}
 await db.query('COMMIT');
 if(process.argv[2]==='capture')await writeFile(path,JSON.stringify(state,null,2));
 else {assert.deepEqual(state,JSON.parse(await readFile(path,'utf8')));await writeFile(path+'.result.json',JSON.stringify({status:'PASS',at:new Date().toISOString(),tables:Object.fromEntries(Object.entries(state).map(([k,v])=>[k,v.length]))},null,2));console.log('All persisted rows match, including task events and authentication tables');}
}finally{await db.end()}
