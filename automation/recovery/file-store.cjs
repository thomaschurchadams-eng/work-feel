'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Local durable adapter for a single shared filesystem. The owner must use a
// shared transactional store instead when workers do not share this directory.
function fileStore(directory) {
  const name = key => crypto.createHash('sha256').update(key).digest('hex');
  const statePath = key => path.join(directory, `${name(key)}.json`);
  return {
    async acquire(key) {
      await fs.mkdir(directory, { recursive:true });
      const lock = path.join(directory, `${name(key)}.lock`);
      for (let attempt=0; attempt<200; attempt++) {
        try { await fs.mkdir(lock); return async () => fs.rmdir(lock); }
        catch (error) { if (error.code !== 'EEXIST') throw error; await sleep(10); }
      }
      throw Object.assign(Error('recovery_lease_busy'), { code:'LEASE_BUSY' });
    },
    async load(key) {
      try { return JSON.parse(await fs.readFile(statePath(key), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async save(state) {
      const dest=statePath(state.key), tmp=`${dest}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(state)}\n`, { flag:'wx' });
      try { await fs.rename(tmp,dest); } finally { await fs.rm(tmp,{force:true}); }
    }
  };
}
module.exports={fileStore};
