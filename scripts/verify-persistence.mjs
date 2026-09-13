// Compatibility entrypoint; compare the database, not the deliberately bounded UI snapshot.
process.argv[2]=process.argv[2]==='before'?'capture':'compare';
process.argv[3]=(process.env.ARTIFACTS||'artifacts')+'/restart-before.json';
await import('./snapshot-database.mjs');
